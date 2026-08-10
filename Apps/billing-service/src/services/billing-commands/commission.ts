import { randomUUID } from "node:crypto";
import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  CommissionApproveCommandSchema,
  CommissionCalculateCommandSchema,
  CommissionMarkPaidCommandSchema,
  CommissionStatementGenerateCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Calculate commission for a reservation.
 * Looks up applicable commission rules from booking_sources or commission_rules,
 * then inserts into travel_agent_commissions and commission_tracking.
 */
export const calculateCommission = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = CommissionCalculateCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  // Determine commission config: prefer travel_agent_id → booking_sources fallback
  let commissionType = "PERCENTAGE";
  let commissionRate = 0;
  let flatAmount = 0;
  let agentCompanyId: string | null = null;

  if (command.travel_agent_id) {
    // Look up applicable commission rule for this agent
    const ruleResult = await query<{
      commission_type: string;
      default_rate: number;
      room_rate: number;
      flat_amount: number;
      company_id: string | null;
    }>(
      // commission_rules has no commission_type column: the shape of the rule
      // is implied by which amount it carries, so it is derived here rather
      // than stored twice.
      `SELECT CASE WHEN cr.flat_commission_amount IS NOT NULL THEN 'FLAT'
                   ELSE 'PERCENTAGE' END AS commission_type,
              cr.overall_commission_rate AS default_rate,
              cr.room_commission_rate    AS room_rate,
              COALESCE(cr.flat_commission_amount, 0) AS flat_amount,
              cr.company_id
       FROM commission_rules cr
       WHERE cr.tenant_id = $1
         AND cr.is_active = true
         AND (cr.company_id = (SELECT company_id FROM travel_agents WHERE agent_id = $2 AND tenant_id = $1 LIMIT 1)
              OR cr.apply_to_all_agents = true)
         AND (cr.effective_from IS NULL OR cr.effective_from <= CURRENT_DATE)
         AND (cr.effective_to IS NULL OR cr.effective_to >= CURRENT_DATE)
       ORDER BY cr.apply_to_all_agents ASC, cr.rule_priority DESC
       LIMIT 1`,
      [tenantId, command.travel_agent_id],
    );
    const rule = ruleResult.rows?.[0];
    if (rule) {
      commissionType = rule.commission_type;
      commissionRate = Number(rule.room_rate || rule.default_rate || 0);
      flatAmount = Number(rule.flat_amount || 0);
      agentCompanyId = rule.company_id;
    }
  }

  if (commissionRate === 0 && flatAmount === 0 && command.booking_source_id) {
    // Fallback: look up booking_sources commission config
    const srcResult = await query<{
      commission_type: string;
      commission_percentage: number;
      commission_fixed_amount: number;
    }>(
      `SELECT commission_type, COALESCE(commission_percentage, 0) AS commission_percentage,
              COALESCE(commission_fixed_amount, 0) AS commission_fixed_amount
       FROM booking_sources
       WHERE source_id = $1 AND tenant_id = $2 LIMIT 1`,
      [command.booking_source_id, tenantId],
    );
    const src = srcResult.rows?.[0];
    if (src && src.commission_type !== "NONE") {
      commissionType = src.commission_type;
      commissionRate = Number(src.commission_percentage);
      flatAmount = Number(src.commission_fixed_amount);
    }
  }

  // Calculate gross commission
  let grossCommission = 0;
  if (commissionType === "PERCENTAGE" && commissionRate > 0) {
    grossCommission = (command.room_revenue * commissionRate) / 100;
  } else if (commissionType === "FIXED" || commissionType === "FLAT_RATE") {
    grossCommission = flatAmount;
  } else if (commissionRate > 0) {
    // Default to percentage
    grossCommission = (command.room_revenue * commissionRate) / 100;
  }

  if (grossCommission <= 0) {
    appLogger.debug(
      { reservationId: command.reservation_id },
      "No commission applicable — skipping",
    );
    return "NO_COMMISSION";
  }

  // Round to 2 decimal places
  grossCommission = Math.round(grossCommission * 100) / 100;

  const commissionId = randomUUID();
  const trackingId = randomUUID();

  await withTransaction(async (client) => {
    // Insert into travel_agent_commissions
    await queryWithClient(
      client,
      // total_revenue is NOT NULL and is the base the commission is taken on;
      // for a room-only commission that is the room revenue.
      `INSERT INTO travel_agent_commissions (
         commission_id, tenant_id, property_id, reservation_id,
         agent_id, company_id, commission_type, room_revenue, total_revenue,
         room_commission_rate, gross_commission,
         currency_code, payment_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::uuid, $6::uuid, $7, $8, $8,
         $9, $10,
         $11, 'PENDING',
         $12::uuid, $12::uuid
       )`,
      [
        commissionId,
        tenantId,
        command.property_id,
        command.reservation_id,
        command.travel_agent_id ?? null,
        agentCompanyId,
        commissionType.toLowerCase(),
        command.room_revenue,
        commissionRate,
        grossCommission,
        command.currency,
        actorId,
      ],
    );

    // Insert into commission_tracking
    await queryWithClient(
      client,
      // commission_tracking separates the commission lifecycle
      // (commission_status) from the payment lifecycle (payment_status); this
      // row is being created, so only the former is set. commission_number,
      // source_id and transaction_date are NOT NULL: the number is the human
      // reference, the source is the reservation the commission arose from.
      `INSERT INTO commission_tracking (
         commission_id, tenant_id, property_id, reservation_id,
         commission_number, source_type, source_id, transaction_date,
         commission_type, beneficiary_type, beneficiary_id,
         base_amount, commission_rate, commission_amount,
         net_commission_amount, commission_currency, commission_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5, 'reservation', $4::uuid, CURRENT_DATE,
         'booking', 'agent', $6::uuid,
         $7, $8, $9,
         $9, $10, 'pending',
         $11::uuid, $11::uuid
       )`,
      [
        trackingId,
        tenantId,
        command.property_id,
        command.reservation_id,
        `CT-${new Date().getFullYear()}-${trackingId.slice(0, 8).toUpperCase()}`,
        command.travel_agent_id ?? command.booking_source_id ?? null,
        command.room_revenue,
        commissionRate,
        grossCommission,
        command.currency,
        actorId,
      ],
    );
  });

  appLogger.info(
    {
      commissionId,
      trackingId,
      reservationId: command.reservation_id,
      grossCommission,
      commissionRate,
      commissionType,
    },
    "Commission calculated and recorded",
  );

  auditAsync({
    tenantId,
    propertyId: command.property_id,
    userId: actorId ?? "00000000-0000-0000-0000-000000000000",
    action: "COMMISSION_CALCULATED",
    entityType: "travel_agent_commission",
    entityId: commissionId,
    severity: "INFO",
    description: `Commission calculated: ${grossCommission} ${command.currency} for reservation ${command.reservation_id}`,
    newValues: {
      commissionId,
      grossCommission,
      commissionRate,
      commissionType,
      currency: command.currency,
    },
  });

  return commissionId;
};

