/**
 * GL Posting Helper — paired double-entry bookkeeping inside the source transaction.
 *
 * Every revenue-affecting command (charge, payment, refund, void, comp, AR write-off)
 * MUST call `postGlPair()` from inside its own `withTransaction(client => ...)`
 * block, immediately after inserting the source row (charge_posting or payment).
 *
 * Design rationale (USALI 12th Ed + accounts-gaps/01-gl-journal-entries.md):
 *   1. Two `general_ledger_entries` rows are inserted: one DR, one CR. They
 *      always sum to zero. Constraint `chk_gl_entry_amount` guarantees the
 *      sign convention.
 *   2. Both rows belong to the SAME daily `general_ledger_batches` row, scoped
 *      by (tenant, property, business_date). The batch is upserted on first
 *      use of the day and totals are atomically updated by the same statement
 *      so the batch is never out-of-sync.
 *   3. All inserts run on the supplied `PoolClient` — they share the source
 *      transaction. If the source charge/payment commit fails, the GL pair
 *      rolls back automatically. No half-posted books, ever.
 *
 * Performance (20K ops/sec):
 *   - 1 batch upsert (cached after first call of the day per (tenant, property))
 *   - 2 GL entry inserts + 1 batch totals update — combined into a single CTE
 *     so each `postGlPair` call costs ONE round-trip on the steady-state path.
 */

import { createReferenceCache } from "@tartware/fastify-server/reference-cache";
import type { GlPostingPairInput } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { queryWithClient } from "./db.js";

// ---------------------------------------------------------------------------
// Daily batch resolver — backed by shared reference cache (LRU + TTL).
// Cache key: `${tenantId}|${propertyId}|${businessDate}`
// TTL is 26 h so a still-active batch survives a midnight rollover; LRU
// eviction caps memory growth on long-lived processes.
// ---------------------------------------------------------------------------

type BatchKey = { tenantId: string; propertyId: string; businessDate: string; currency: string };

const BATCH_CACHE = createReferenceCache<BatchKey, string>({
  name: "gl-batch",
  maxSize: 4096,
  ttlMs: 26 * 60 * 60 * 1000,
  keyFn: (k) => `${k.tenantId}|${k.propertyId}|${k.businessDate}`,
  // Loader is unused — `getOrOpenDailyBatch` does the upsert directly because
  // the helper needs a `PoolClient` from the caller's transaction. We treat
  // this cache as a write-through store: invalidate on miss, fill manually.
  loader: async () => null,
});

const buildBatchNumber = (businessDate: string): string => {
  // YYYYMMDD-PMS — one batch per day per property
  return `${businessDate.replace(/-/g, "")}-PMS`;
};

/**
 * Look up or create the OPEN GL batch for today. Cached in-process; cache
 * miss does an idempotent upsert.
 */
const getOrOpenDailyBatch = async (
  client: PoolClient,
  params: {
    tenantId: string;
    propertyId: string;
    businessDate: string; // YYYY-MM-DD
    currency: string;
  },
): Promise<string> => {
  const cacheKey: BatchKey = {
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    businessDate: params.businessDate,
    currency: params.currency,
  };
  const cached = await BATCH_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const batchNumber = buildBatchNumber(params.businessDate);
  const accountingPeriod = params.businessDate.slice(0, 7); // YYYY-MM

  const { rows } = await queryWithClient<{ gl_batch_id: string }>(
    client,
    `
      INSERT INTO public.general_ledger_batches (
        tenant_id, property_id, batch_number, batch_date,
        accounting_period, source_module, currency,
        debit_total, credit_total, entry_count, batch_status
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4::date,
        $5, 'PMS', UPPER($6),
        0, 0, 0, 'OPEN'
      )
      ON CONFLICT (tenant_id, property_id, batch_number) DO UPDATE
        SET updated_at = NOW()
      RETURNING gl_batch_id
    `,
    [
      params.tenantId,
      params.propertyId,
      batchNumber,
      params.businessDate,
      accountingPeriod,
      params.currency,
    ],
  );

  const batchId = rows[0]?.gl_batch_id;
  if (!batchId) {
    // Defensive: ON CONFLICT DO UPDATE always returns a row, but typing forces a guard.
    throw new Error(
      `GL_BATCH_UPSERT_FAILED: tenant=${params.tenantId} property=${params.propertyId} date=${params.businessDate}`,
    );
  }

  BATCH_CACHE.primeMany([[cacheKey, batchId]]);
  return batchId;
};

