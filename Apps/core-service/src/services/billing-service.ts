import { z } from "zod";

import { query } from "../lib/db.js";
import { BILLING_PAYMENT_LIST_SQL } from "../sql/billing-queries.js";
import { toNumberOrFallback } from "../utils/numbers.js";

export const BillingPaymentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  property_name: z.string().optional(),
  reservation_id: z.string().uuid().optional(),
  confirmation_number: z.string().optional(),
  guest_id: z.string().uuid().optional(),
  guest_name: z.string().optional(),
  payment_reference: z.string(),
  external_transaction_id: z.string().optional(),
  transaction_type: z.string(),
  transaction_type_display: z.string(),
  payment_method: z.string(),
  payment_method_display: z.string(),
  status: z.string(),
  status_display: z.string(),
  amount: z.number(),
  currency: z.string(),
  processed_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  version: z.string(),
  gateway_name: z.string().optional(),
  gateway_reference: z.string().optional(),
});

export type BillingPayment = z.infer<typeof BillingPaymentSchema>;

type BillingPaymentRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  reservation_id: string | null;
  confirmation_number: string | null;
  guest_id: string | null;
  reservation_guest_name: string | null;
  reservation_guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  payment_reference: string;
  external_transaction_id: string | null;
  transaction_type: string | null;
  payment_method: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  gateway_name: string | null;
  gateway_reference: string | null;
  processed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  version: bigint | null;
};

const formatEnumDisplay = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value) {
    const formatted = fallback.toLowerCase();
    return { value: formatted, display: fallback };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { value: normalized, display };
};

const toIsoString = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const resolveGuestName = (row: BillingPaymentRow): string | undefined => {
  if (row.reservation_guest_name) {
    return row.reservation_guest_name;
  }
  if (row.guest_first_name || row.guest_last_name) {
    return `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim() || undefined;
  }
  return undefined;
};

const mapRowToPayment = (row: BillingPaymentRow): BillingPayment => {
  const { value: transactionType, display: transactionTypeDisplay } = formatEnumDisplay(
    row.transaction_type,
    "Unknown",
  );
  const { value: paymentMethod, display: paymentMethodDisplay } = formatEnumDisplay(
    row.payment_method,
    "Unknown",
  );
  const { value: status, display: statusDisplay } = formatEnumDisplay(row.status, "Unknown");

  return BillingPaymentSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    confirmation_number: row.confirmation_number ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: resolveGuestName(row),
    payment_reference: row.payment_reference,
    external_transaction_id: row.external_transaction_id ?? undefined,
    transaction_type: transactionType,
    transaction_type_display: transactionTypeDisplay,
    payment_method: paymentMethod,
    payment_method_display: paymentMethodDisplay,
    status,
    status_display: statusDisplay,
    amount: toNumberOrFallback(row.amount),
    currency: row.currency ?? "USD",
    processed_at: toIsoString(row.processed_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
    version: row.version ? row.version.toString() : "0",
    gateway_name: row.gateway_name ?? undefined,
    gateway_reference: row.gateway_reference ?? undefined,
  });
};

export const listBillingPayments = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  transactionType?: string;
  paymentMethod?: string;
}): Promise<BillingPayment[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const transactionType = options.transactionType
    ? options.transactionType.trim().toUpperCase()
    : null;
  const paymentMethod = options.paymentMethod ? options.paymentMethod.trim().toUpperCase() : null;

  const { rows } = await query<BillingPaymentRow>(BILLING_PAYMENT_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    transactionType,
    paymentMethod,
  ]);

  return rows.map(mapRowToPayment);
};
