import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingNightAuditCommandSchema } from "../../schemas/billing-commands.js";
import { asUuid, type CommandContext, resolveActorId, SYSTEM_ACTOR_ID } from "./common.js";

/**
 * Execute the nightly audit process (industry-standard 10-step sequence):
 * 1. Lock postings (prevent new charges during audit)
 * 2. Post room+tax charges for all CHECKED_IN reservations (supports compound taxes)
 * 3. Post package component charges for in-house guests with active packages
 * 4. Post OTA commission accruals for reservations checked in today
 * 5. Mark stale PENDING/CONFIRMED reservations as NO_SHOW
 * 6. Generate trial balance (debits = credits verification)
 * 7. Advance the business date
 * 8. Unlock postings
 */
export const executeNightAudit = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingNightAuditCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const shouldPostCharges = command.post_room_charges !== false;
  const shouldPostPackages = command.post_package_charges !== false;
  const shouldPostCommissions = command.post_ota_commissions !== false;
  const shouldUseCompoundTaxes = command.use_compound_taxes === true;
  const shouldMarkNoShows = command.mark_no_shows !== false;
  const shouldAdvanceDate = command.advance_date !== false;
  const shouldLockPostings = command.lock_postings !== false;
  const shouldGenerateTrialBalance = command.generate_trial_balance !== false;

  const auditRunId = randomUUID();
  const auditStartedAt = new Date();

  // Resolve current business date
  const bizDateResult = await query<{ business_date: string }>(
    `SELECT business_date::text AS business_date FROM public.business_dates
     WHERE property_id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.property_id, context.tenantId],
  );
  const businessDate = command.business_date ?? bizDateResult.rows[0]?.business_date;
  const auditDate = businessDate ?? new Date().toISOString().slice(0, 10);

  let chargesPosted = 0;
  let noShowsMarked = 0;
  let taxChargesPosted = 0;
  let packageChargesPosted = 0;
  let commissionsPosted = 0;
  let trialBalanceVariance = 0;

  // Step 1: Lock postings — prevent new charges during audit
  if (shouldLockPostings) {
    await query(
      `UPDATE public.business_dates
       SET allow_postings = false, updated_at = NOW(), updated_by = $3
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, actorId],
    );
  }

  try {
    // Step 2: Post room charges + taxes for in-house guests
    if (shouldPostCharges) {
      const result = await postRoomChargesAndTaxes(
        context.tenantId,
        command.property_id,
        auditDate,
        actorId,
        shouldUseCompoundTaxes,
      );
      chargesPosted = result.chargesPosted;
      taxChargesPosted = result.taxChargesPosted;
    }

    // Step 3: Post package component charges
    if (shouldPostPackages) {
      packageChargesPosted = await postPackageCharges(
        context.tenantId,
        command.property_id,
        auditDate,
        actorId,
      );
    }

    // Step 4: Post OTA commission accruals
    if (shouldPostCommissions) {
      commissionsPosted = await postOtaCommissions(
        context.tenantId,
        command.property_id,
        auditDate,
        actorId,
      );
    }

    // Step 5: Mark no-shows
    if (shouldMarkNoShows) {
      const noShowResult = await query<{ count: string }>(
        `UPDATE reservations
         SET status = 'NO_SHOW', is_no_show = true,
             no_show_date = NOW(), no_show_fee = COALESCE(room_rate, 0),
             version = version + 1, updated_at = NOW()
         WHERE tenant_id = $1 AND property_id = $2
           AND status IN ('PENDING', 'CONFIRMED')
           AND check_in_date <= $3::date
           AND is_deleted = false
         RETURNING id`,
        [context.tenantId, command.property_id, auditDate],
      );
      noShowsMarked = noShowResult.rowCount ?? 0;
    }

    // Step 6: Generate trial balance (debits = credits)
    if (shouldGenerateTrialBalance) {
      trialBalanceVariance = await computeTrialBalance(
        context.tenantId,
        command.property_id,
        auditDate,
      );
      if (trialBalanceVariance !== 0) {
        appLogger.warn(
          {
            tenantId: context.tenantId,
            propertyId: command.property_id,
            auditDate,
            variance: trialBalanceVariance,
          },
          "Night audit trial balance has non-zero variance",
        );
      }
    }

    // Step 7: Advance business date
    if (shouldAdvanceDate) {
      await query(
        `UPDATE public.business_dates
         SET business_date = ($3::date + INTERVAL '1 day')::date,
             previous_business_date = $3::date,
             updated_at = NOW(), updated_by = $4
         WHERE property_id = $1 AND tenant_id = $2`,
        [command.property_id, context.tenantId, auditDate, actorId],
      );
    }
  } finally {
    // Step 8: Unlock postings
    if (shouldLockPostings) {
      await query(
        `UPDATE public.business_dates
         SET allow_postings = true, updated_at = NOW(), updated_by = $3
         WHERE property_id = $1 AND tenant_id = $2`,
        [command.property_id, context.tenantId, actorId],
      );
    }
  }

  // Log audit run in night_audit_log
  const totalRecords = chargesPosted + noShowsMarked + packageChargesPosted + commissionsPosted;
  const auditLogResult = await query<{ audit_log_id: string }>(
    `INSERT INTO public.night_audit_log (
       tenant_id, property_id, audit_run_id, business_date,
       audit_status, step_number, step_name, step_category, step_status,
       started_at, completed_at, step_completed_at,
       records_processed, records_succeeded,
       initiated_by, created_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::date,
       'COMPLETED', 1, 'night_audit_full', 'AUDIT', 'COMPLETED',
       $5::timestamptz, NOW(), NOW(),
       $6, $6,
       $7::uuid, $7::uuid
     )
     ON CONFLICT DO NOTHING
     RETURNING audit_log_id`,
    [
      context.tenantId,
      command.property_id,
      auditRunId,
      auditDate,
      auditStartedAt.toISOString(),
      totalRecords,
      actorId,
    ],
  );

  appLogger.info(
    {
      auditDate,
      chargesPosted,
      taxChargesPosted,
      packageChargesPosted,
      commissionsPosted,
      noShowsMarked,
      trialBalanceVariance,
      auditRunId,
    },
    "Night audit completed",
  );

  return auditLogResult.rows[0]?.audit_log_id ?? `audit-${auditDate}`;
};

