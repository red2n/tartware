import {
  type CashierSessionListItem,
  CashierSessionListItemSchema,
  type CashierSessionRow,
  type ShiftSummaryResponse,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  CASHIER_SESSION_BY_ID_SQL,
  CASHIER_SESSION_LIST_SQL,
  SHIFT_SUMMARY_SQL,
} from "../sql/cashier-queries.js";
import { toNumberOrFallback } from "@tartware/config";

const formatEnumDisplay = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
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

// ============================================================================
// CASHIER SESSIONS
// ============================================================================

// CashierSessionRow imported from @tartware/schemas

const mapRowToCashierSession = (row: CashierSessionRow): CashierSessionListItem => {
  const { display: statusDisplay } = formatEnumDisplay(row.session_status, "Open");

  return CashierSessionListItemSchema.parse({
    session_id: row.session_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    session_number: row.session_number,
    session_name: row.session_name ?? undefined,
    cashier_id: row.cashier_id,
    cashier_name: row.cashier_name ?? undefined,
    terminal_id: row.terminal_id ?? undefined,
    terminal_name: row.terminal_name ?? undefined,
    location: row.location ?? undefined,
    session_status: row.session_status.toLowerCase(),
    session_status_display: statusDisplay,
    opened_at: toIsoString(row.opened_at) ?? "",
    closed_at: toIsoString(row.closed_at),
    business_date:
      row.business_date instanceof Date
        ? row.business_date.toISOString().split("T")[0]
        : String(row.business_date),
    shift_type: row.shift_type ?? undefined,
    opening_float_declared: String(toNumberOrFallback(row.opening_float_declared)),
    total_transactions: row.total_transactions ?? undefined,
    total_revenue:
      row.total_revenue != null ? String(toNumberOrFallback(row.total_revenue)) : undefined,
    total_refunds:
      row.total_refunds != null ? String(toNumberOrFallback(row.total_refunds)) : undefined,
    net_revenue: row.net_revenue != null ? String(toNumberOrFallback(row.net_revenue)) : undefined,
    expected_cash_balance:
      row.expected_cash_balance != null
        ? String(toNumberOrFallback(row.expected_cash_balance))
        : undefined,
    closing_cash_counted:
      row.closing_cash_counted != null
        ? String(toNumberOrFallback(row.closing_cash_counted))
        : undefined,
    cash_variance:
      row.cash_variance != null ? String(toNumberOrFallback(row.cash_variance)) : undefined,
    has_variance: row.has_variance ?? undefined,
    reconciled: row.reconciled ?? undefined,
    approved: row.approved ?? undefined,
    created_at: toIsoString(row.created_at as string | Date | null),
  });
};

/**
 * List cashier sessions with optional filters.
 */
export const listCashierSessions = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  sessionStatus?: string;
  shiftType?: string;
  businessDate?: string;
  offset?: number;
}): Promise<CashierSessionListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const sessionStatus = options.sessionStatus ?? null;
  const shiftType = options.shiftType ?? null;
  const businessDate = options.businessDate ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<CashierSessionRow>(CASHIER_SESSION_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    sessionStatus,
    shiftType,
    businessDate,
    offset,
  ]);

  return rows.map(mapRowToCashierSession);
};

/**
 * Get cashier session by ID.
 */
export const getCashierSessionById = async (
  sessionId: string,
  tenantId: string,
): Promise<CashierSessionListItem | null> => {
  const { rows } = await query<CashierSessionRow>(CASHIER_SESSION_BY_ID_SQL, [sessionId, tenantId]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapRowToCashierSession(row);
};

// ============================================================================
// SHIFT HANDOVER SUMMARY
// ============================================================================

type ShiftSummary = ShiftSummaryResponse;

/**
 * Get a shift summary for a cashier session — transaction totals,
 * cash reconciliation, and handover notes.
 */
export const getShiftSummary = async (
  sessionId: string,
  tenantId: string,
): Promise<ShiftSummary | null> => {
  const { rows } = await query<Record<string, unknown>>(SHIFT_SUMMARY_SQL, [sessionId, tenantId]);

  const row = rows[0];
  if (!row) return null;

  const metadata = row.metadata as Record<string, unknown> | null;

  return {
    session_id: row.session_id as string,
    session_number: row.session_number as string,
    cashier_name: row.cashier_name as string,
    terminal_id: (row.terminal_id as string) ?? null,
    shift_type: row.shift_type as string,
    session_status: row.session_status as string,
    business_date: String(row.business_date).slice(0, 10),
    opened_at: String(row.opened_at),
    closed_at: row.closed_at ? String(row.closed_at) : null,
    opening_float: toNumberOrFallback(row.opening_float_declared, 0),
    closing_cash_counted:
      row.closing_cash_counted != null ? toNumberOrFallback(row.closing_cash_counted, 0) : null,
    cash_variance: row.cash_variance != null ? toNumberOrFallback(row.cash_variance, 0) : null,
    has_variance: Boolean(row.has_variance),
    reconciled: Boolean(row.reconciled),
    total_transactions: Number(row.total_transactions ?? 0),
    total_revenue: toNumberOrFallback(row.total_revenue, 0),
    total_refunds: toNumberOrFallback(row.total_refunds, 0),
    net_revenue: toNumberOrFallback(row.net_revenue, 0),
    charge_count: Number(row.charge_count ?? 0),
    charge_total: toNumberOrFallback(row.charge_total, 0),
    payment_count: Number(row.payment_count ?? 0),
    payment_total: toNumberOrFallback(row.payment_total, 0),
    handover_notes: (metadata?.handover_notes as string) ?? null,
  };
};
