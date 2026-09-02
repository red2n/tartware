import { randomUUID } from "node:crypto";

import {
  assertForcedOverrideAuthority,
  resolveReasonCode,
} from "@tartware/command-consumer-utils/command-utils";
import { buildValuesRows, chunkForBatch } from "@tartware/config/sql-batch";
import type { NightAuditCheckpointStatus, ReasonCodeRow } from "@tartware/schemas";
import { FlowId, flowControlNames, roundToCurrency } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { getPropertyBaseCurrency } from "../../lib/fx-rate-lookup.js";
import { appLogger } from "../../lib/logger.js";
import { BillingNightAuditCommandSchema } from "../../schemas/billing-commands.js";

import {
  asUuid,
  type CommandContext,
  resolveActorId,
  resolveActorRole,
  SYSTEM_ACTOR_ID,
} from "./common.js";
import { buildGlBatchForDate } from "./ledger.js";

/**
 * The preconditions `skip_preconditions` bypasses, read from the flow registry.
 *
 * Not a literal array. These three names already existed in the registry, in
 * billing's flow manifest and in the checks below; a fourth copy beside the
 * bypass is where a control quietly stops matching what is declared — and this
 * one is the copy that decides what the audit trail records, so a drift here
 * means logging a bypass of a gate that no longer exists, or missing one that
 * does.
 */
