import { randomUUID } from "node:crypto";
import type { NightAuditCheckpointStatus } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingNightAuditCommandSchema } from "../../schemas/billing-commands.js";
import { asUuid, type CommandContext, resolveActorId, SYSTEM_ACTOR_ID } from "./common.js";
import { buildGlBatchForDate } from "./ledger.js";

/**
 * Execute the nightly audit process (industry-standard 8-step sequence):
 * 1. Lock postings (prevent new charges during audit) — outside main TX
 * 2–5. All charge posting steps run inside a SINGLE database transaction:
 *       2. Post room+tax charges for all CHECKED_IN reservations
 *       3. Post package component charges for in-house guests
 *       4. Post OTA commission accruals
 *       5. Mark stale PENDING/CONFIRMED reservations as NO_SHOW
 *      On any failure the entire transaction rolls back atomically.
 *      Each completed step writes a night_audit_checkpoints row inside
 *      the same transaction so checkpoints are never orphaned.
 * 6. Generate trial balance (read-only, outside main TX)
 * 7. Advance the business date — outside main TX
 * 8. Unlock postings — outside main TX
 *
 * Idempotency: before posting room charges the function checks whether
 * non-voided audit charges already exist for this property + business_date.
 * If they do the entire charge-posting phase is skipped, preventing
 * double-posting when the same command is retried.
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
  let trialBalanceMismatches: TrialBalanceMismatch[] = [];
  // Tracks the last step to complete so the catch path can record the failed step.
  let lastCompletedStep = 1;
  let auditFailureError: Error | undefined;

  // Step 1: Lock postings — prevent new charges during audit (outside main TX)
  if (shouldLockPostings) {
    await query(
      `UPDATE public.business_dates
       SET allow_postings = false,
           night_audit_status = 'IN_PROGRESS',
           night_audit_started_at = NOW(),
           night_audit_started_by = $3::uuid,
           is_locked = true, locked_at = NOW(), locked_by = $3::uuid,
           updated_at = NOW(), updated_by = $3
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, actorId],
    );
  }

  let auditSucceeded = false;
  try {
    // ── Steps 2–5: single atomic transaction ───────────────────────────────
    // All charge postings, commission accruals, and no-show updates are
    // executed inside one PostgreSQL transaction.  Any failure causes a full
    // rollback — no partial charges survive a failed audit run.
    await withTransaction(async (client) => {
      // ── Idempotency guard ──────────────────────────────────────────────
      // Skip charge posting entirely if a prior successful audit already
      // posted charges for this property + business_date.  This prevents
      // double-posting when the same command is replayed by Kafka or an
      // operator retries a completed audit.
      if (shouldPostCharges || shouldPostPackages || shouldPostCommissions) {
        const { rows: existingCharges } = await queryWithClient<{ cnt: string }>(
          client,
          `SELECT COUNT(*) AS cnt
           FROM charge_postings
           WHERE tenant_id = $1::uuid
             AND property_id = $2::uuid
             AND business_date = $3::date
             AND audit_run_id IS NOT NULL
             AND COALESCE(is_voided, false) = false
           LIMIT 1`,
          [context.tenantId, command.property_id, auditDate],
        );
        if (Number(existingCharges[0]?.cnt ?? 0) > 0) {
          appLogger.warn(
            { tenantId: context.tenantId, propertyId: command.property_id, auditDate },
            "Night audit: charges already exist for this business date — skipping charge posting (idempotency guard)",
          );
          // Mark the posting steps as skipped and continue to no-shows / trial balance
          await insertCheckpoint(
            client,
            context.tenantId,
            command.property_id,
            auditRunId,
            actorId,
            2,
            "room-charges",
            "SKIPPED",
            0,
          );
          await insertCheckpoint(
            client,
            context.tenantId,
            command.property_id,
            auditRunId,
            actorId,
            3,
            "package-charges",
            "SKIPPED",
            0,
          );
          await insertCheckpoint(
            client,
            context.tenantId,
            command.property_id,
            auditRunId,
            actorId,
            4,
            "ota-commissions",
            "SKIPPED",
            0,
          );
          // Fall through to no-shows below
          if (shouldMarkNoShows) {
            const { rowCount } = await queryWithClient(
              client,
              `UPDATE reservations
               SET status = 'NO_SHOW', is_no_show = true,
                   no_show_date = NOW(), no_show_fee = COALESCE(room_rate, 0),
                   version = version + 1, updated_at = NOW()
               WHERE tenant_id = $1 AND property_id = $2
                 AND status IN ('PENDING', 'CONFIRMED')
                 AND check_in_date <= $3::date
                 AND is_deleted = false`,
              [context.tenantId, command.property_id, auditDate],
            );
            noShowsMarked = rowCount ?? 0;
            await insertCheckpoint(
              client,
              context.tenantId,
              command.property_id,
              auditRunId,
              actorId,
              5,
              "no-shows",
              "COMPLETED",
              noShowsMarked,
            );
          }
          return; // exit withTransaction callback early
        }
      }

      // Step 2: Post room charges + taxes for in-house guests
      if (shouldPostCharges) {
        const result = await postRoomChargesAndTaxes(
          client,
          context.tenantId,
          command.property_id,
          auditDate,
          actorId,
          auditRunId,
          shouldUseCompoundTaxes,
        );
        chargesPosted = result.chargesPosted;
        taxChargesPosted = result.taxChargesPosted;
      }
      await insertCheckpoint(
        client,
        context.tenantId,
        command.property_id,
        auditRunId,
        actorId,
        2,
        "room-charges",
        shouldPostCharges ? "COMPLETED" : "SKIPPED",
        chargesPosted,
      );
      lastCompletedStep = 2;

      // Step 3: Post package component charges
      if (shouldPostPackages) {
        packageChargesPosted = await postPackageCharges(
          client,
          context.tenantId,
          command.property_id,
          auditDate,
          actorId,
          auditRunId,
        );
      }
      await insertCheckpoint(
        client,
        context.tenantId,
        command.property_id,
        auditRunId,
        actorId,
        3,
        "package-charges",
        shouldPostPackages ? "COMPLETED" : "SKIPPED",
        packageChargesPosted,
      );
      lastCompletedStep = 3;

      // Step 4: Post OTA commission accruals
      if (shouldPostCommissions) {
        commissionsPosted = await postOtaCommissions(
          client,
          context.tenantId,
          command.property_id,
          auditDate,
          actorId,
        );
      }
      await insertCheckpoint(
        client,
        context.tenantId,
        command.property_id,
        auditRunId,
        actorId,
        4,
        "ota-commissions",
        shouldPostCommissions ? "COMPLETED" : "SKIPPED",
        commissionsPosted,
      );
      lastCompletedStep = 4;

      // Step 5: Mark no-shows
      if (shouldMarkNoShows) {
        const { rowCount } = await queryWithClient(
          client,
          `UPDATE reservations
           SET status = 'NO_SHOW', is_no_show = true,
               no_show_date = NOW(), no_show_fee = COALESCE(room_rate, 0),
               version = version + 1, updated_at = NOW()
           WHERE tenant_id = $1 AND property_id = $2
             AND status IN ('PENDING', 'CONFIRMED')
             AND check_in_date <= $3::date
             AND is_deleted = false`,
          [context.tenantId, command.property_id, auditDate],
        );
        noShowsMarked = rowCount ?? 0;
      }
      await insertCheckpoint(
        client,
        context.tenantId,
        command.property_id,
        auditRunId,
        actorId,
        5,
        "no-shows",
        shouldMarkNoShows ? "COMPLETED" : "SKIPPED",
        noShowsMarked,
      );
      lastCompletedStep = 5;
    });
    // ── end single atomic transaction ─────────────────────────────────────

    // Step 6: Generate trial balance (read-only, outside main TX)
    if (shouldGenerateTrialBalance) {
      const tb = await computeTrialBalance(context.tenantId, command.property_id, auditDate);
      trialBalanceVariance = tb.variance;
      trialBalanceMismatches = tb.mismatches;
      if (trialBalanceVariance !== 0) {
        appLogger.warn(
          {
            tenantId: context.tenantId,
            propertyId: command.property_id,
            auditDate,
            variance: trialBalanceVariance,
            totalDebits: tb.totalDebits,
            totalCredits: tb.totalCredits,
            totalPayments: tb.totalPayments,
            // Per-folio breakdown: which folios and charge types are unbalanced.
            // Capped at 50 rows to keep log size bounded; full data queryable
            // via GET /v1/billing/trial-balance?date=<auditDate>&propertyId=<id>
            mismatchCount: trialBalanceMismatches.length,
            mismatches: trialBalanceMismatches.slice(0, 50),
          },
          "Night audit trial balance has non-zero variance",
        );
      }
    }

    // Step 6.5: Rebuild GL batch for the audit date (outside main TX)
    // This converts charge_postings and payments into USALI-aligned double-entry
    // GL entries.  It runs after trial balance so all charges are already posted.
    // Failure here is non-fatal — the audit is still considered successful;
    // operators can re-run billing.ledger.post manually.
    try {
      const glBatchId = await buildGlBatchForDate(command.property_id, auditDate, context);
      appLogger.info(
        { auditDate, glBatchId, tenantId: context.tenantId, propertyId: command.property_id },
        "Night audit: GL batch rebuilt",
      );
    } catch (glErr) {
      appLogger.error(
        { glErr, auditDate, tenantId: context.tenantId, propertyId: command.property_id },
        "Night audit: GL batch rebuild failed (non-fatal) — run billing.ledger.post manually",
      );
    }

    auditSucceeded = true;
  } catch (err) {
    // ── Error path: write a FAILED checkpoint OUTSIDE the transaction ──────
    // The main TX has already rolled back, so all COMPLETED/SKIPPED checkpoints
    // inside it are gone.  We write one FAILED row here so recovery tooling can
    // see exactly which step threw (lastCompletedStep + 1 = the failing step).
    auditFailureError = err instanceof Error ? err : new Error(String(err));
    const failedStep = lastCompletedStep + 1;
    const stepNames: Record<number, string> = {
      2: "room-charges",
      3: "package-charges",
      4: "ota-commissions",
      5: "no-shows",
      6: "trial-balance",
      7: "gl-batch-rebuild",
    };
    try {
      await query(
        `INSERT INTO night_audit_checkpoints
           (tenant_id, property_id, audit_run_id, step_number, step_name,
            status, records_processed, completed_at, created_by)
         VALUES
           ($1::uuid, $2::uuid, $3::uuid, $4, $5,
            'FAILED', 0, NOW(), $6::uuid)
         ON CONFLICT (audit_run_id, step_number) DO NOTHING`,
        [
          context.tenantId,
          command.property_id,
          auditRunId,
          failedStep,
          stepNames[failedStep] ?? `step-${failedStep}`,
          actorId,
        ],
      );
    } catch (checkpointErr) {
      appLogger.error(
        { checkpointErr, auditRunId, failedStep },
        "Night audit: failed to write FAILED checkpoint — continuing to finally block",
      );
    }
    appLogger.error(
      {
        err: auditFailureError.message,
        auditRunId,
        auditDate,
        lastCompletedStep,
        failedStep,
        tenantId: context.tenantId,
        propertyId: command.property_id,
      },
      "Night audit failed — transaction rolled back, no charges posted",
    );
  } finally {
    // Step 7+8: Advance business date + unlock postings + set audit status
    // Combined into a single UPDATE for atomicity — readers never see
    // an advanced date without COMPLETED status.
    // Only advance the date when the audit succeeded; failed audits must
    // never roll the business date forward.
    if (shouldAdvanceDate && auditSucceeded) {
      await query(
        `UPDATE public.business_dates
         SET business_date = ($3::date + INTERVAL '1 day')::date,
             previous_business_date = $3::date,
             date_rolled_at = NOW(), date_rolled_by = $4::uuid,
             allow_postings = true,
             night_audit_status = 'COMPLETED',
             night_audit_completed_at = NOW(),
             night_audit_completed_by = $4::uuid,
             is_locked = false,
             updated_at = NOW(), updated_by = $4
         WHERE property_id = $1 AND tenant_id = $2`,
        [command.property_id, context.tenantId, auditDate, actorId],
      );
    } else if (shouldLockPostings || shouldAdvanceDate) {
      // Unlock postings + record status (FAILED when audit didn't succeed,
      // COMPLETED when advance wasn't requested but audit passed)
      await query(
        `UPDATE public.business_dates
         SET allow_postings = true,
             night_audit_status = $4,
             night_audit_completed_at = NOW(),
             night_audit_completed_by = $3::uuid,
             is_locked = false,
             updated_at = NOW(), updated_by = $3
         WHERE property_id = $1 AND tenant_id = $2`,
        [command.property_id, context.tenantId, actorId, auditSucceeded ? "COMPLETED" : "FAILED"],
      );
    } else {
      // Neither locking nor advancing — still record audit status
      await query(
        `UPDATE public.business_dates
         SET night_audit_status = $3,
             night_audit_completed_at = NOW(),
             night_audit_completed_by = $4::uuid,
             updated_at = NOW(), updated_by = $4
         WHERE property_id = $1 AND tenant_id = $2`,
        [command.property_id, context.tenantId, auditSucceeded ? "COMPLETED" : "FAILED", actorId],
      );
    }

    // Log audit run in night_audit_log — always written (success or failure)
    // so operators can see every attempt including failed ones.
    const totalRecords = chargesPosted + noShowsMarked + packageChargesPosted + commissionsPosted;
    const auditLogStatus = auditSucceeded ? "COMPLETED" : "FAILED";
    try {
      await query(
        `INSERT INTO public.night_audit_log (
           tenant_id, property_id, audit_run_id, business_date,
           audit_status, step_number, step_name, step_category, step_status,
           started_at, completed_at, step_completed_at,
           records_processed, records_succeeded,
           error_message, error_details,
           initiated_by, created_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::date,
           $5, 1, 'night_audit_full', 'AUDIT', $5,
           $6::timestamptz, NOW(), NOW(),
           $7, $7,
           $8, $9,
           $10::uuid, $10::uuid
         )
         ON CONFLICT DO NOTHING`,
        [
          context.tenantId,
          command.property_id,
          auditRunId,
          auditDate,
          auditLogStatus,
          auditStartedAt.toISOString(),
          totalRecords,
          auditFailureError?.message ?? null,
          auditFailureError
            ? JSON.stringify({ message: auditFailureError.message, lastCompletedStep })
            : null,
          actorId,
        ],
      );
    } catch (logErr) {
      appLogger.error({ logErr, auditRunId }, "Night audit: failed to write night_audit_log entry");
    }
  }

  if (auditFailureError) {
    throw auditFailureError;
  }

  appLogger.info(
    {
      auditDate,
      chargesPosted,
      taxChargesPosted,
      packageChargesPosted,
      commissionsPosted,
      noShowsMarked,
      trialBalanceVariance,
      trialBalanceBalanced: Math.abs(trialBalanceVariance) < 0.01,
      auditRunId,
    },
    "Night audit completed",
  );

  return auditRunId;
};

// ─── Step 2: Room charges + taxes (supports compound tax calculation) ───

async function postRoomChargesAndTaxes(
  client: PoolClient,
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
  auditRunId: string,
  useCompoundTaxes: boolean,
): Promise<{ chargesPosted: number; taxChargesPosted: number }> {
  let chargesPosted = 0;
  let taxChargesPosted = 0;

  const inHouseResult = await queryWithClient<{
    id: string;
    room_rate: string;
    room_number: string;
    total_amount: string;
    guest_id: string;
    folio_id: string | null;
  }>(
    client,
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
  const taxResult = await queryWithClient<{
    tax_code: string;
    tax_name: string;
    tax_rate: string;
    is_compound_tax: boolean;
    compound_order: number | null;
  }>(
    client,
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

    // Idempotency: skip if a non-voided room charge already exists for this
    // reservation on this business date from any prior audit run.
    const { rows: existing } = await queryWithClient<{ cnt: string }>(
      client,
      `SELECT COUNT(*) AS cnt FROM charge_postings
       WHERE tenant_id = $1::uuid AND reservation_id = $2::uuid
         AND business_date = $3::date AND charge_code = 'ROOM'
         AND audit_run_id IS NOT NULL
         AND COALESCE(is_voided, false) = false`,
      [tenantId, res.id, auditDate],
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) {
      appLogger.debug(
        { reservationId: res.id, auditDate },
        "Night audit: room charge already posted, skipping",
      );
      chargesPosted++; // count as posted for metrics
      continue;
    }

    // Post room charge (inside the outer withTransaction — no nested TX needed)
    await queryWithClient(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount,
         currency_code, posting_time, business_date,
         notes, audit_run_id, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'CHARGE', 'DEBIT', 'ROOM', 'Room charge - night audit',
         1, $5, $5, $5,
         'USD', NOW(), $6::date,
         'Auto-posted by night audit', $7::uuid, $8::uuid, $8::uuid
       )`,
      [tenantId, propertyId, folioId, res.id, roomRate, auditDate, auditRunId, actorId],
    );

    // Post applicable taxes — compound taxes apply sequentially on base + prior taxes
    let totalTaxAmount = 0;
    for (const tax of taxes) {
      const taxRate = Number(tax.tax_rate);
      // Compound taxes apply on (room rate + all prior tax amounts)
      const taxableBase =
        useCompoundTaxes && tax.is_compound_tax ? roomRate + totalTaxAmount : roomRate;
      const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
      if (taxAmount <= 0) continue;

      await queryWithClient(
        client,
        `INSERT INTO public.charge_postings (
           tenant_id, property_id, folio_id, reservation_id,
           transaction_type, posting_type, charge_code, charge_description,
           quantity, unit_price, subtotal, total_amount,
           currency_code, posting_time, business_date,
           department_code, notes, audit_run_id, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           'CHARGE', 'DEBIT', 'ROOM_TAX', $5,
           1, $6, $6, $6,
           'USD', NOW(), $7::date,
           'ROOMS', $8, $9::uuid, $10::uuid, $10::uuid
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
          auditRunId,
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
    chargesPosted++;
  }

  return { chargesPosted, taxChargesPosted };
}

// ─── Step 3: Post package component charges ───

async function postPackageCharges(
  client: PoolClient,
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
  auditRunId: string,
): Promise<number> {
  let packageChargesPosted = 0;

  // Find in-house reservations that have active package bookings with per_night components
  const packageResult = await queryWithClient<{
    reservation_id: string;
    folio_id: string;
    component_name: string;
    unit_price: string;
    charge_code: string;
    department_code: string;
    package_booking_id: string;
  }>(
    client,
    `SELECT r.id AS reservation_id, f.folio_id,
            pc.component_name, pc.unit_price,
            'PACKAGE' AS charge_code,
            'OTHER' AS department_code,
            pb.package_booking_id AS package_booking_id
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

    // Idempotency: skip if a package charge already exists for this reservation on this date
    const { rows: existing } = await queryWithClient<{ cnt: string }>(
      client,
      `SELECT COUNT(*) AS cnt FROM charge_postings
       WHERE tenant_id = $1::uuid AND reservation_id = $2::uuid
         AND business_date = $3::date AND charge_code = 'PACKAGE'
         AND audit_run_id IS NOT NULL
         AND COALESCE(is_voided, false) = false`,
      [tenantId, pkg.reservation_id, auditDate],
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) {
      packageChargesPosted++;
      continue;
    }

    await queryWithClient(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount,
         currency_code, posting_time, business_date,
         department_code, notes, audit_run_id, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'CHARGE', 'DEBIT', $5, $6,
         1, $7, $7, $7,
         'USD', NOW(), $8::date,
         $9, 'Package component - night audit', $10::uuid, $11::uuid, $11::uuid
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
        auditRunId,
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
    packageChargesPosted++;
  }

  return packageChargesPosted;
}

// ─── Step 4: Post OTA commission accruals ───

async function postOtaCommissions(
  client: PoolClient,
  tenantId: string,
  propertyId: string,
  auditDate: string,
  actorId: string,
): Promise<number> {
  let commissionsPosted = 0;

  // Find in-house OTA reservations without commission already tracked for this date
  const otaResult = await queryWithClient<{
    reservation_id: string;
    room_rate: string;
    source: string;
    commission_percentage: string;
    booking_source_id: string;
  }>(
    client,
    `SELECT r.id AS reservation_id, r.room_rate, r.source::text,
            bs.commission_percentage, bs.source_id AS booking_source_id
     FROM reservations r
     INNER JOIN booking_sources bs
       ON bs.tenant_id = r.tenant_id
       AND bs.source_code = r.source::text
       AND bs.commission_type = 'PERCENTAGE'
       AND bs.commission_percentage > 0
     WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
       AND r.source IN ('OTA'::reservation_source, 'CORPORATE'::reservation_source)
       AND NOT EXISTS (
         SELECT 1 FROM commission_tracking ct
         WHERE ct.reservation_id = r.id AND ct.tenant_id = r.tenant_id
           AND ct.transaction_date = $3::date
       )`,
    [tenantId, propertyId, auditDate],
  );

  for (const ota of otaResult.rows) {
    const roomRate = Number(ota.room_rate ?? 0);
    const commPct = Number(ota.commission_percentage ?? 0);
    if (roomRate <= 0 || commPct <= 0) continue;

    const commissionAmount = Number(((roomRate * commPct) / 100).toFixed(2));
    const commissionNumber = `COMM-${ota.reservation_id.slice(0, 8)}-${auditDate}`;

    await queryWithClient(
      client,
      `INSERT INTO commission_tracking (
         tenant_id, property_id, reservation_id, source_id,
         commission_number, commission_amount, commission_percent, base_amount,
         transaction_date, commission_status, commission_type,
         calculation_method, notes, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5, $6, $7, $8,
         $9::date, 'pending', 'ota',
         'percentage', 'Auto-accrued by night audit', $10::uuid, $10::uuid
       )
       ON CONFLICT DO NOTHING`,
      [
        tenantId,
        propertyId,
        ota.reservation_id,
        ota.booking_source_id,
        commissionNumber,
        commissionAmount,
        commPct,
        roomRate,
        auditDate,
        actorId,
      ],
    );
    commissionsPosted++;
  }

  return commissionsPosted;
}

// ─── Checkpoint helper ───

/**
 * Write a step completion record into night_audit_checkpoints.
 * Must be called inside an active transaction so the checkpoint commits
 * atomically with the charge postings it describes.
 */
