import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  CommissionApproveCommandSchema,
  CommissionCalculateCommandSchema,
  CommissionMarkPaidCommandSchema,
  CommissionStatementGenerateCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  type CommandContext,
  BillingCommandError,
  SYSTEM_ACTOR_ID,
  asUuid,
  resolveActorId,
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
      `SELECT cr.commission_type, cr.default_rate, cr.room_rate,
              COALESCE(cr.flat_amount_per_booking, 0) AS flat_amount,
              cr.company_id
       FROM commission_rules cr
       WHERE cr.tenant_id = $1
         AND cr.is_active = true
         AND (cr.company_id = (SELECT company_id FROM travel_agents WHERE agent_id = $2 AND tenant_id = $1 LIMIT 1)
              OR cr.apply_to_all_agents = true)
         AND (cr.effective_start IS NULL OR cr.effective_start <= CURRENT_DATE)
         AND (cr.effective_end IS NULL OR cr.effective_end >= CURRENT_DATE)
       ORDER BY cr.apply_to_all_agents ASC, cr.priority DESC
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
      `INSERT INTO travel_agent_commissions (
         commission_id, tenant_id, property_id, reservation_id,
         agent_id, company_id, commission_type, room_revenue,
         room_commission_rate, gross_commission_amount,
         currency_code, payment_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::uuid, $6::uuid, $7, $8,
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
      `INSERT INTO commission_tracking (
         tracking_id, tenant_id, property_id, reservation_id,
         commission_type, beneficiary_type, beneficiary_id,
         base_amount, commission_rate, calculated_amount,
         final_amount, currency_code, status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'booking', 'agent', $5::uuid,
         $6, $7, $8,
         $8, $9, 'pending',
         $10::uuid, $10::uuid
       )`,
      [
        trackingId,
        tenantId,
        command.property_id,
        command.reservation_id,
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
     SET status = 'approved', approved_at = NOW(), approved_by = $3::uuid, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND status = 'pending'`,
    [command.commission_id, tenantId, command.approved_by],
  );

  appLogger.info({ commissionId: command.commission_id }, "Commission approved");
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
     SET status = 'paid', paid_at = NOW(), payment_reference = $3, updated_at = NOW()
     WHERE reservation_id = (
       SELECT reservation_id FROM travel_agent_commissions WHERE commission_id = $1 AND tenant_id = $2
     ) AND tenant_id = $2 AND status IN ('pending', 'approved')`,
    [command.commission_id, tenantId, command.payment_reference],
  );

  appLogger.info(
    { commissionId: command.commission_id, paymentRef: command.payment_reference },
    "Commission marked as paid",
  );
  return command.commission_id;
};

/**
 * Generate a periodic commission statement for an agent/company.
 */
export const generateCommissionStatement = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = CommissionStatementGenerateCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;

  // Aggregate commissions for the period
  const agentFilter = command.agent_id
    ? ` AND tac.agent_id = '${command.agent_id}'`
    : command.company_id
      ? ` AND tac.company_id = '${command.company_id}'`
      : "";

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
       COALESCE(SUM(r.nights), 0) AS total_room_nights,
       COALESCE(SUM(tac.room_revenue), 0) AS total_revenue,
       COALESCE(SUM(tac.gross_commission_amount), 0) AS total_gross,
       tac.company_id, tac.agent_id
     FROM travel_agent_commissions tac
     LEFT JOIN reservations r ON r.id = tac.reservation_id AND r.tenant_id = tac.tenant_id
     WHERE tac.tenant_id = $1
       AND tac.property_id = $2
       AND tac.created_at >= $3
       AND tac.created_at < $4
       ${agentFilter}
     GROUP BY tac.company_id, tac.agent_id`,
    [tenantId, command.property_id, command.period_start, command.period_end],
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
      `INSERT INTO commission_statements (
         statement_id, tenant_id, property_id, company_id, agent_id,
         statement_number, statement_date, period_start, period_end,
         total_bookings, total_room_nights, total_revenue,
         gross_commission, net_commission,
         currency_code, statement_status,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         $6, CURRENT_DATE, $7, $8,
         $9, $10, $11, $12, $12,
         $13, 'DRAFT',
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