// ─── Step 2: Room charges + taxes (supports compound tax calculation) ───

async function postRoomChargesAndTaxes(
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
  useCompoundTaxes: boolean,
): Promise<{ chargesPosted: number; taxChargesPosted: number }> {
  let chargesPosted = 0;
  let taxChargesPosted = 0;

  const inHouseResult = await query<{
    id: string;
    room_rate: string;
    room_number: string;
    total_amount: string;
    guest_id: string;
    folio_id: string | null;
  }>(
    `SELECT r.id, r.room_rate, r.room_number, r.total_amount, r.guest_id,
            f.folio_id
     FROM reservations r
     LEFT JOIN LATERAL (
       SELECT folio_id FROM public.folios
       WHERE tenant_id = $1 AND reservation_id = r.id
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at DESC LIMIT 1
     ) f ON true
     WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false`,
    [tenantId, propertyId],
  );

  // Fetch tax config ONCE: include compound order for cascading tax support
  const taxResult = await query<{
    tax_code: string;
    tax_name: string;
    tax_rate: string;
    is_compound_tax: boolean;
    compound_order: number | null;
  }>(
    `SELECT tax_code, tax_name, tax_rate,
            COALESCE(is_compound_tax, false) AS is_compound_tax,
            compound_order
     FROM tax_configurations
     WHERE tenant_id = $1::uuid
       AND (property_id = $2::uuid OR property_id IS NULL)
       AND is_active = TRUE
       AND effective_from <= $3::date
       AND (effective_to IS NULL OR effective_to >= $3::date)
       AND 'rooms' = ANY(applies_to)
       AND is_percentage = TRUE
     ORDER BY COALESCE(compound_order, 0), tax_code`,
    [tenantId, propertyId, auditDate],
  );
  const taxes = taxResult.rows;

  for (const res of inHouseResult.rows) {
    const roomRate = Number(res.room_rate ?? 0);
    if (roomRate <= 0) continue;

    const folioId = res.folio_id;
    if (!folioId) continue;

    try {
      await withTransaction(async (client) => {
        // Post room charge
        await queryWithClient(
          client,
          `INSERT INTO public.charge_postings (
             tenant_id, property_id, folio_id, reservation_id,
             transaction_type, posting_type, charge_code, charge_description,
             quantity, unit_price, subtotal, total_amount,
             currency_code, posting_time, business_date,
             notes, created_by, updated_by
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4::uuid,
             'CHARGE', 'DEBIT', 'ROOM', 'Room charge - night audit',
             1, $5, $5, $5,
             'USD', NOW(), $6::date,
             'Auto-posted by night audit', $7::uuid, $7::uuid
           )`,
          [tenantId, propertyId, folioId, res.id, roomRate, auditDate, actorId],
        );

        // Post applicable taxes — compound taxes apply sequentially on base + prior taxes
        let totalTaxAmount = 0;
        let taxableBase = roomRate;
        for (const tax of taxes) {
          const taxRate = Number(tax.tax_rate);
          // Compound taxes apply on (room rate + all prior tax amounts)
          if (useCompoundTaxes && tax.is_compound_tax) {
            taxableBase = roomRate + totalTaxAmount;
          } else {
            taxableBase = roomRate;
          }
          const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
          if (taxAmount <= 0) continue;

          await queryWithClient(
            client,
            `INSERT INTO public.charge_postings (
               tenant_id, property_id, folio_id, reservation_id,
               transaction_type, posting_type, charge_code, charge_description,
               quantity, unit_price, subtotal, total_amount,
               currency_code, posting_time, business_date,
               department_code, notes, created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, $4::uuid,
               'CHARGE', 'DEBIT', 'ROOM_TAX', $5,
               1, $6, $6, $6,
               'USD', NOW(), $7::date,
               'ROOMS', $8, $9::uuid, $9::uuid
             )`,
            [
              tenantId,
              propertyId,
              folioId,
              res.id,
              `${tax.tax_name} (${taxRate}%)`,
              taxAmount,
              auditDate,
              `${tax.tax_code}: ${taxRate}% on ${useCompoundTaxes && tax.is_compound_tax ? "cumulative" : "room"} charge`,
              actorId,
            ],
          );
          totalTaxAmount += taxAmount;
          taxChargesPosted++;
        }

        // Update folio balance (room charge + all taxes)
        const chargeTotal = roomRate + totalTaxAmount;
        await queryWithClient(
          client,
          `UPDATE public.folios
           SET total_charges = total_charges + $2,
               balance = balance + $2,
               updated_at = NOW(), updated_by = $3::uuid
           WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
          [tenantId, chargeTotal, actorId, folioId],
        );
      });
      chargesPosted++;
    } catch (error) {
      appLogger.error(
        { tenantId, propertyId, reservationId: res.id, folioId, auditDate, error },
        "Night audit: failed to post nightly room charges for reservation",
      );
    }
  }

  return { chargesPosted, taxChargesPosted };
}

// ─── Step 3: Post package component charges ───

async function postPackageCharges(
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
): Promise<number> {
  let packageChargesPosted = 0;

  // Find in-house reservations that have active package bookings with per_night components
  const packageResult = await query<{
    reservation_id: string;
    folio_id: string;
    component_name: string;
    unit_price: string;
    charge_code: string;
    department_code: string;
    package_booking_id: string;
  }>(
    `SELECT r.id AS reservation_id, f.folio_id,
            pc.component_name, pc.unit_price,
            COALESCE(pc.charge_code, 'PACKAGE') AS charge_code,
            COALESCE(pc.department_code, 'OTHER') AS department_code,
            pb.id AS package_booking_id
     FROM reservations r
     INNER JOIN package_bookings pb
       ON pb.reservation_id = r.id AND pb.tenant_id = r.tenant_id
       AND pb.status IN ('confirmed', 'active')
     INNER JOIN package_components pc
       ON pc.package_id = pb.package_id AND pc.tenant_id = pb.tenant_id
       AND pc.pricing_type = 'per_night'
       AND pc.is_included = true
     LEFT JOIN LATERAL (
       SELECT folio_id FROM public.folios
       WHERE tenant_id = $1 AND reservation_id = r.id
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at DESC LIMIT 1
     ) f ON true
     WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
       AND f.folio_id IS NOT NULL`,
    [tenantId, propertyId],
  );

  for (const pkg of packageResult.rows) {
    const price = Number(pkg.unit_price ?? 0);
    if (price <= 0) continue;

    try {
      await withTransaction(async (client) => {
        await queryWithClient(
          client,
          `INSERT INTO public.charge_postings (
             tenant_id, property_id, folio_id, reservation_id,
             transaction_type, posting_type, charge_code, charge_description,
             quantity, unit_price, subtotal, total_amount,
             currency_code, posting_time, business_date,
             department_code, notes, created_by, updated_by
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4::uuid,
             'CHARGE', 'DEBIT', $5, $6,
             1, $7, $7, $7,
             'USD', NOW(), $8::date,
             $9, 'Package component - night audit', $10::uuid, $10::uuid
           )`,
          [
            tenantId,
            propertyId,
            pkg.folio_id,
            pkg.reservation_id,
            pkg.charge_code,
            `Package: ${pkg.component_name}`,
            price,
            auditDate,
            pkg.department_code,
            actorId,
          ],
        );

        await queryWithClient(
          client,
          `UPDATE public.folios
           SET total_charges = total_charges + $2,
               balance = balance + $2,
               updated_at = NOW(), updated_by = $3::uuid
           WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
          [tenantId, price, actorId, pkg.folio_id],
        );
      });
      packageChargesPosted++;
    } catch (error) {
      appLogger.error(
        { tenantId, propertyId, reservationId: pkg.reservation_id, auditDate, error },
        "Night audit: failed to post package charge",
      );
    }
  }

  return packageChargesPosted;
}