async function insertCheckpoint(
  client: PoolClient,
  tenantId: string,
  propertyId: string,
  auditRunId: string,
  actorId: string,
  stepNumber: number,
  stepName: string,
  status: NightAuditCheckpointStatus,
  recordsProcessed: number,
): Promise<void> {
  await queryWithClient(
    client,
    `INSERT INTO night_audit_checkpoints
       (tenant_id, property_id, audit_run_id, step_number, step_name,
        status, records_processed, completed_at, created_by)
     VALUES
       ($1::uuid, $2::uuid, $3::uuid, $4, $5,
        $6, $7, NOW(), $8::uuid)
     ON CONFLICT (audit_run_id, step_number) DO NOTHING`,
    [tenantId, propertyId, auditRunId, stepNumber, stepName, status, recordsProcessed, actorId],
  );
}

// ─── Step 6: Trial balance (debits = credits verification) ───

type TrialBalanceMismatch = {
  folio_id: string | null;
  reservation_id: string | null;
  charge_code: string | null;
  debit_total: number;
  credit_total: number;
  net: number;
};

type TrialBalanceResult = {
  variance: number;
  totalDebits: number;
  totalCredits: number;
  totalPayments: number;
  mismatches: TrialBalanceMismatch[];
};

async function computeTrialBalance(
  tenantId: string,
  propertyId: string,
  auditDate: string,
): Promise<TrialBalanceResult> {
  // Totals query — single aggregate for variance calculation
  const totalsResult = await query<{
    total_debits: string;
    total_credits: string;
    total_payments: string;
    variance: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN posting_type = 'DEBIT' THEN total_amount ELSE 0 END), 0) AS total_debits,
       COALESCE(SUM(CASE WHEN posting_type = 'CREDIT' THEN total_amount ELSE 0 END), 0) AS total_credits,
       COALESCE((SELECT SUM(amount) FROM payments
                 WHERE tenant_id = $1::uuid AND property_id = $2::uuid
                   AND processed_at::date = $3::date AND status = 'COMPLETED'
                   AND transaction_type IN ('CAPTURE', 'REFUND', 'PARTIAL_REFUND')), 0) AS total_payments,
       COALESCE(SUM(CASE WHEN posting_type = 'DEBIT' THEN total_amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN posting_type = 'CREDIT' THEN total_amount ELSE 0 END), 0) -
       COALESCE((SELECT SUM(amount) FROM payments
                 WHERE tenant_id = $1::uuid AND property_id = $2::uuid
                   AND processed_at::date = $3::date AND status = 'COMPLETED'
                   AND transaction_type IN ('CAPTURE', 'REFUND', 'PARTIAL_REFUND')), 0) AS variance
     FROM charge_postings
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND business_date = $3::date
       AND COALESCE(is_voided, false) = false`,
    [tenantId, propertyId, auditDate],
  );

  const row = totalsResult.rows[0];
  const variance = Number(row?.variance ?? 0);

  // If balanced, skip the expensive per-folio breakdown query
  if (Math.abs(variance) < 0.01) {
    return {
      variance: 0,
      totalDebits: Number(row?.total_debits ?? 0),
      totalCredits: Number(row?.total_credits ?? 0),
      totalPayments: Number(row?.total_payments ?? 0),
      mismatches: [],
    };
  }

  // Breakdown query: group by folio + charge_code to pinpoint which entries
  // are unbalanced. Folios with net = 0 are excluded — only mismatched rows.
  const breakdownResult = await query<{
    folio_id: string | null;
    reservation_id: string | null;
    charge_code: string | null;
    debit_total: string;
    credit_total: string;
    net: string;
  }>(
    `SELECT
       cp.folio_id,
       cp.reservation_id,
       cp.charge_code,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) AS debit_total,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0) AS credit_total,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0) AS net
     FROM charge_postings cp
     WHERE cp.tenant_id = $1::uuid AND cp.property_id = $2::uuid
       AND cp.business_date = $3::date
       AND COALESCE(cp.is_voided, false) = false
     GROUP BY cp.folio_id, cp.reservation_id, cp.charge_code
     HAVING
       ABS(
         COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0)
       ) >= 0.01
     ORDER BY ABS(
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0)
     ) DESC`,
    [tenantId, propertyId, auditDate],
  );

  return {
    variance,
    totalDebits: Number(row?.total_debits ?? 0),
    totalCredits: Number(row?.total_credits ?? 0),
    totalPayments: Number(row?.total_payments ?? 0),
    mismatches: breakdownResult.rows.map((r) => ({
      folio_id: r.folio_id,
      reservation_id: r.reservation_id,
      charge_code: r.charge_code,
      debit_total: Number(r.debit_total),
      credit_total: Number(r.credit_total),
      net: Number(r.net),
    })),
  };
}
