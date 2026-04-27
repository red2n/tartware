import type {
  BillingLedgerEntryInsertInput,
  BusinessDateRow,
  ChargeLedgerSourceRow,
  GeneralLedgerBatches,
  PaymentLedgerSourceRow,
} from "@tartware/schemas";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingLedgerPostCommand,
  BillingLedgerPostCommandSchema,
} from "../../schemas/billing-commands.js";
import { parseDbMoneyOrZero } from "../../utils/money.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

const GUEST_LEDGER_ACCOUNT = "1100";
const TAX_LIABILITY_ACCOUNT = "2100";

/**
 * Build or rebuild a property's ledger batch for a business date from billing source tables.
 */
export const postLedger = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingLedgerPostCommandSchema.parse(payload);
  return rebuildLedgerBatch(command, context);
};

const rebuildLedgerBatch = async (
  command: BillingLedgerPostCommand,
  context: CommandContext,
): Promise<string> => {
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const businessDate =
    command.business_date != null
      ? toDateOnly(command.business_date)
      : await resolveBusinessDate(context.tenantId, command.property_id);
  const batchNumber = `GL-${businessDate.replaceAll("-", "")}`;
  const accountingPeriod = businessDate.slice(0, 7);

  return withTransaction(async (client) => {
    await queryWithClient(client, `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      `${context.tenantId}:${command.property_id}`,
      businessDate,
    ]);

    const batchResult = await queryWithClient<Pick<GeneralLedgerBatches, "gl_batch_id">>(
      client,
      `
        INSERT INTO public.general_ledger_batches (
          tenant_id,
          property_id,
          batch_number,
          batch_date,
          accounting_period,
          source_module,
          currency,
          debit_total,
          credit_total,
          entry_count,
          batch_status,
          export_format,
          created_by,
          updated_at,
          updated_by
        ) VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4::date,
          $5,
          'PMS',
          'USD',
          0,
          0,
          0,
          'OPEN',
          'USALI',
          $6::uuid,
          NOW(),
          $6::uuid
        )
        ON CONFLICT (tenant_id, property_id, batch_number) DO UPDATE
        SET
          batch_date = EXCLUDED.batch_date,
          accounting_period = EXCLUDED.accounting_period,
          currency = EXCLUDED.currency,
          debit_total = 0,
          credit_total = 0,
          entry_count = 0,
          batch_status = 'OPEN',
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
        RETURNING gl_batch_id
      `,
      [context.tenantId, command.property_id, batchNumber, businessDate, accountingPeriod, actorId],
    );

    const batchId = batchResult.rows[0]?.gl_batch_id;
    if (!batchId) {
      throw new BillingCommandError(
        "LEDGER_BATCH_UPSERT_FAILED",
        "Failed to create or update the ledger batch.",
      );
    }

    await queryWithClient(
      client,
      `DELETE FROM public.general_ledger_entries WHERE gl_batch_id = $1::uuid AND tenant_id = $2::uuid`,
      [batchId, context.tenantId],
    );

    const chargeRows = await loadChargeSources(
      client,
      context.tenantId,
      command.property_id,
      businessDate,
    );
    const paymentRows = await loadPaymentSources(
      client,
      context.tenantId,
      command.property_id,
      businessDate,
    );

    const entries = [
      ...buildChargeEntries({
        rows: chargeRows,
        tenantId: context.tenantId,
        batchId,
        actorId,
      }),
      ...buildPaymentEntries({
        rows: paymentRows,
        tenantId: context.tenantId,
        batchId,
        actorId,
      }),
    ];

    for (const entry of entries) {
      await insertLedgerEntry(client, entry);
    }

    const debitTotal = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
    const creditTotal = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);
    const batchStatus =
      entries.length === 0
        ? "OPEN"
        : Math.abs(debitTotal - creditTotal) < 0.005
          ? "REVIEW"
          : "ERROR";

    await queryWithClient(
      client,
      `
        UPDATE public.general_ledger_batches
        SET
          debit_total = $2,
          credit_total = $3,
          entry_count = $4,
          batch_status = $5,
          updated_at = NOW(),
          updated_by = $6::uuid
        WHERE gl_batch_id = $1::uuid AND tenant_id = $7::uuid
      `,
      [batchId, debitTotal, creditTotal, entries.length, batchStatus, actorId, context.tenantId],
    );

    appLogger.info(
      {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        businessDate,
        batchId,
        batchNumber,
        entryCount: entries.length,
        debitTotal,
        creditTotal,
        batchStatus,
        chargeSourceCount: chargeRows.length,
        paymentSourceCount: paymentRows.length,
      },
      "Ledger batch rebuilt from billing source tables",
    );

    return batchId;
  });
};

const resolveBusinessDate = async (tenantId: string, propertyId: string): Promise<string> => {
  const result = await query<Pick<BusinessDateRow, "business_date">>(
    `
      SELECT business_date
      FROM public.business_dates
      WHERE tenant_id = $1::uuid
        AND property_id = $2::uuid
      LIMIT 1
    `,
    [tenantId, propertyId],
  );

  const businessDate = result.rows[0]?.business_date;
  if (!businessDate) {
    throw new BillingCommandError(
      "BUSINESS_DATE_NOT_FOUND",
      `No business date found for property ${propertyId}.`,
    );
  }
  return toDateOnly(businessDate);
};

const loadChargeSources = async (
  client: Parameters<typeof queryWithClient>[0],
  tenantId: string,
  propertyId: string,
  businessDate: string,
): Promise<ChargeLedgerSourceRow[]> => {
  const result = await queryWithClient<ChargeLedgerSourceRow>(
    client,
    `
      SELECT
        cp.posting_id,
        cp.property_id,
        cp.folio_id,
        cp.reservation_id,
        cp.posting_date,
        COALESCE(cp.department_code, cc.department_code) AS department_code,
        cp.charge_code,
        cp.charge_description,
        cp.charge_category,
        cp.posting_type,
        cp.subtotal,
        cp.tax_amount,
        cp.service_charge,
        cp.discount_amount,
        cp.total_amount,
        cp.currency_code,
        cp.gl_account,
        cc.revenue_group,
        r.confirmation_number,
        f.folio_number
      FROM public.charge_postings cp
      LEFT JOIN public.charge_codes cc
        ON cc.code = cp.charge_code
      LEFT JOIN public.reservations r
        ON r.id = cp.reservation_id
       AND COALESCE(r.is_deleted, false) = false
      LEFT JOIN public.folios f
        ON f.folio_id = cp.folio_id
       AND COALESCE(f.is_deleted, false) = false
      WHERE cp.tenant_id = $1::uuid
        AND cp.property_id = $2::uuid
        AND cp.business_date = $3::date
        AND COALESCE(cp.is_deleted, false) = false
        AND COALESCE(cp.is_voided, false) = false
        AND cp.transaction_type IN ('CHARGE', 'ADJUSTMENT', 'TRANSFER', 'VOID')
      ORDER BY cp.posting_date, cp.posting_time, cp.posting_id
    `,
    [tenantId, propertyId, businessDate],
  );

  return result.rows;
};

const loadPaymentSources = async (
  client: Parameters<typeof queryWithClient>[0],
  tenantId: string,
  propertyId: string,
  businessDate: string,
): Promise<PaymentLedgerSourceRow[]> => {
  const result = await queryWithClient<PaymentLedgerSourceRow>(
    client,
    `
      SELECT
        p.id,
        p.property_id,
        p.reservation_id,
        f.folio_id,
        COALESCE(p.processed_at, p.created_at) AS payment_date,
        p.payment_reference,
        p.transaction_type,
        p.payment_method,
        p.amount,
        p.currency,
        r.confirmation_number,
        f.folio_number
      FROM public.payments p
      LEFT JOIN public.reservations r
        ON r.id = p.reservation_id
       AND COALESCE(r.is_deleted, false) = false
      LEFT JOIN LATERAL (
        SELECT folio_id, folio_number
        FROM public.folios f
        WHERE f.tenant_id = p.tenant_id
          AND f.reservation_id = p.reservation_id
          AND COALESCE(f.is_deleted, false) = false
        ORDER BY f.created_at DESC
        LIMIT 1
      ) f ON TRUE
      WHERE p.tenant_id = $1::uuid
        AND p.property_id = $2::uuid
        AND COALESCE(p.is_deleted, false) = false
        AND DATE(COALESCE(p.processed_at, p.created_at)) = $3::date
        AND p.transaction_type IN ('CAPTURE', 'REFUND', 'PARTIAL_REFUND')
        AND p.status IN ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED')
      ORDER BY COALESCE(p.processed_at, p.created_at), p.id
    `,
    [tenantId, propertyId, businessDate],
  );

  return result.rows;
};

const buildChargeEntries = ({
  rows,
  tenantId,
  batchId,
  actorId,
}: {
  rows: ChargeLedgerSourceRow[];
  tenantId: string;
  batchId: string;
  actorId: string;
}): BillingLedgerEntryInsertInput[] => {
  const entries: BillingLedgerEntryInsertInput[] = [];

  for (const row of rows) {
    const subtotal = parseDbMoneyOrZero(row.subtotal);
    const taxAmount = parseDbMoneyOrZero(row.tax_amount);
    const serviceCharge = parseDbMoneyOrZero(row.service_charge);
    const discountAmount = parseDbMoneyOrZero(row.discount_amount);
    const revenueAmount = Math.max(subtotal + serviceCharge - discountAmount, 0);
    const totalAmount = parseDbMoneyOrZero(row.total_amount);
    const direction = row.posting_type === "CREDIT" ? "credit" : "debit";
    const postingDate = toDateOnly(row.posting_date);
    const currency = row.currency_code ?? "USD";
    const departmentCode = row.department_code ?? inferDepartmentCode(row.revenue_group);
    const referenceNumber = row.confirmation_number ?? row.folio_number ?? row.posting_id;

    if (totalAmount > 0) {
      entries.push(
        createLedgerEntry({
          gl_batch_id: batchId,
          tenant_id: tenantId,
          property_id: row.property_id,
          folio_id: row.folio_id,
          reservation_id: row.reservation_id,
          department_code: departmentCode,
          posting_date: postingDate,
          gl_account_code: GUEST_LEDGER_ACCOUNT,
          cost_center: departmentCode,
          usali_category: "Guest Ledger",
          description: `${row.charge_code} ${direction === "debit" ? "charge" : "credit"} - ${row.charge_description}`,
          amount: totalAmount,
          direction,
          accountingSide: "guest-ledger",
          currency,
          source_table: "charge_postings",
          source_id: row.posting_id,
          reference_number: referenceNumber,
          created_by: actorId,
          updated_by: actorId,
        }),
      );
    }

    if (revenueAmount > 0) {
      entries.push(
        createLedgerEntry({
          gl_batch_id: batchId,
          tenant_id: tenantId,
          property_id: row.property_id,
          folio_id: row.folio_id,
          reservation_id: row.reservation_id,
          department_code: departmentCode,
          posting_date: postingDate,
          gl_account_code: mapRevenueAccount(row),
          cost_center: departmentCode,
          usali_category: mapUsaliCategory(row),
          description: `${row.charge_code} revenue - ${row.charge_description}`,
          amount: revenueAmount,
          direction,
          accountingSide: "offset",
          currency,
          source_table: "charge_postings",
          source_id: row.posting_id,
          reference_number: referenceNumber,
          created_by: actorId,
          updated_by: actorId,
        }),
      );
    }

    if (taxAmount > 0) {
      entries.push(
        createLedgerEntry({
          gl_batch_id: batchId,
          tenant_id: tenantId,
          property_id: row.property_id,
          folio_id: row.folio_id,
          reservation_id: row.reservation_id,
          department_code: departmentCode,
          posting_date: postingDate,
          gl_account_code: TAX_LIABILITY_ACCOUNT,
          cost_center: departmentCode,
          usali_category: "Taxes",
          description: `${row.charge_code} tax - ${row.charge_description}`,
          amount: taxAmount,
          direction,
          accountingSide: "offset",
          currency,
          source_table: "charge_postings",
          source_id: row.posting_id,
          reference_number: referenceNumber,
          created_by: actorId,
          updated_by: actorId,
        }),
      );
    }
  }

  return entries;
};

const buildPaymentEntries = ({
  rows,
  tenantId,
  batchId,
  actorId,
}: {
  rows: PaymentLedgerSourceRow[];
  tenantId: string;
  batchId: string;
  actorId: string;
}): BillingLedgerEntryInsertInput[] => {
  const entries: BillingLedgerEntryInsertInput[] = [];

  for (const row of rows) {
    const amount = parseDbMoneyOrZero(row.amount);
    if (amount <= 0) {
      continue;
    }

    const isRefund = row.transaction_type === "REFUND" || row.transaction_type === "PARTIAL_REFUND";
    const direction = isRefund ? "credit" : "debit";
    const postingDate = toDateOnly(row.payment_date);
    const currency = row.currency ?? "USD";
    const referenceNumber = row.payment_reference;
    const cashAccount = mapPaymentAccount(row.payment_method);

    entries.push(
      createLedgerEntry({
        gl_batch_id: batchId,
        tenant_id: tenantId,
        property_id: row.property_id,
        folio_id: row.folio_id,
        reservation_id: row.reservation_id,
        department_code: "CASHIER",
        posting_date: postingDate,
        gl_account_code: cashAccount,
        cost_center: "CASHIER",
        usali_category: "Cash and Cash Equivalents",
        description: `${row.transaction_type} ${row.payment_method ?? "payment"} - ${row.payment_reference}`,
        amount,
        direction,
        accountingSide: "offset",
        currency,
        source_table: "payments",
        source_id: row.id,
        reference_number: referenceNumber,
        created_by: actorId,
        updated_by: actorId,
      }),
    );
    entries.push(
      createLedgerEntry({
        gl_batch_id: batchId,
        tenant_id: tenantId,
        property_id: row.property_id,
        folio_id: row.folio_id,
        reservation_id: row.reservation_id,
        department_code: "CASHIER",
        posting_date: postingDate,
        gl_account_code: GUEST_LEDGER_ACCOUNT,
        cost_center: "CASHIER",
        usali_category: "Guest Ledger",
        description: `${isRefund ? "Refund" : "Payment"} settlement - ${row.payment_reference}`,
        amount,
        direction,
        accountingSide: "guest-ledger",
        currency,
        source_table: "payments",
        source_id: row.id,
        reference_number: referenceNumber,
        created_by: actorId,
        updated_by: actorId,
      }),
    );
  }

  return entries;
};

const createLedgerEntry = ({
  amount,
  direction,
  accountingSide,
  ...rest
}: Omit<BillingLedgerEntryInsertInput, "debit_amount" | "credit_amount" | "status"> & {
  amount: number;
  direction: "debit" | "credit";
  accountingSide: "guest-ledger" | "offset";
}): BillingLedgerEntryInsertInput => {
  const debitAmount =
    (direction === "debit" && accountingSide === "guest-ledger") ||
    (direction === "credit" && accountingSide === "offset")
      ? amount
      : 0;
  const creditAmount =
    (direction === "debit" && accountingSide === "offset") ||
    (direction === "credit" && accountingSide === "guest-ledger")
      ? amount
      : 0;

  return {
    ...rest,
    debit_amount: roundMoney(debitAmount),
    credit_amount: roundMoney(creditAmount),
    status: "READY",
  };
};

const insertLedgerEntry = async (
  client: Parameters<typeof queryWithClient>[0],
  entry: BillingLedgerEntryInsertInput,
): Promise<void> => {
  await queryWithClient(
    client,
    `
      INSERT INTO public.general_ledger_entries (
        gl_batch_id,
        tenant_id,
        property_id,
        folio_id,
        reservation_id,
        department_code,
        posting_date,
        gl_account_code,
        cost_center,
        usali_category,
        description,
        debit_amount,
        credit_amount,
        currency,
        exchange_rate,
        base_currency,
        base_amount,
        source_table,
        source_id,
        reference_number,
        status,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6,
        $7::date,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        1.0,
        $14,
        CASE
          WHEN $12 > 0 THEN $12
          ELSE $13
        END,
        $15,
        $16::uuid,
        $17,
        $18,
        $19::uuid,
        $20::uuid
      )
    `,
    [
      entry.gl_batch_id,
      entry.tenant_id,
      entry.property_id,
      entry.folio_id ?? null,
      entry.reservation_id ?? null,
      entry.department_code ?? null,
      entry.posting_date,
      entry.gl_account_code,
      entry.cost_center ?? null,
      entry.usali_category ?? null,
      entry.description,
      entry.debit_amount,
      entry.credit_amount,
      entry.currency,
      entry.source_table,
      entry.source_id,
      entry.reference_number ?? null,
      entry.status,
      entry.created_by,
      entry.updated_by,
    ],
  );
};

const mapRevenueAccount = (row: ChargeLedgerSourceRow): string => {
  if (row.gl_account) {
    return row.gl_account;
  }

  const category = (row.revenue_group ?? row.charge_category ?? row.charge_code).toUpperCase();
  switch (category) {
    case "ROOMS":
    case "ROOM":
      return "4000";
    case "FB":
    case "F&B":
    case "FOOD & BEVERAGE":
      return "4100";
    case "FEES":
      return "4200";
    case "SPA":
      return "4300";
    case "TAXES":
      return TAX_LIABILITY_ACCOUNT;
    default:
      return "4900";
  }
};

const mapUsaliCategory = (row: ChargeLedgerSourceRow): string => {
  const category = (row.revenue_group ?? row.charge_category ?? row.charge_code).toUpperCase();
  switch (category) {
    case "ROOMS":
    case "ROOM":
      return "Rooms Revenue";
    case "FB":
    case "F&B":
    case "FOOD & BEVERAGE":
      return "Food and Beverage Revenue";
    case "FEES":
      return "Other Operated Departments";
    case "SPA":
      return "Spa Revenue";
    case "TAXES":
      return "Taxes";
    default:
      return "Miscellaneous Income";
  }
};

const inferDepartmentCode = (revenueGroup: string | null): string => {
  switch ((revenueGroup ?? "").toUpperCase()) {
    case "ROOMS":
      return "ROOMS";
    case "FB":
      return "FB";
    case "SPA":
      return "SPA";
    case "FEES":
      return "FEES";
    default:
      return "MISC";
  }
};

const mapPaymentAccount = (paymentMethod: string | null): string => {
  switch ((paymentMethod ?? "").toUpperCase()) {
    case "CASH":
      return "1010";
    case "BANK_TRANSFER":
      return "1020";
    case "CREDIT_CARD":
    case "DEBIT_CARD":
    case "DIGITAL_WALLET":
    case "GIFT_CARD":
    case "CRYPTOCURRENCY":
      return "1030";
    case "DIRECT_BILL":
      return "1040";
    case "LOYALTY_POINTS":
      return "1050";
    default:
      return "1090";
  }
};

const roundMoney = (value: number): number => Number(value.toFixed(2));

const toDateOnly = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0] ?? "";
  }
  return value.split("T")[0] ?? value;
};