// ---------------------------------------------------------------------------
// Paired DR/CR insert + atomic batch totals update — all in one round-trip.
// ---------------------------------------------------------------------------

/**
 * Insert a balanced (debit, credit) pair into `general_ledger_entries` and
 * atomically update `general_ledger_batches` totals.
 *
 * Must be called inside an active transaction (i.e. inside a `withTransaction`
 * callback) — the source row insert (charge_postings or payments) and the GL
 * pair must succeed or fail together.
 *
 * On any failure the helper logs and rethrows; the caller's transaction will
 * roll back, the source row will not commit, and the books will remain
 * consistent.
 */
export const postGlPair = async (
  client: PoolClient,
  input: GlPostingPairInput,
): Promise<{ debitEntryId: string; creditEntryId: string; glBatchId: string }> => {
  const glBatchId = await getOrOpenDailyBatch(client, {
    tenantId: input.tenant_id,
    propertyId: input.property_id,
    businessDate: input.posting_date,
    currency: input.currency,
  });

  // Single-statement CTE: insert DR + CR rows, then update batch totals.
  // Any constraint failure (chk_gl_entry_amount, source_table CHECK, FK) aborts
  // the whole transaction, which is exactly what we want.
  const { rows } = await queryWithClient<{
    debit_entry_id: string;
    credit_entry_id: string;
  }>(
    client,
    `
      WITH inserted AS (
        INSERT INTO public.general_ledger_entries (
          gl_batch_id, tenant_id, property_id,
          folio_id, reservation_id, department_code,
          posting_date, gl_account_code, usali_category, description,
          debit_amount, credit_amount, currency,
          source_table, source_id, reference_number,
          status, created_by
        )
        VALUES
          ($1::uuid, $2::uuid, $3::uuid,
           $4::uuid, $5::uuid, $6,
           $7::date, $8, $9, $10,
           $11::numeric, 0, UPPER($12),
           $13, $14::uuid, $15,
           'READY', $16::uuid),
          ($1::uuid, $2::uuid, $3::uuid,
           $4::uuid, $5::uuid, $6,
           $7::date, $17, $9, $10,
           0, $11::numeric, UPPER($12),
           $13, $14::uuid, $15,
           'READY', $16::uuid)
        RETURNING gl_entry_id, debit_amount
      ),
      batch_update AS (
        UPDATE public.general_ledger_batches
           SET debit_total  = debit_total  + $11::numeric,
               credit_total = credit_total + $11::numeric,
               entry_count  = entry_count  + 2,
               updated_at   = NOW()
         WHERE gl_batch_id  = $1::uuid
        RETURNING gl_batch_id
      )
      SELECT
        (SELECT gl_entry_id FROM inserted WHERE debit_amount  > 0) AS debit_entry_id,
        (SELECT gl_entry_id FROM inserted WHERE debit_amount  = 0) AS credit_entry_id
    `,
    [
      glBatchId, // $1
      input.tenant_id, // $2
      input.property_id, // $3
      input.folio_id ?? null, // $4
      input.reservation_id ?? null, // $5
      input.department_code ?? null, // $6
      input.posting_date, // $7
      input.debit_account, // $8
      input.usali_category ?? null, // $9
      input.description ?? null, // $10
      input.amount, // $11
      input.currency, // $12
      input.source_table, // $13
      input.source_id, // $14
      input.reference_number ?? null, // $15
      input.created_by ?? null, // $16
      input.credit_account, // $17
    ],
  );

  const out = rows[0];
  if (!out?.debit_entry_id || !out.credit_entry_id) {
    throw new Error(
      `GL_PAIR_INSERT_FAILED: tenant=${input.tenant_id} source=${input.source_table}/${input.source_id}`,
    );
  }
  return { debitEntryId: out.debit_entry_id, creditEntryId: out.credit_entry_id, glBatchId };
};

