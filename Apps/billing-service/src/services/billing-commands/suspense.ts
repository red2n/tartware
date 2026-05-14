import { randomUUID } from "node:crypto";

import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import { postGlPair } from "../../lib/gl-posting.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingSuspenseResolveCommandSchema,
  BillingSuspenseWriteOffCommandSchema,
} from "../../schemas/billing-commands.js";

import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── GL constants ─────────────────────────────────────────────────────────────
const SUSPENSE_ACCOUNT = "1900"; // Suspense clearing account
const BAD_DEBT_ACCOUNT = "5400"; // Bad debt expense

// ─── Resolve a suspense item ──────────────────────────────────────────────────

/**
 * Move a charge from the suspense folio to the correct target folio.
 *
 * Steps:
 *  1. Load and validate the suspense posting.
 *  2. Lock the target folio.
 *  3. Void the original suspense posting (create VOID counterpart).
 *  4. Re-insert the posting on the target folio.
 *  5. Adjust both folio balances.
 */
export const resolveSuspenseItem = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingSuspenseResolveCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load original posting
  const { rows: postingRows } = await query<{
    posting_id: string;
    folio_id: string;
    property_id: string;
    reservation_id: string | null;
    charge_code: string;
    charge_description: string;
    quantity: string;
    unit_price: string;
    total_amount: string;
    currency_code: string;
    posting_date: string;
    posting_type: string;
  }>(
    `SELECT cp.posting_id, cp.folio_id, cp.property_id, cp.reservation_id,
            cp.charge_code, cp.charge_description,
            cp.quantity, cp.unit_price, cp.total_amount, cp.currency_code,
            cp.posting_date::text, cp.posting_type
       FROM charge_postings cp
       JOIN folios f ON f.folio_id = cp.folio_id
      WHERE cp.posting_id = $1::uuid AND cp.tenant_id = $2::uuid
        AND f.folio_type = 'SUSPENSE'
        AND cp.posting_type != 'VOID'`,
    [command.suspense_posting_id, tenantId],
  );

  const posting = postingRows[0];
  if (!posting) {
    throw new BillingCommandError(
      "SUSPENSE_POSTING_NOT_FOUND",
      `Suspense posting ${command.suspense_posting_id} not found or already resolved.`,
    );
  }

  const amount = Number(posting.total_amount);

  await withTransaction(async (client) => {
    await acquireFolioLock(client, command.target_folio_id);

    // Void the suspense posting
    const voidRef = `VOID-${randomUUID().slice(0, 8)}`.toUpperCase();
    await queryWithClient(
      client,
      `INSERT INTO charge_postings (
          tenant_id, property_id, folio_id, reservation_id,
          charge_code, charge_description, posting_type,
          quantity, unit_price, subtotal, total_amount, currency_code,
          posting_date, reference_number, parent_posting_id,
          notes, created_by, updated_by
        )
        SELECT tenant_id, property_id, folio_id, reservation_id,
               charge_code, charge_description, 'VOID'::varchar,
               quantity, unit_price * -1, subtotal * -1, total_amount * -1, currency_code,
               CURRENT_DATE, $1, posting_id,
               $2, $3::uuid, $3::uuid
          FROM charge_postings WHERE posting_id = $4::uuid AND tenant_id = $5::uuid`,
      [
        voidRef,
        command.resolution_notes ?? "Resolved from suspense",
        actorId,
        command.suspense_posting_id,
        tenantId,
      ],
    );

    // Re-insert the posting on the target folio
    await queryWithClient(
      client,
      `INSERT INTO charge_postings (
          tenant_id, property_id, folio_id, reservation_id,
          charge_code, charge_description, posting_type,
          quantity, unit_price, subtotal, total_amount, currency_code,
          posting_date, reference_number, parent_posting_id,
          notes, created_by, updated_by
        )
        SELECT tenant_id, property_id, $1::uuid, reservation_id,
               charge_code, charge_description, posting_type,
               quantity, unit_price, subtotal, total_amount, currency_code,
               CURRENT_DATE, $2, posting_id,
               $3, $4::uuid, $4::uuid
          FROM charge_postings WHERE posting_id = $5::uuid AND tenant_id = $6::uuid`,
      [
        command.target_folio_id,
        `SUSP-RES-${randomUUID().slice(0, 8)}`,
        command.resolution_notes ?? "Moved from suspense",
        actorId,
        command.suspense_posting_id,
        tenantId,
      ],
    );

    // Update suspense folio balance
    await queryWithClient(
      client,
      `UPDATE folios SET balance = balance - $1, updated_at = NOW()
        WHERE folio_id = $2::uuid AND tenant_id = $3::uuid`,
      [amount, posting.folio_id, tenantId],
    );

    // Update target folio balance
    await queryWithClient(
      client,
      `UPDATE folios SET balance = balance + $1, updated_at = NOW()
        WHERE folio_id = $2::uuid AND tenant_id = $3::uuid`,
      [amount, command.target_folio_id, tenantId],
    );
  });

  appLogger.info(
    { postingId: command.suspense_posting_id, targetFolioId: command.target_folio_id, amount },
    "Suspense item resolved",
  );
  auditAsync({
    tenantId,
    propertyId: posting.property_id,
    userId: actorId,
    action: "SUSPENSE_RESOLVE",
    entityType: "charge_posting",
    entityId: command.suspense_posting_id,
    severity: "INFO",
    description: `Suspense charge moved to folio ${command.target_folio_id}`,
    newValues: { target_folio_id: command.target_folio_id },
  });
  return command.target_folio_id;
};