// ─── Step 4: Post OTA commission accruals ───

async function postOtaCommissions(
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
): Promise<number> {
  let commissionsPosted = 0;

  // Find in-house OTA reservations without commission already tracked for this date
  const otaResult = await query<{
    reservation_id: string;
    room_rate: string;
    source: string;
    commission_percentage: string;
    booking_source_id: string;
  }>(
    `SELECT r.id AS reservation_id, r.room_rate, r.source,
            bs.commission_percentage, bs.id AS booking_source_id
     FROM reservations r
     INNER JOIN booking_sources bs
       ON bs.tenant_id = r.tenant_id
       AND bs.source_code = r.source
       AND bs.commission_type = 'PERCENTAGE'
       AND bs.commission_percentage > 0
     WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
       AND r.source IN ('ota', 'channel_manager')
       AND NOT EXISTS (
         SELECT 1 FROM commission_tracking ct
         WHERE ct.reservation_id = r.id AND ct.tenant_id = r.tenant_id
           AND ct.business_date = $3::date
       )`,
    [tenantId, propertyId, auditDate],
  );

  for (const ota of otaResult.rows) {
    const roomRate = Number(ota.room_rate ?? 0);
    const commPct = Number(ota.commission_percentage ?? 0);
    if (roomRate <= 0 || commPct <= 0) continue;

    const commissionAmount = Number(((roomRate * commPct) / 100).toFixed(2));

    try {
      await query(
        `INSERT INTO commission_tracking (
           tenant_id, property_id, reservation_id, booking_source_id,
           commission_amount, commission_percentage, commission_base_amount,
           business_date, status, commission_type,
           notes, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           $5, $6, $7,
           $8::date, 'pending', 'PERCENTAGE',
           'Auto-accrued by night audit', $9::uuid, $9::uuid
         )
         ON CONFLICT DO NOTHING`,
        [
          tenantId,
          propertyId,
          ota.reservation_id,
          ota.booking_source_id,
          commissionAmount,
          commPct,
          roomRate,
          auditDate,
          actorId,
        ],
      );
      commissionsPosted++;
    } catch (error) {
      appLogger.error(
        { tenantId, propertyId, reservationId: ota.reservation_id, auditDate, error },
        "Night audit: failed to post OTA commission",
      );
    }
  }

  return commissionsPosted;
}

// ─── Step 6: Trial balance (debits = credits verification) ───

async function computeTrialBalance(
  tenantId: string,
  propertyId: string,
  auditDate: string,
): Promise<number> {
  const result = await query<{
    total_debits: string;
    total_credits: string;
    variance: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN posting_type = 'DEBIT' THEN total_amount ELSE 0 END), 0) AS total_debits,
       COALESCE(SUM(CASE WHEN posting_type = 'CREDIT' THEN total_amount ELSE 0 END), 0) AS total_credits,
       COALESCE(SUM(CASE WHEN posting_type = 'DEBIT' THEN total_amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN posting_type = 'CREDIT' THEN total_amount ELSE 0 END), 0) -
       COALESCE((SELECT SUM(amount) FROM payments
                 WHERE tenant_id = $1::uuid AND property_id = $2::uuid
                   AND business_date = $3::date AND status = 'COMPLETED'
                   AND transaction_type IN ('CAPTURE', 'REFUND', 'PARTIAL_REFUND')), 0) AS variance
     FROM charge_postings
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND business_date = $3::date
       AND COALESCE(is_voided, false) = false`,
    [tenantId, propertyId, auditDate],
  );

  return Number(result.rows[0]?.variance ?? 0);
}