/**
 * Approve a pending commission for payout.
 */
export const approveCommission = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = CommissionApproveCommandSchema.parse(payload);
  const tenantId = context.tenantId;

  const result = await query(
    `UPDATE travel_agent_commissions
     SET payment_status = 'APPROVED',
         approved_at = NOW(),
         approved_by = $3::uuid,
         approval_notes = $4,
         updated_by = $3::uuid,
         updated_at = NOW()
     WHERE commission_id = $1 AND tenant_id = $2 AND payment_status = 'PENDING'`,
    [command.commission_id, tenantId, command.approved_by, command.notes ?? null],
  );

  if (result.rowCount === 0) {
    throw new BillingCommandError(
      "COMMISSION_NOT_FOUND",
      `Commission ${command.commission_id} not found or not in PENDING status`,
    );
  }

  // Also update commission_tracking
  await query(
    `UPDATE commission_tracking
     SET commission_status = 'approved', approved_at = NOW(), approved_by = $3::uuid, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND commission_status = 'pending'`,
    [command.commission_id, tenantId, command.approved_by],
  );

  appLogger.info({ commissionId: command.commission_id }, "Commission approved");

  auditAsync({
    tenantId,
    userId: command.approved_by,
    action: "COMMISSION_APPROVED",
    entityType: "travel_agent_commission",
    entityId: command.commission_id,
    severity: "INFO",
    description: `Commission approved${command.notes ? `: ${command.notes}` : ""}`,
    newValues: { status: "APPROVED", approvedBy: command.approved_by },
  });

  return command.commission_id;
};

/**
 * Mark a commission as paid.
 */