// ---------------------------------------------------------------------------
// Charge-code → (debit, credit) lookup, scoped to tenant.
// In-process cache; refreshed on first miss per tenant per code.
// ---------------------------------------------------------------------------

type ChargeCodeMapping = {
  debit: string;
  credit: string;
  usali: string | null;
  department: string | null;
};

const CHARGE_CODE_MAPPING_CACHE = createReferenceCache<
  { tenantId: string; chargeCode: string },
  ChargeCodeMapping
>({
  name: "charge-code-gl-mapping",
  maxSize: 8192,
  ttlMs: 60 * 60 * 1000, // 1 h
  keyFn: (k) => `${k.tenantId}|${k.chargeCode}`,
  // Write-through pattern — the lookup helper performs the DB read using the
  // caller's PoolClient (preserves RLS / transaction scope) and primes here.
  loader: async () => null,
});

/**
 * Invalidate a single tenant/charge-code mapping after a write command.
 * Call this from any handler that modifies `charge_code_gl_mapping`.
 */
export const invalidateChargeCodeMapping = (tenantId: string, chargeCode: string): void => {
  CHARGE_CODE_MAPPING_CACHE.invalidate({ tenantId, chargeCode });
};

export const lookupChargeCodeMapping = async (
  client: PoolClient,
  tenantId: string,
  chargeCode: string,
): Promise<ChargeCodeMapping | null> => {
  const cacheKey = { tenantId, chargeCode };
  const cached = await CHARGE_CODE_MAPPING_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { rows } = await queryWithClient<{
    debit_account: string;
    credit_account: string;
    usali_category: string | null;
    department_code: string | null;
  }>(
    client,
    `
      SELECT debit_account, credit_account, usali_category, department_code
      FROM public.charge_code_gl_mapping
      WHERE tenant_id = $1::uuid AND charge_code = $2 AND is_active = true AND is_deleted = false
      LIMIT 1
    `,
    [tenantId, chargeCode],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const value: ChargeCodeMapping = {
    debit: row.debit_account,
    credit: row.credit_account,
    usali: row.usali_category,
    department: row.department_code,
  };
  CHARGE_CODE_MAPPING_CACHE.primeMany([[cacheKey, value]]);
  return value;
};

// ---------------------------------------------------------------------------
// Payment-method → cash-side GL account (USALI default chart).
// In a future iteration this should be tenant-configurable via a new
// `payment_method_gl_mapping` reference table; for now the defaults match
// `scripts/tables/09-reference-data/12_charge_code_gl_mapping.sql`.
// ---------------------------------------------------------------------------

const PAYMENT_METHOD_DEBIT_ACCOUNT: Record<string, string> = {
  CASH: "1010", // Cash on hand
  CREDIT_CARD: "1020", // Credit card receivable
  DEBIT_CARD: "1020",
  BANK_TRANSFER: "1030", // Bank account
  WIRE: "1030",
  CHECK: "1040", // Checks deposited
  ACH: "1030",
  GIFT_CARD: "2300", // Gift card liability decrease
  POINTS: "2400", // Loyalty points liability decrease
};

export const debitAccountForPaymentMethod = (paymentMethod: string): string => {
  const normalised = paymentMethod.toUpperCase();
  return PAYMENT_METHOD_DEBIT_ACCOUNT[normalised] ?? "1020"; // sensible card default
};