// ─── Write off a suspense item ───────────────────────────────────────────────

/**
 * Write off a suspense item that cannot be attributed to any guest or folio.
 *
 * GL: DR Bad Debt (5400) / CR Suspense (1900)
 * The original posting is voided and a write-off entry is inserted on the
 * suspense folio for audit trail.
 */
export const writeOffSuspenseItem = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingSuspenseWriteOffCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load posting
  const { rows: postingRows } = await query<{
    posting_id: string;
    folio_id: string;
    property_id: string;
    total_amount: string;
    currency_code: string;
    posting_date: string;
  }>(
    `SELECT cp.posting_id, cp.folio_id, cp.property_id, cp.total_amount,
            cp.currency_code, cp.posting_date::text
       FROM charge_postings cp
       JOIN folios f ON f.folio_id = cp.folio_id
      WHERE cp.posting_id = $1::uuid AND cp.tenant_id = $2::uuid
        AND f.folio_type = 'SUSPENSE'
        AND cp.posting_type != 'VOID'`,
    [command.suspense_posting_id, tenantId],
  );

  const posting = postingRows[0];
  if (!posting) {
    throw new BillingCommandError(
      "SUSPENSE_POSTING_NOT_FOUND",
      `Suspense posting ${command.suspense_posting_id} not found.`,
    );
  }

  const amount = Number(posting.total_amount);
  const writeOffRef = `SUSP-WO-${randomUUID().slice(0, 8)}`.toUpperCase();

  await withTransaction(async (client) => {
    // Void the suspense posting
    await queryWithClient(
      client,
      `INSERT INTO charge_postings (
          tenant_id, property_id, folio_id, reservation_id,
          charge_code, charge_description, posting_type,
          quantity, unit_price, subtotal, total_amount, currency_code,
          posting_date, reference_number, parent_posting_id,
          notes, created_by, updated_by
        )
        SELECT tenant_id, property_id, folio_id, reservation_id,
               charge_code, charge_description, 'VOID'::varchar,
               quantity, unit_price * -1, subtotal * -1, total_amount * -1, currency_code,
               CURRENT_DATE, $1, posting_id,
               $2, $3::uuid, $3::uuid
          FROM charge_postings WHERE posting_id = $4::uuid AND tenant_id = $5::uuid`,
      [
        writeOffRef,
        command.reason ?? "Suspense write-off",
        actorId,
        command.suspense_posting_id,
        tenantId,
      ],
    );

    // Update suspense folio balance
    await queryWithClient(
      client,
      `UPDATE folios SET balance = balance - $1, updated_at = NOW()
        WHERE folio_id = $2::uuid AND tenant_id = $3::uuid`,
      [amount, posting.folio_id, tenantId],
    );

    // GL: DR Bad Debt (5400) / CR Suspense (1900)
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const postingDate = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    await postGlPair(client, {
      tenant_id: tenantId,
      property_id: posting.property_id,
      debit_account: BAD_DEBT_ACCOUNT,
      credit_account: SUSPENSE_ACCOUNT,
      amount,
      currency: posting.currency_code,
      posting_date: postingDate,
      usali_category: "Suspense Write-Off",
      description: `Suspense write-off — ${writeOffRef}`,
      source_table: "charge_postings",
      source_id: posting.posting_id,
      reference_number: writeOffRef,
      created_by: actorId,
    });
  });

  appLogger.info(
    { postingId: command.suspense_posting_id, amount, writeOffRef },
    "Suspense item written off",
  );
  auditAsync({
    tenantId,
    propertyId: posting.property_id,
    userId: actorId,
    action: "SUSPENSE_WRITE_OFF",
    entityType: "charge_posting",
    entityId: command.suspense_posting_id,
    severity: "WARNING",
    description: `Suspense charge ${command.suspense_posting_id} written off as bad debt (${amount} ${posting.currency_code})`,
    newValues: { reason: command.reason ?? null },
  });
  return writeOffRef;
};