const NIGHT_AUDIT_PRECONDITION_GATES = flowControlNames(FlowId.NIGHT_AUDIT, {
  guardsCommand: "billing.night_audit.execute",
  kind: "gate",
});

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
  const shouldAutoCancelTentatives = command.auto_cancel_tentatives !== false;
  const skipPreconditions = command.skip_preconditions === true;

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
  let tentativesCancelled = 0;
  // Tracks the last step to complete so the catch path can record the failed step.
  let lastCompletedStep = 1;
  let auditFailureError: Error | undefined;

  // ── Step 0: Pre-condition validation (per master flow plan §10) ──────────
  // Six checks that must pass before the audit can proceed. Bypassed only
  // with skip_preconditions=true (requires GM override at the caller level).
  if (!skipPreconditions) {
    const preconditionFailures: string[] = [];

    // Check 1: Open arrivals — CONFIRMED reservations with arrival today not yet checked in
    // Only block if we are NOT automatically marking no-shows.
    const { rows: openArrivals } = await query<{ cnt: string }>(
      `SELECT COUNT(id) AS cnt FROM reservations
       WHERE tenant_id = $1::uuid AND property_id = $2::uuid
         AND status = 'CONFIRMED' AND check_in_date = $3::date
         AND COALESCE(is_deleted, false) = false`,
      [context.tenantId, command.property_id, auditDate],
    );
    if (Number(openArrivals[0]?.cnt ?? 0) > 0 && !shouldMarkNoShows) {
      preconditionFailures.push(
        `OPEN_ARRIVALS: ${openArrivals[0]?.cnt} CONFIRMED reservations with arrival today not yet checked in`,
      );
    }

    // Check 2: Open departures — all CHECKED_IN with departure today must be CHECKED_OUT
    const { rows: openDepartures } = await query<{ cnt: string }>(
      `SELECT COUNT(id) AS cnt FROM reservations
       WHERE tenant_id = $1::uuid AND property_id = $2::uuid
         AND status = 'CHECKED_IN' AND check_out_date = $3::date
         AND is_deleted = false`,
      [context.tenantId, command.property_id, auditDate],
    );
    if (Number(openDepartures[0]?.cnt ?? 0) > 0) {
      preconditionFailures.push(
        `OPEN_DEPARTURES: ${openDepartures[0]?.cnt} CHECKED_IN reservations with departure today not yet checked out`,
      );
    }

    // Check 3: Unbalanced folios — OPEN in-house folios with charges != payments
    const { rows: unbalancedFolios } = await query<{ cnt: string }>(
      `SELECT COUNT(f.folio_id) AS cnt FROM folios f
       JOIN reservations r ON r.id = f.reservation_id AND r.tenant_id = f.tenant_id
       WHERE f.tenant_id = $1::uuid AND f.property_id = $2::uuid
         AND f.folio_status = 'OPEN' AND r.status = 'CHECKED_IN'
         AND COALESCE(f.is_deleted, false) = false
         AND ABS(COALESCE(f.balance, 0)) > 0.01
         AND NOT EXISTS (
           SELECT 1 FROM folio_routing_rules frr
           WHERE frr.source_folio_id = f.folio_id AND frr.routing_type = 'DIRECT_BILL'
         )`,
      [context.tenantId, command.property_id],
    );
    if (Number(unbalancedFolios[0]?.cnt ?? 0) > 0) {
      preconditionFailures.push(
        `UNBALANCED_FOLIOS: ${unbalancedFolios[0]?.cnt} in-house folios with non-zero balance (no AR routing)`,
      );
    }

    if (preconditionFailures.length > 0) {
      appLogger.warn(
        {
          preconditionFailures,
          auditDate,
          tenantId: context.tenantId,
          propertyId: command.property_id,
        },
        "Night audit pre-conditions NOT met — audit blocked",
      );
      throw new Error(`NIGHT_AUDIT_PRECONDITIONS_FAILED: ${preconditionFailures.join("; ")}`);
    }
  } else {
    // Gate bypass: recorded in flow_approvals with the role the operator
    // actually held (it used to be the literal "GM_OVERRIDE", an authority the
    // product does not define).
    //
    // Resolved first, and an unknown or wrong-category code refuses the audit
    // before anything is skipped. The row was always written; what it carried
    // was the hardcoded literal "SKIP_PRECONDITIONS", so the code needed no
    // row and its requires_approval / approval_level were unreadable. The
    // schema makes skip_reason_code mandatory alongside skip_preconditions, so
    // `?? ""` only satisfies the optional type.
    const skipReason: ReasonCodeRow = await resolveReasonCode<ReasonCodeRow>(
      (sql, params) => query<ReasonCodeRow>(sql, params),
      {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        reasonCode: command.skip_reason_code ?? "",
        category: "NIGHT_AUDIT",
      },
    );

    // A08. The code was resolved but never measured against — night audit had
    // the input every other gate uses and did not read it. Skipping the roll's
    // preconditions closes a business date over unresolved arrivals, departures
    // or unbalanced folios, so the code's approval_level is what the operator
    // has to clear, exactly as on a forced check-in or a room move.
    //
    // Before the write, not after: the record below is deliberately fail-open,
    // so an authority check that ran after it could be skipped by the same
    // failure that swallows the row.
    // Named per declared gate rather than as one invented "skip_preconditions"
    // control: the skip bypasses all three, and the registry's vocabulary is
    // closed — flow:integrity refuses a gate_name no flow declares, which is
    // what it did to the first version of this line.
    for (const gateName of NIGHT_AUDIT_PRECONDITION_GATES) {
      assertForcedOverrideAuthority(skipReason, resolveActorRole(context.initiatedBy), {
        commandName: "billing.night_audit.run",
        gateName,
      });
    }

    try {
      const { recordFlowApproval } = await import("../../repositories/flow-approval-repository.js");
      for (const gateName of NIGHT_AUDIT_PRECONDITION_GATES) {
        await recordFlowApproval({
          tenant_id: context.tenantId,
          property_id: command.property_id,
          flow_name: "night_audit",
          gate_name: gateName,
          entity_type: "property",
          entity_id: command.property_id,
          approved_by: actorId,
          role_at_approval: resolveActorRole(context.initiatedBy),
          forced: true,
          reason_code: skipReason.reason_code,
          reason_notes:
            command.skip_reason_notes ??
            `${skipReason.reason_name}: night audit preconditions bypassed for ${auditDate}`,
          correlation_id: context.correlationId ?? null,
        });
      }
    } catch (approvalErr) {
      // Left fail-open deliberately, matching every other bypass writer: an
      // override that cannot be logged must not also fail the operation the
      // operator deliberately forced (see recordFlowApproval in
      // @tartware/config). The reason-code resolution above is the part that
      // fails closed, and it runs first.
      appLogger.warn(
        { approvalErr, auditRunId },
        "Night audit: failed to record gate bypass approval (non-fatal)",
      );
    }
  }

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
          `SELECT COUNT(posting_id) AS cnt
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
            const { rows: noShows } = await queryWithClient<{ id: string; version: number }>(
              client,
              `SELECT id, version FROM reservations
               WHERE tenant_id = $1 AND property_id = $2
                 AND status IN ('PENDING', 'CONFIRMED')
                 AND check_in_date <= $3::date
                 AND is_deleted = false
               FOR UPDATE`,
              [context.tenantId, command.property_id, auditDate],
            );
            let rowCount = 0;
            for (const ns of noShows) {
              const res = await queryWithClient(
                client,
                // The no-show fee is the first night of the stay across every room
                // held — a two-room booking that never arrived forfeits two rooms,
                // and a split-rate stay forfeits the rate it was actually booked at
                // for that night rather than an averaged scalar. Falls back to
                // room_rate for rows that have no nights yet.
                `UPDATE reservations r
                 SET status = 'NO_SHOW', is_no_show = true,
                     no_show_date = NOW(),
                     no_show_fee = COALESCE(
                       (SELECT SUM(n.rate_amount)
                          FROM reservation_nights n
                         WHERE n.reservation_id = r.id
                           AND n.tenant_id = r.tenant_id
                           AND n.stay_date = r.check_in_date
                           AND n.is_complimentary = false
                           AND COALESCE(n.is_deleted, false) = false),
                       r.room_rate,
                       0
                     ),
                     version = version + 1, updated_at = NOW()
                 WHERE r.id = $1 AND r.version = $2`,
                [ns.id, ns.version],
              );
              rowCount += res.rowCount ?? 0;
            }
            noShowsMarked = rowCount;
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
        const { rows: noShows } = await queryWithClient<{ id: string; version: number }>(
          client,
          `SELECT id, version FROM reservations
           WHERE tenant_id = $1 AND property_id = $2
             AND status IN ('PENDING', 'CONFIRMED')
             AND check_in_date <= $3::date
             AND is_deleted = false
           FOR UPDATE`,
          [context.tenantId, command.property_id, auditDate],
        );
        let rowCount = 0;
        for (const ns of noShows) {
          const res = await queryWithClient(
            client,
            // The no-show fee is the first night of the stay across every room
            // held — a two-room booking that never arrived forfeits two rooms,
            // and a split-rate stay forfeits the rate it was actually booked at
            // for that night rather than an averaged scalar. Falls back to
            // room_rate for rows that have no nights yet.
            `UPDATE reservations r
             SET status = 'NO_SHOW', is_no_show = true,
                 no_show_date = NOW(),
                 no_show_fee = COALESCE(
                   (SELECT SUM(n.rate_amount)
                      FROM reservation_nights n
                     WHERE n.reservation_id = r.id
                       AND n.tenant_id = r.tenant_id
                       AND n.stay_date = r.check_in_date
                       AND n.is_complimentary = false
                       AND COALESCE(n.is_deleted, false) = false),
                   r.room_rate,
                   0
                 ),
                 version = version + 1, updated_at = NOW()
             WHERE r.id = $1 AND r.version = $2`,
            [ns.id, ns.version],
          );
          rowCount += res.rowCount ?? 0;
        }
        noShowsMarked = rowCount;
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
      tentativesCancelled,
      trialBalanceVariance,
      trialBalanceBalanced: Math.abs(trialBalanceVariance) < 0.01,
      auditRunId,
    },
    "Night audit completed",
  );

  // ─── Post-audit step: Auto-cancel tentative group blocks past deposit deadline ─
  // Group blocks held as `tentative` past their deposit deadline are released.
  // Note this targets group_bookings, not reservations: deposit_due_date and the
  // tentative status both live on the group block, and a reservation has neither.
  // This runs outside the main transaction — it dispatches individual cancel events.
  if (shouldAutoCancelTentatives) {
    try {
      const { rows: staleTentatives } = await query<{
        group_booking_id: string;
        version: number;
      }>(
        `SELECT group_booking_id, version FROM group_bookings
         WHERE tenant_id = $1::uuid AND property_id = $2::uuid
           AND block_status = 'tentative'
           AND deposit_due_date IS NOT NULL
           AND deposit_due_date < $3::date
           AND is_deleted = false`,
        [context.tenantId, command.property_id, auditDate],
      );
      // One UPDATE for the whole sweep. Each row keeps its own optimistic
      // version check by joining against a VALUES list, so a block edited since
      // the SELECT is still skipped rather than overwritten.
      for (const batch of chunkForBatch(staleTentatives, 2, 1)) {
        await query(
          `UPDATE group_bookings g
           SET block_status = 'cancelled',
               internal_notes = CONCAT_WS(
                 E'\\n', g.internal_notes, 'AUTO_DEPOSIT_DEADLINE: cancelled by night audit'
               ),
               version = g.version + 1, updated_at = NOW()
           FROM (VALUES ${buildValuesRows({
             rowCount: batch.length,
             columnsPerRow: 2,
             scalarCount: 1,
             render: (p) => `(${p(1)}::uuid, ${p(2)}::int)`,
           })}) AS stale(group_booking_id, version)
           WHERE g.group_booking_id = stale.group_booking_id
             AND g.tenant_id = $1::uuid
             AND g.block_status = 'tentative'
             AND g.version = stale.version`,
          [context.tenantId, ...batch.flatMap((row) => [row.group_booking_id, row.version])],
        );
      }
      tentativesCancelled = staleTentatives.length;
      if (tentativesCancelled > 0) {
        appLogger.info(
          { tentativesCancelled, auditDate, auditRunId },
          "Night audit: auto-cancelled tentative group blocks past deposit deadline",
        );
      }
    } catch (cancelErr) {
      appLogger.warn(
        { cancelErr, auditRunId },
        "Night audit: failed to auto-cancel tentatives (non-fatal)",
      );
    }
  }

  // ─── Post-audit: Dispatch AR aging compute ──────────────────────────────
  // Fire-and-forget: aging runs asynchronously via Kafka command pipeline.
  // If dispatch fails, the aging can be triggered manually the next day.
  try {
    const { dispatchArAgingCompute } = await import("./ara-night-audit-hook.js");
    await dispatchArAgingCompute(context.tenantId, command.property_id, auditDate);
  } catch (hookErr) {
    appLogger.warn(
      { hookErr, auditRunId },
      "Night audit: failed to dispatch AR aging compute (non-fatal)",
    );
  }

  // ─── Post-audit: Dispatch AR dunning trigger ────────────────────────────
  // Evaluates all AR accounts for dunning actions based on aging buckets.
  // Fires after aging compute so dunning sees up-to-date bucket assignments.
  try {
    const { dispatchArDunningTrigger } = await import("./ara-night-audit-hook.js");
    await dispatchArDunningTrigger(context.tenantId, command.property_id, auditDate);
  } catch (hookErr) {
    appLogger.warn(
      { hookErr, auditRunId },
      "Night audit: failed to dispatch AR dunning trigger (non-fatal)",
    );
  }

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

  // Every amount this function posts is denominated in the property's own
  // currency, and its ISO 4217 exponent decides how tax is rounded. Resolved
  // once per run rather than per reservation.
  const baseCurrency = await getPropertyBaseCurrency(client, tenantId, propertyId);

  // One row per room per night, not per reservation. The rate comes from
  // reservation_nights for *this* business date, so a stay whose rate changes
  // on night 3 posts the night-3 price on night 3 — the flat
  // `reservations.room_rate` posted the same number every night and silently
  // lost every split-rate stay. A booking holding three rooms posts three
  // lines. Complimentary nights occupy the room and post nothing, so they are
  // filtered out here rather than skipped by the zero-amount guard below.
  const inHouseResult = await queryWithClient<{
    id: string;
    reservation_room_id: string;
    room_rate: string;
    room_number: string;
    room_sequence: number;
    total_amount: string;
    guest_id: string;
    folio_id: string | null;
    /** BIGINT — the driver returns it as bigint, not number. */
    version: string | number | bigint | null;
  }>(
    client,
    `SELECT r.id,
            rr.reservation_room_id,
            n.rate_amount AS room_rate,
            -- This room's own number only. Borrowing the reservation's scalar
            -- labelled every room of a multi-room booking with the one room
            -- that happened to be assigned; an unassigned room falls back to
            -- its sequence instead.
            rr.room_number,
            rr.room_sequence,
            r.total_amount,
            r.guest_id,
            f.folio_id, f.version
     FROM reservations r
     JOIN reservation_rooms rr
       ON rr.reservation_id = r.id
      AND rr.tenant_id = r.tenant_id
      AND COALESCE(rr.is_deleted, false) = false
      AND rr.status <> 'CANCELLED'
     JOIN reservation_nights n
       ON n.reservation_room_id = rr.reservation_room_id
      AND n.tenant_id = r.tenant_id
      AND n.stay_date = $3::date
      AND COALESCE(n.is_deleted, false) = false
      AND n.is_complimentary = false
     LEFT JOIN LATERAL (
       SELECT folio_id, version FROM public.folios
       WHERE tenant_id = $1 AND reservation_id = r.id
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at DESC LIMIT 1
     ) f ON true
     WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
     ORDER BY r.id, rr.room_sequence`,
    [tenantId, propertyId, auditDate],
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

  // Folio version as this run has advanced it, keyed by folio. Seeded from the
  // snapshot each row carries and bumped on every successful update below.
  // `folios.version` is BIGINT, which the driver hands back as a bigint, so the
  // arithmetic has to stay in bigint and bind as a string.
  const folioVersions = new Map<string, bigint>();

  for (const res of inHouseResult.rows) {
    const roomRate = Number(res.room_rate ?? 0);
    if (roomRate <= 0) continue;

    const folioId = res.folio_id;
    if (!folioId) continue;

    // Idempotency: skip if a non-voided room charge already exists for this
    // *room* on this business date from any prior audit run. Keying on the
    // reservation alone would post one room of a multi-room booking and call
    // the rest done. Rows written before reservation_room_id existed carry
    // NULL, so they are matched on the reservation instead — a re-run over
    // historic dates must not double-post them.
    const { rows: existing } = await queryWithClient<{ cnt: string }>(
      client,
      `SELECT COUNT(posting_id) AS cnt FROM charge_postings
       WHERE tenant_id = $1::uuid
         AND business_date = $3::date AND charge_code = 'ROOM'
         AND audit_run_id IS NOT NULL
         AND COALESCE(is_voided, false) = false
         AND (
           reservation_room_id = $4::uuid
           OR (reservation_room_id IS NULL AND reservation_id = $2::uuid)
         )`,
      [tenantId, res.id, auditDate, res.reservation_room_id],
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) {
      appLogger.debug(
        { reservationId: res.id, reservationRoomId: res.reservation_room_id, auditDate },
        "Night audit: room charge already posted, skipping",
      );
      chargesPosted++; // count as posted for metrics
      continue;
    }

    // Post room charge (inside the outer withTransaction — no nested TX needed)
    const roomLabel = res.room_number ? `Room ${res.room_number}` : `Room ${res.room_sequence}`;
    await queryWithClient(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id, reservation_room_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount,
         currency_code, posting_time, business_date,
         notes, audit_run_id, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $10::uuid,
         'CHARGE', 'DEBIT', 'ROOM', $11,
         1, $5, $5, $5,
         UPPER($9), NOW(), $6::date,
         'Auto-posted by night audit', $7::uuid, $8::uuid, $8::uuid
       )`,
      [
        tenantId,
        propertyId,
        folioId,
        res.id,
        roomRate,
        auditDate,
        auditRunId,
        actorId,
        baseCurrency,
        res.reservation_room_id,
        `Room charge - night audit (${roomLabel})`,
      ],
    );

    // Post applicable taxes — compound taxes apply sequentially on base + prior taxes
    let totalTaxAmount = 0;
    for (const tax of taxes) {
      const taxRate = Number(tax.tax_rate);
      // Compound taxes apply on (room rate + all prior tax amounts)
      const taxableBase =
        useCompoundTaxes && tax.is_compound_tax ? roomRate + totalTaxAmount : roomRate;
      // Rounded to the property currency's minor unit: a fixed 2dp puts a
      // fractional yen on a JPY folio and drops the third decimal on a KWD one.
      const taxAmount = roundToCurrency((taxableBase * taxRate) / 100, baseCurrency);
      if (taxAmount <= 0) continue;

      await queryWithClient(
        client,
        `INSERT INTO public.charge_postings (
           tenant_id, property_id, folio_id, reservation_id, reservation_room_id,
           transaction_type, posting_type, charge_code, charge_description,
           quantity, unit_price, subtotal, total_amount,
           currency_code, posting_time, business_date,
           department_code, notes, audit_run_id, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $12::uuid,
           'CHARGE', 'DEBIT', 'ROOM_TAX', $5,
           1, $6, $6, $6,
           UPPER($11), NOW(), $7::date,
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
          baseCurrency,
          res.reservation_room_id,
        ],
      );
      totalTaxAmount += taxAmount;
      taxChargesPosted++;
    }

    // Update folio balance (room charge + all taxes)
    const chargeTotal = roomRate + totalTaxAmount;

    // Every room of a booking posts to the same folio, so the version read at
    // the top of this function is only right for the first of them. Tracking
    // our own increments keeps the optimistic check meaningful — it still
    // catches a writer outside this transaction — without a multi-room booking
    // failing the audit against itself on its second room.
    const trackedVersion = folioVersions.get(folioId);
    const snapshotVersion = trackedVersion ?? (res.version == null ? null : BigInt(res.version));
    if (snapshotVersion === null) {
      throw new Error(`Night audit: version missing for folio ${folioId} on reservation ${res.id}`);
    }

    const { rowCount } = await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges + $2,
           balance = balance + $2,
           version = version + 1,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid AND version = $5`,
      [tenantId, chargeTotal, actorId, folioId, snapshotVersion.toString()],
    );

    if (rowCount === 0) {
      // In night audit, we log the error but we might want to fail the whole audit or just this guest.
      // Given the transaction rollback policy, we should probably throw to rollback.
      throw new Error(
        `Night audit: concurrent modification on folio ${folioId} for reservation ${res.id}`,
      );
    }
    folioVersions.set(folioId, snapshotVersion + 1n);
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
  // Package components post in the property's currency, same as room charges.
  const baseCurrency = await getPropertyBaseCurrency(client, tenantId, propertyId);
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
      `SELECT COUNT(posting_id) AS cnt FROM charge_postings
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
         UPPER($12), NOW(), $8::date,
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
        baseCurrency,
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

  // Commission accrues in the property's currency, so it rounds to that
  // currency's minor unit rather than a fixed 2 decimal places.
  const baseCurrency = await getPropertyBaseCurrency(client, tenantId, propertyId);

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

    const commissionAmount = roundToCurrency((roomRate * commPct) / 100, baseCurrency);
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