export const markCommissionPaid = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = CommissionMarkPaidCommandSchema.parse(payload);
  const tenantId = context.tenantId;

  const result = await query(
    `UPDATE travel_agent_commissions
     SET payment_status = 'PAID',
         payment_date = COALESCE($3::timestamptz, NOW()),
         payment_reference = $4,
         payment_method = $5,
         updated_at = NOW()
     WHERE commission_id = $1 AND tenant_id = $2 AND payment_status IN ('PENDING', 'APPROVED')`,
    [
      command.commission_id,
      tenantId,
      command.payment_date ?? null,
      command.payment_reference,
      command.payment_method ?? null,
    ],
  );

  if (result.rowCount === 0) {
    throw new BillingCommandError(
      "COMMISSION_NOT_FOUND",
      `Commission ${command.commission_id} not found or already paid`,
    );
  }

  // Update commission_tracking
  await query(
    `UPDATE commission_tracking
     SET payment_status = 'paid', commission_status = 'paid', paid_at = NOW(),
         payment_reference = $3, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND commission_status IN ('pending', 'approved')`,
    [command.commission_id, tenantId, command.payment_reference],
  );

  appLogger.info(
    { commissionId: command.commission_id, paymentRef: command.payment_reference },
    "Commission marked as paid",
  );

  auditAsync({
    tenantId,
    userId: resolveActorId(context.initiatedBy) ?? "00000000-0000-0000-0000-000000000000",
    action: "COMMISSION_PAID",
    entityType: "travel_agent_commission",
    entityId: command.commission_id,
    severity: "INFO",
    description: `Commission paid: ref ${command.payment_reference}`,
    newValues: {
      status: "PAID",
      paymentReference: command.payment_reference,
      paymentMethod: command.payment_method,
    },
  });

  return command.commission_id;
};

export const generateCommissionStatement = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = CommissionStatementGenerateCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  const filterConditions: string[] = [];
  const filterParams: unknown[] = [
    tenantId,
    command.property_id,
    command.period_start,
    command.period_end,
  ];
  if (command.agent_id) {
    filterParams.push(command.agent_id);
    filterConditions.push(`AND tac.agent_id = $${filterParams.length}::uuid`);
  } else if (command.company_id) {
    filterParams.push(command.company_id);
    filterConditions.push(`AND tac.company_id = $${filterParams.length}::uuid`);
  }
  const agentFilter = filterConditions.join(" ");

  const statsResult = await query<{
    total_bookings: number;
    total_room_nights: number;
    total_revenue: number;
    total_gross: number;
    company_id: string | null;
    agent_id: string | null;
  }>(
    `SELECT
       COUNT(DISTINCT tac.reservation_id) AS total_bookings,
       -- reservations stores the stay as two dates; nights is derived, not stored.
       COALESCE(SUM(r.check_out_date - r.check_in_date), 0) AS total_room_nights,
       COALESCE(SUM(tac.room_revenue), 0) AS total_revenue,
       COALESCE(SUM(tac.gross_commission), 0) AS total_gross,
       tac.company_id, tac.agent_id
     FROM travel_agent_commissions tac
     LEFT JOIN reservations r ON r.id = tac.reservation_id AND r.tenant_id = tac.tenant_id
     WHERE tac.tenant_id = $1
       AND tac.property_id = $2
       AND tac.created_at >= $3
       AND tac.created_at < $4
       ${agentFilter}
     GROUP BY tac.company_id, tac.agent_id`,
    filterParams,
  );

  if (statsResult.rows.length === 0) {
    appLogger.info(
      {
        propertyId: command.property_id,
        periodStart: command.period_start,
        periodEnd: command.period_end,
      },
      "No commissions found for statement period",
    );
    return "NO_COMMISSIONS";
  }

  const statementsCreated: string[] = [];

  for (const stats of statsResult.rows) {
    const statementId = randomUUID();
    const statementNumber = `CS-${new Date().getFullYear()}-${statementId.slice(0, 8).toUpperCase()}`;

    await query(
      // A new statement is unpaid, so payment_status carries its state; the
      // table has no separate statement_status.
      `INSERT INTO commission_statements (
         statement_id, tenant_id, property_id, company_id, agent_id,
         statement_number, statement_date, period_start_date, period_end_date,
         total_bookings, total_room_nights, total_revenue,
         total_gross_commission, total_net_commission,
         currency_code, payment_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         $6, CURRENT_DATE, $7, $8,
         $9, $10, $11, $12, $12,
         $13, 'PENDING',
         $14::uuid, $14::uuid
       )`,
      [
        statementId,
        tenantId,
        command.property_id,
        stats.company_id,
        stats.agent_id,
        statementNumber,
        command.period_start,
        command.period_end,
        stats.total_bookings,
        stats.total_room_nights,
        stats.total_revenue,
        stats.total_gross,
        command.metadata?.currency ?? "USD",
        actorId,
      ],
    );
    statementsCreated.push(statementId);
  }

  appLogger.info(
    {
      count: statementsCreated.length,
      propertyId: command.property_id,
      periodStart: command.period_start,
      periodEnd: command.period_end,
    },
    "Commission statements generated",
  );
  return statementsCreated[0] ?? "NO_STATEMENTS";
};
