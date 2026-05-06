import { randomUUID } from "node:crypto";

import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { postGlPair } from "../../lib/gl-posting.js";
import { appLogger } from "../../lib/logger.js";
import {
  ArAccountCreateCommandSchema,
  ArAccountUpdateTermsCommandSchema,
  ArAgingComputeCommandSchema,
  ArCityLedgerTransferCommandSchema,
  ArCityLedgerWriteOffCommandSchema,
  ArDisputeEscalateCommandSchema,
  ArDisputeRaiseCommandSchema,
  ArDisputeResolveCommandSchema,
  ArDunningSuppressCommandSchema,
  ArDunningTriggerCommandSchema,
  ArPaymentApplyCommandSchema,
  ArPaymentUnapplyCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── GL constants ─────────────────────────────────────────────────────────────
const CITY_LEDGER_ACCOUNT = "1300"; // City Ledger / AR
const GUEST_LEDGER_ACCOUNT = "1100"; // Guest Ledger
const BAD_DEBT_ACCOUNT = "5400"; // Bad Debt Expense

// ─── AR Account management ────────────────────────────────────────────────────

/**
 * Create a new AR account for a company or travel agent.
 */
export const createArAccount = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArAccountCreateCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const accountNumber = `AR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const { rows } = await query<{ ar_account_id: string }>(
    `INSERT INTO ar_accounts (
        tenant_id, property_id, account_number,
        company_id, company_name, contact_name, contact_email, billing_address,
        credit_limit, payment_terms, currency,
        notes, created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        $4, $5, $6, $7, $8,
        $9, $10, UPPER($11),
        $12, $13::uuid, $13::uuid
      ) RETURNING ar_account_id`,
    [
      tenantId,
      command.property_id,
      accountNumber,
      command.company_id ?? null,
      command.company_name,
      command.contact_name ?? null,
      command.contact_email ?? null,
      command.billing_address ?? null,
      command.credit_limit,
      command.payment_terms,
      command.currency,
      command.notes ?? null,
      actorId,
    ],
  );

  const arAccountId = rows[0]?.ar_account_id;
  if (!arAccountId) {
    throw new BillingCommandError("AR_ACCOUNT_CREATE_FAILED", "Failed to create AR account.");
  }

  appLogger.info(
    { arAccountId, accountNumber, companyName: command.company_name },
    "AR account created",
  );
  return arAccountId;
};

/**
 * Update credit limit and/or payment terms on an existing AR account.
 */
export const updateArAccountTerms = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArAccountUpdateTermsCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rowCount } = await query(
    `UPDATE ar_accounts
        SET credit_limit    = COALESCE($1, credit_limit),
            payment_terms   = COALESCE($2, payment_terms),
            account_status  = COALESCE($3, account_status),
            notes           = COALESCE($4, notes),
            updated_at      = NOW(),
            updated_by      = $5::uuid
      WHERE ar_account_id = $6::uuid AND tenant_id = $7::uuid AND is_deleted = FALSE`,
    [
      command.credit_limit ?? null,
      command.payment_terms ?? null,
      command.status ?? null,
      command.notes ?? null,
      actorId,
      command.ar_account_id,
      tenantId,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "AR_ACCOUNT_NOT_FOUND",
      `AR account ${command.ar_account_id} not found.`,
    );
  }

  appLogger.info({ arAccountId: command.ar_account_id }, "AR account terms updated");
  return command.ar_account_id;
};

// ─── City Ledger transfers ────────────────────────────────────────────────────

/**
 * Transfer a folio's outstanding balance to the city ledger.
 *
 * GL: DR City Ledger (1300) / CR Guest Ledger (1100)
 * Pre-checks credit limit. Idempotent: ON CONFLICT on (folio_id, ar_account_id).
 */
export const transferToCityLedger = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArCityLedgerTransferCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load AR account + credit check
  const { rows: accountRows } = await query<{
    ar_account_id: string;
    credit_limit: string;
    outstanding_balance: string;
    available_credit: string;
    account_status: string;
    payment_terms: string;
  }>(
    `SELECT ar_account_id, credit_limit, outstanding_balance, available_credit, account_status, payment_terms
       FROM ar_accounts
      WHERE ar_account_id = $1::uuid AND tenant_id = $2::uuid AND is_deleted = FALSE`,
    [command.ar_account_id, tenantId],
  );

  const account = accountRows[0];
  if (!account) {
    throw new BillingCommandError(
      "AR_ACCOUNT_NOT_FOUND",
      `AR account ${command.ar_account_id} not found.`,
    );
  }
  if (account.account_status !== "ACTIVE") {
    throw new BillingCommandError(
      "AR_ACCOUNT_SUSPENDED",
      `AR account is ${account.account_status} — cannot accept transfers.`,
    );
  }

  // Load folio balance if amount not specified
  let transferAmount = command.amount;
  if (!transferAmount) {
    const { rows: folioRows } = await query<{ balance: string }>(
      `SELECT COALESCE(balance, 0) AS balance FROM folios
        WHERE folio_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.folio_id, tenantId],
    );
    const folio = folioRows[0];
    if (!folio) {
      throw new BillingCommandError("FOLIO_NOT_FOUND", `Folio ${command.folio_id} not found.`);
    }
    transferAmount = Number(folio.balance);
  }

  if (transferAmount <= 0) {
    throw new BillingCommandError(
      "ZERO_BALANCE",
      "Cannot transfer a zero or negative balance to city ledger.",
    );
  }

  // Credit limit check
  if (Number(account.available_credit) < transferAmount) {
    throw new BillingCommandError(
      "CREDIT_LIMIT_EXCEEDED",
      `Transfer of ${transferAmount} exceeds available credit ${account.available_credit}.`,
    );
  }

  // Compute due date from payment terms
  const termDays =
    account.payment_terms === "NET30"
      ? 30
      : account.payment_terms === "NET45"
        ? 45
        : account.payment_terms === "NET60"
          ? 60
          : 0;

  const entryNumber = `CL-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const { rows } = await withTransaction(async (client) => {
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const today = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    // Insert city ledger entry
    const inserted = await queryWithClient<{ entry_id: string }>(
      client,
      `INSERT INTO ar_city_ledger (
          tenant_id, property_id, ar_account_id,
          folio_id, reservation_id, invoice_id, entry_number,
          transfer_date, due_date,
          original_amount, outstanding_balance, currency,
          notes, created_by
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid,
          $4::uuid, $5, $6, $7,
          $8::date, ($8::date + $9::int),
          $10, $10, UPPER($11),
          $12, $13::uuid
        )
        ON CONFLICT (tenant_id, folio_id, ar_account_id)
          WHERE entry_status NOT IN ('CANCELLED', 'WRITTEN_OFF')
        DO NOTHING
        RETURNING entry_id`,
      [
        tenantId,
        command.property_id,
        command.ar_account_id,
        command.folio_id,
        command.reservation_id ?? null,
        command.invoice_id ?? null,
        entryNumber,
        today,
        termDays,
        transferAmount,
        command.currency,
        command.notes ?? null,
        actorId,
      ],
    );

    const entryId = inserted.rows[0]?.entry_id;
    if (!entryId) {
      // Idempotent — entry already exists for this folio+account
      const existingResult = await queryWithClient<{ entry_id: string }>(
        client,
        `SELECT entry_id FROM ar_city_ledger
          WHERE tenant_id = $1::uuid AND folio_id = $2::uuid AND ar_account_id = $3::uuid
            AND entry_status NOT IN ('CANCELLED', 'WRITTEN_OFF')
          LIMIT 1`,
        [tenantId, command.folio_id, command.ar_account_id],
      );
      return existingResult;
    }

    // Update AR account outstanding balance
    await queryWithClient(
      client,
      `UPDATE ar_accounts
          SET outstanding_balance = outstanding_balance + $1,
              updated_at = NOW(), updated_by = $2::uuid
        WHERE ar_account_id = $3::uuid AND tenant_id = $4::uuid`,
      [transferAmount, actorId, command.ar_account_id, tenantId],
    );

    // GL: DR City Ledger (1300) / CR Guest Ledger (1100)
    await postGlPair(client, {
      tenant_id: tenantId,
      property_id: command.property_id,
      folio_id: command.folio_id,
      reservation_id: command.reservation_id,
      debit_account: CITY_LEDGER_ACCOUNT,
      credit_account: GUEST_LEDGER_ACCOUNT,
      amount: transferAmount,
      currency: command.currency,
      posting_date: today,
      usali_category: "Accounts Receivable",
      description: `City ledger transfer — ${entryNumber}`,
      source_table: "accounts_receivable",
      source_id: entryId,
      reference_number: entryNumber,
      created_by: actorId,
    });

    return inserted;
  });

  const entryId = rows[0]?.entry_id ?? entryNumber;
  appLogger.info(
    { entryId, entryNumber, arAccountId: command.ar_account_id, amount: transferAmount },
    "City ledger transfer complete",
  );
  return entryId;
};

/**
 * Write off a bad-debt city ledger entry.
 *
 * GL: DR Bad Debt Expense (5400) / CR City Ledger (1300)
 */
export const writeOffCityLedger = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArCityLedgerWriteOffCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rows: entryRows } = await query<{
    entry_id: string;
    ar_account_id: string;
    outstanding_balance: string;
    currency: string;
    entry_status: string;
  }>(
    `SELECT entry_id, ar_account_id, outstanding_balance, currency, entry_status
       FROM ar_city_ledger
      WHERE entry_id = $1::uuid AND tenant_id = $2::uuid`,
    [command.city_ledger_id, tenantId],
  );

  const entry = entryRows[0];
  if (!entry) {
    throw new BillingCommandError(
      "CITY_LEDGER_NOT_FOUND",
      `City ledger entry ${command.city_ledger_id} not found.`,
    );
  }
  if (entry.entry_status === "WRITTEN_OFF") {
    return entry.entry_id; // Idempotent
  }
  if (!["OPEN", "PARTIAL"].includes(entry.entry_status)) {
    throw new BillingCommandError(
      "INVALID_STATUS",
      `Entry is ${entry.entry_status} — cannot write off.`,
    );
  }

  const writeOffAmount = command.amount ?? Number(entry.outstanding_balance);

  await withTransaction(async (client) => {
    const { rows: dateRows } = await queryWithClient<{ today: string }>(
      client,
      "SELECT CURRENT_DATE::text AS today",
      [],
    );
    const today = dateRows[0]?.today ?? new Date().toISOString().slice(0, 10);

    await queryWithClient(
      client,
      `UPDATE ar_city_ledger
          SET entry_status = 'WRITTEN_OFF',
              outstanding_balance = 0,
              write_off_reason = $1,
              written_off_at = NOW(),
              written_off_by = $2::uuid,
              updated_at = NOW()
        WHERE entry_id = $3::uuid AND tenant_id = $4::uuid`,
      [command.reason, actorId, command.city_ledger_id, tenantId],
    );

    await queryWithClient(
      client,
      `UPDATE ar_accounts
          SET outstanding_balance = GREATEST(outstanding_balance - $1, 0),
              updated_at = NOW()
        WHERE ar_account_id = $2::uuid AND tenant_id = $3::uuid`,
      [writeOffAmount, entry.ar_account_id, tenantId],
    );

    // GL: DR Bad Debt (5400) / CR City Ledger (1300)
    await postGlPair(client, {
      tenant_id: tenantId,
      property_id: command.property_id,
      debit_account: BAD_DEBT_ACCOUNT,
      credit_account: CITY_LEDGER_ACCOUNT,
      amount: writeOffAmount,
      currency: entry.currency,
      posting_date: today,
      usali_category: "Accounts Receivable",
      description: `AR write-off — ${command.city_ledger_id}`,
      source_table: "accounts_receivable",
      source_id: command.city_ledger_id,
      created_by: actorId,
    });
  });

  appLogger.info(
    { entryId: command.city_ledger_id, amount: writeOffAmount },
    "City ledger entry written off",
  );
  return command.city_ledger_id;
};

// ─── Aging computation ────────────────────────────────────────────────────────

/**
 * Compute nightly aging snapshot for all AR accounts with open city ledger entries.
 *
 * Categorises each entry into its aging bucket, updates ar_city_ledger.aging_bucket,
 * and inserts a row into ar_aging_snapshots.
 */
export const computeAging = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = ArAgingComputeCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rows: dateRows } = await query<{ today: string }>(
    "SELECT CURRENT_DATE::text AS today",
    [],
  );
  const snapshotDate = command.snapshot_date
    ? command.snapshot_date.toISOString().slice(0, 10)
    : (dateRows[0]?.today ?? new Date().toISOString().slice(0, 10));

  // Update aging buckets on all open entries
  await query(
    `UPDATE ar_city_ledger
        SET days_outstanding = ($1::date - transfer_date)::int,
            aging_bucket = CASE
              WHEN ($1::date - transfer_date) <= 30  THEN 'CURRENT'
              WHEN ($1::date - transfer_date) <= 60  THEN '1_30'
              WHEN ($1::date - transfer_date) <= 90  THEN '31_60'
              WHEN ($1::date - transfer_date) <= 120 THEN '61_90'
              WHEN ($1::date - transfer_date) <= 150 THEN '91_120'
              ELSE 'OVER_120'
            END,
            updated_at = NOW()
      WHERE tenant_id = $2::uuid AND property_id = $3::uuid
        AND entry_status IN ('OPEN', 'PARTIAL')`,
    [snapshotDate, tenantId, command.property_id],
  );

  // Insert aggregate snapshots per AR account
  await query(
    `INSERT INTO ar_aging_snapshots (
        tenant_id, property_id, ar_account_id, snapshot_date,
        current_amount, bucket_1_30, bucket_31_60,
        bucket_61_90, bucket_91_120, bucket_over_120, total_outstanding, currency,
        created_by
      )
      SELECT
        tenant_id, property_id, ar_account_id, $1::date,
        SUM(CASE WHEN aging_bucket = 'CURRENT' THEN outstanding_balance ELSE 0 END),
        SUM(CASE WHEN aging_bucket = '1_30'    THEN outstanding_balance ELSE 0 END),
        SUM(CASE WHEN aging_bucket = '31_60'   THEN outstanding_balance ELSE 0 END),
        SUM(CASE WHEN aging_bucket = '61_90'   THEN outstanding_balance ELSE 0 END),
        SUM(CASE WHEN aging_bucket = '91_120'  THEN outstanding_balance ELSE 0 END),
        SUM(CASE WHEN aging_bucket = 'OVER_120' THEN outstanding_balance ELSE 0 END),
        SUM(outstanding_balance),
        currency,
        $2::uuid
      FROM ar_city_ledger
      WHERE tenant_id = $3::uuid AND property_id = $4::uuid
        AND entry_status IN ('OPEN', 'PARTIAL')
      GROUP BY tenant_id, property_id, ar_account_id, currency
      ON CONFLICT (tenant_id, ar_account_id, snapshot_date) DO UPDATE
        SET current_amount   = EXCLUDED.current_amount,
            bucket_1_30      = EXCLUDED.bucket_1_30,
            bucket_31_60     = EXCLUDED.bucket_31_60,
            bucket_61_90     = EXCLUDED.bucket_61_90,
            bucket_91_120    = EXCLUDED.bucket_91_120,
            bucket_over_120  = EXCLUDED.bucket_over_120,
            total_outstanding= EXCLUDED.total_outstanding`,
    [snapshotDate, actorId, tenantId, command.property_id],
  );

  appLogger.info({ snapshotDate, propertyId: command.property_id }, "AR aging computed");
  return snapshotDate;
};

// ─── Dunning ──────────────────────────────────────────────────────────────────

/**
 * Trigger a dunning action for an AR account.
 */
export const triggerDunning = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArDunningTriggerCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const eventType =
    command.bucket === "30"
      ? "FIRST_REMINDER"
      : command.bucket === "60"
        ? "SECOND_WARNING"
        : "COLLECTIONS_REFERRAL";

  const newLevel = eventType === "FIRST_REMINDER" ? 1 : eventType === "SECOND_WARNING" ? 2 : 3;

  const { rows } = await withTransaction(async (client) => {
    const inserted = await queryWithClient<{ dunning_event_id: string }>(
      client,
      `INSERT INTO ar_dunning_events (
          tenant_id, property_id, ar_account_id, event_type, currency, created_by
        ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'USD', $5::uuid)
        RETURNING dunning_event_id`,
      [tenantId, command.property_id, command.ar_account_id, eventType, actorId],
    );

    await queryWithClient(
      client,
      `UPDATE ar_accounts SET dunning_level = $1, updated_at = NOW()
        WHERE ar_account_id = $2::uuid AND tenant_id = $3::uuid`,
      [newLevel, command.ar_account_id, tenantId],
    );

    return inserted;
  });

  const eventId = rows[0]?.dunning_event_id ?? command.ar_account_id;
  appLogger.info(
    { eventId, eventType, arAccountId: command.ar_account_id },
    "Dunning event triggered",
  );
  return eventId;
};

/**
 * Suppress dunning for an AR account for a specified number of days.
 */
export const suppressDunning = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArDunningSuppressCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const suppressUntil = new Date();
  suppressUntil.setDate(suppressUntil.getDate() + command.suppress_days);
  const suppressUntilStr = suppressUntil.toISOString().slice(0, 10);

  const { rows } = await withTransaction(async (client) => {
    const inserted = await queryWithClient<{ dunning_event_id: string }>(
      client,
      `INSERT INTO ar_dunning_events (
          tenant_id, property_id, ar_account_id, event_type,
          suppressed_until, suppress_reason, currency, created_by
        ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'SUPPRESS',
          $4::date, $5, 'USD', $6::uuid)
        RETURNING dunning_event_id`,
      [
        tenantId,
        command.property_id,
        command.ar_account_id,
        suppressUntilStr,
        command.reason ?? null,
        actorId,
      ],
    );

    await queryWithClient(
      client,
      `UPDATE ar_accounts
          SET dunning_suppressed_until = $1::timestamptz, updated_at = NOW()
        WHERE ar_account_id = $2::uuid AND tenant_id = $3::uuid`,
      [suppressUntil.toISOString(), command.ar_account_id, tenantId],
    );

    return inserted;
  });

  appLogger.info(
    { suppressUntil: suppressUntilStr, arAccountId: command.ar_account_id },
    "Dunning suppressed",
  );
  return rows[0]?.dunning_event_id ?? command.ar_account_id;
};

// ─── Cash Application ─────────────────────────────────────────────────────────

/**
 * Apply an incoming payment against city ledger entries (FIFO by default).
 */
export const applyArCashPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArPaymentApplyCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Determine allocation
  let allocations: { city_ledger_id: string; amount: number }[];

  if (command.invoice_allocations && command.invoice_allocations.length > 0) {
    allocations = command.invoice_allocations.map((a) => ({
      city_ledger_id: a.city_ledger_id,
      amount: a.amount,
    }));
  } else {
    // FIFO: oldest open entries first
    const { rows: openEntries } = await query<{
      entry_id: string;
      outstanding_balance: string;
    }>(
      `SELECT entry_id, outstanding_balance
         FROM ar_city_ledger
        WHERE tenant_id = $1::uuid AND ar_account_id = $2::uuid
          AND entry_status IN ('OPEN', 'PARTIAL')
        ORDER BY transfer_date ASC, created_at ASC`,
      [tenantId, command.ar_account_id],
    );

    let remaining = command.amount;
    allocations = [];
    for (const entry of openEntries) {
      if (remaining <= 0) break;
      const available = Math.min(remaining, Number(entry.outstanding_balance));
      allocations.push({ city_ledger_id: entry.entry_id, amount: available });
      remaining -= available;
    }
  }

  const { rows: dateRows } = await query<{ today: string }>(
    "SELECT CURRENT_DATE::text AS today",
    [],
  );
  const applicationDate = command.application_date
    ? command.application_date.toISOString().slice(0, 10)
    : (dateRows[0]?.today ?? new Date().toISOString().slice(0, 10));

  const { rows } = await withTransaction(async (client) => {
    const inserted: { application_id: string }[] = [];

    for (const alloc of allocations) {
      const { rows: appRows } = await queryWithClient<{ application_id: string }>(
        client,
        `INSERT INTO ar_cash_applications (
            tenant_id, property_id, ar_account_id, entry_id,
            payment_id, payment_reference, payment_date,
            applied_amount, currency,
            notes, created_by
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid,
            $5::uuid, $6, $7::date,
            $8, UPPER($9),
            $10, $11::uuid
          ) RETURNING application_id`,
        [
          tenantId,
          command.property_id,
          command.ar_account_id,
          alloc.city_ledger_id,
          command.payment_id,
          command.payment_reference ?? null,
          applicationDate,
          alloc.amount,
          command.currency,
          command.notes ?? null,
          actorId,
        ],
      );
      inserted.push(...appRows);

      // Update city ledger entry
      await queryWithClient(
        client,
        `UPDATE ar_city_ledger
            SET outstanding_balance = GREATEST(outstanding_balance - $1, 0),
                entry_status = CASE
                  WHEN outstanding_balance - $1 <= 0 THEN 'PAID'
                  ELSE 'PARTIAL'
                END,
                updated_at = NOW()
          WHERE entry_id = $2::uuid AND tenant_id = $3::uuid`,
        [alloc.amount, alloc.city_ledger_id, tenantId],
      );
    }

    // Update AR account outstanding balance
    await queryWithClient(
      client,
      `UPDATE ar_accounts
          SET outstanding_balance = GREATEST(outstanding_balance - $1, 0),
              updated_at = NOW()
        WHERE ar_account_id = $2::uuid AND tenant_id = $3::uuid`,
      [command.amount, command.ar_account_id, tenantId],
    );

    return { rows: inserted };
  });

  appLogger.info(
    {
      applicationCount: rows.length,
      arAccountId: command.ar_account_id,
      totalAmount: command.amount,
    },
    "AR cash applied",
  );
  return rows[0]?.application_id ?? command.payment_id;
};

/**
 * Reverse a misapplied cash application.
 */
export const unapplyArCashPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArPaymentUnapplyCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rows: appRows } = await query<{
    application_id: string;
    entry_id: string;
    ar_account_id: string;
    applied_amount: string;
    application_status: string;
  }>(
    `SELECT application_id, entry_id, ar_account_id, applied_amount, application_status
       FROM ar_cash_applications
      WHERE application_id = $1::uuid AND tenant_id = $2::uuid`,
    [command.cash_application_id, tenantId],
  );

  const app = appRows[0];
  if (!app) {
    throw new BillingCommandError(
      "APPLICATION_NOT_FOUND",
      `Cash application ${command.cash_application_id} not found.`,
    );
  }
  if (app.application_status === "REVERSED") {
    return app.application_id; // Idempotent
  }

  const appliedAmount = Number(app.applied_amount);

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `UPDATE ar_cash_applications
          SET application_status = 'REVERSED', reversal_reason = $1,
              reversed_at = NOW(), reversed_by = $2::uuid, updated_at = NOW(), updated_by = $2::uuid
        WHERE application_id = $3::uuid AND tenant_id = $4::uuid`,
      [command.reason ?? null, actorId, command.cash_application_id, tenantId],
    );

    // Restore city ledger balance
    await queryWithClient(
      client,
      `UPDATE ar_city_ledger
          SET outstanding_balance = outstanding_balance + $1,
              entry_status = CASE WHEN entry_status = 'PAID' THEN 'OPEN' ELSE entry_status END,
              updated_at = NOW()
        WHERE entry_id = $2::uuid AND tenant_id = $3::uuid`,
      [appliedAmount, app.entry_id, tenantId],
    );

    // Restore AR account balance
    await queryWithClient(
      client,
      `UPDATE ar_accounts
          SET outstanding_balance = outstanding_balance + $1, updated_at = NOW()
        WHERE ar_account_id = $2::uuid AND tenant_id = $3::uuid`,
      [appliedAmount, app.ar_account_id, tenantId],
    );
  });

  appLogger.info(
    { applicationId: command.cash_application_id, amount: appliedAmount },
    "AR cash application reversed",
  );
  return command.cash_application_id;
};

// ─── Disputes ────────────────────────────────────────────────────────────────

/**
 * Raise a dispute on a city ledger entry.
 */
export const raiseArDispute = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArDisputeRaiseCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rows: entryRows } = await query<{
    entry_id: string;
    ar_account_id: string;
    outstanding_balance: string;
    entry_status: string;
  }>(
    `SELECT entry_id, ar_account_id, outstanding_balance, entry_status
       FROM ar_city_ledger
      WHERE entry_id = $1::uuid AND tenant_id = $2::uuid`,
    [command.city_ledger_id, tenantId],
  );

  const entry = entryRows[0];
  if (!entry) {
    throw new BillingCommandError(
      "CITY_LEDGER_NOT_FOUND",
      `City ledger entry ${command.city_ledger_id} not found.`,
    );
  }

  const disputedAmount = command.disputed_amount ?? Number(entry.outstanding_balance);

  const { rows } = await withTransaction(async (client) => {
    const inserted = await queryWithClient<{ dispute_id: string }>(
      client,
      `INSERT INTO ar_disputes (
          tenant_id, property_id, ar_account_id, entry_id,
          dispute_reason, dispute_amount, currency, dispute_notes,
          created_by
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid,
          $5, $6, 'USD', $7,
          $8::uuid
        ) RETURNING dispute_id`,
      [
        tenantId,
        command.property_id,
        entry.ar_account_id,
        command.city_ledger_id,
        command.reason.length > 20 ? "OTHER" : "AMOUNT_INCORRECT",
        disputedAmount,
        command.reason,
        command.raised_by ? (asUuid(command.raised_by) ?? actorId) : actorId,
      ],
    );

    // Set city ledger entry to DISPUTED
    await queryWithClient(
      client,
      `UPDATE ar_city_ledger SET entry_status = 'DISPUTED',
          dispute_id = $1::uuid, updated_at = NOW()
        WHERE entry_id = $2::uuid AND tenant_id = $3::uuid`,
      [inserted.rows[0]?.dispute_id, command.city_ledger_id, tenantId],
    );

    return inserted;
  });

  const disputeId = rows[0]?.dispute_id;
  appLogger.info(
    { disputeId, entryId: command.city_ledger_id, amount: disputedAmount },
    "AR dispute raised",
  );
  return disputeId ?? command.city_ledger_id;
};

/**
 * Resolve a dispute.
 */
export const resolveArDispute = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArDisputeResolveCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rows: disputeRows } = await query<{
    dispute_id: string;
    entry_id: string;
    dispute_amount: string;
    dispute_status: string;
  }>(
    `SELECT dispute_id, entry_id, dispute_amount, dispute_status
       FROM ar_disputes WHERE dispute_id = $1::uuid AND tenant_id = $2::uuid`,
    [command.dispute_id, tenantId],
  );

  const dispute = disputeRows[0];
  if (!dispute) {
    throw new BillingCommandError("DISPUTE_NOT_FOUND", `Dispute ${command.dispute_id} not found.`);
  }

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `UPDATE ar_disputes
          SET dispute_status = 'RESOLVED',
              resolved_at = NOW(), resolved_by = $1::uuid,
              resolution_outcome = CASE
                WHEN $2 = 0 THEN 'UPHELD'
                WHEN $2 >= dispute_amount THEN 'REJECTED'
                ELSE 'PARTIAL'
              END,
              resolution_notes = $3,
              updated_at = NOW(), updated_by = $1::uuid
        WHERE dispute_id = $4::uuid AND tenant_id = $5::uuid`,
      [
        actorId,
        command.resolved_amount,
        command.resolution_notes ?? null,
        command.dispute_id,
        tenantId,
      ],
    );

    // Re-open city ledger entry for collection
    await queryWithClient(
      client,
      `UPDATE ar_city_ledger
          SET entry_status = 'OPEN',
              outstanding_balance = $1,
              dispute_id = NULL, updated_at = NOW()
        WHERE entry_id = $2::uuid AND tenant_id = $3::uuid`,
      [command.resolved_amount, dispute.entry_id, tenantId],
    );
  });

  appLogger.info(
    { disputeId: command.dispute_id, resolvedAmount: command.resolved_amount },
    "AR dispute resolved",
  );
  return command.dispute_id;
};

/**
 * Escalate a dispute to management/collections.
 */
export const escalateArDispute = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = ArDisputeEscalateCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  const { rowCount } = await query(
    `UPDATE ar_disputes
        SET dispute_status = 'ESCALATED',
            escalated_at = NOW(), escalated_by = $1::uuid,
            escalation_notes = $2,
            updated_at = NOW(), updated_by = $1::uuid
      WHERE dispute_id = $3::uuid AND tenant_id = $4::uuid
        AND dispute_status IN ('OPEN', 'UNDER_REVIEW')`,
    [actorId, command.escalation_notes ?? null, command.dispute_id, tenantId],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "DISPUTE_ESCALATE_FAILED",
      `Dispute ${command.dispute_id} not found or already resolved/escalated.`,
    );
  }

  appLogger.info({ disputeId: command.dispute_id }, "AR dispute escalated");
  auditAsync({
    tenantId,
    propertyId: command.property_id,
    userId: actorId,
    action: "AR_DISPUTE_ESCALATE",
    entityType: "ar_dispute",
    entityId: command.dispute_id,
    severity: "WARNING",
    description: `Dispute ${command.dispute_id} escalated`,
    newValues: { escalation_notes: command.escalation_notes ?? null },
  });
  return command.dispute_id;
};
