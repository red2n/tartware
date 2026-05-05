import { toNumberOrFallback } from "@tartware/config";
import {
  type BillingPaymentListItem,
  BillingPaymentListItemSchema,
  type BillingPaymentRow,
  type BucketCheckItem,
  type ChargePostingListItem,
  ChargePostingListItemSchema,
  type ChargePostingRow,
  type FolioListItem,
  FolioListItemSchema,
  type FolioRow,
  formatEnumDisplay,
  type PreAuditCheckItem,
  toIsoString,
} from "@tartware/schemas";
import { applyBillingRetentionPolicy } from "../lib/compliance-policies.js";
import { query } from "../lib/db.js";
import {
  BILLING_PAYMENT_LIST_SQL,
  CASHIER_SESSION_BY_ID_SQL,
  CASHIER_SESSION_LIST_SQL,
  CHARGE_POSTING_LIST_SQL,
  FOLIO_BY_ID_SQL,
  FOLIO_LIST_SQL,
} from "../sql/billing-queries.js";

/**
 * Re-export for backward compatibility.
 */
export const BillingPaymentSchema = BillingPaymentListItemSchema;
export type BillingPayment = BillingPaymentListItem;

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

/**
 * List billing payments with optional filters.
 */
export const listBillingPayments = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  transactionType?: string;
  paymentMethod?: string;
  offset?: number;
  reservationId?: string;
}): Promise<BillingPayment[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const transactionType = options.transactionType
    ? options.transactionType.trim().toUpperCase()
    : null;
  const paymentMethod = options.paymentMethod ? options.paymentMethod.trim().toUpperCase() : null;
  const offset = options.offset ?? 0;
  const reservationId = options.reservationId ?? null;

  const { rows } = await query<BillingPaymentRow>(BILLING_PAYMENT_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    transactionType,
    paymentMethod,
    offset,
    reservationId,
  ]);

  return rows.map((row) => applyBillingRetentionPolicy(mapRowToPayment(row)));
};

// ============================================================================
// FOLIOS
// ============================================================================

const mapRowToFolio = (row: FolioRow): FolioListItem => {
  const { value: folioType, display: folioTypeDisplay } = formatEnumDisplay(
    row.folio_type,
    "Guest",
  );
  const { value: folioStatus, display: folioStatusDisplay } = formatEnumDisplay(
    row.folio_status,
    "Open",
  );

  return FolioListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    folio_number: row.folio_number,
    folio_type: folioType,
    folio_type_display: folioTypeDisplay,
    folio_status: folioStatus,
    folio_status_display: folioStatusDisplay,
    reservation_id: row.reservation_id ?? undefined,
    confirmation_number: row.confirmation_number ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    company_name: row.company_name ?? undefined,
    balance: toNumberOrFallback(row.balance),
    total_charges: toNumberOrFallback(row.total_charges),
    total_payments: toNumberOrFallback(row.total_payments),
    total_credits: toNumberOrFallback(row.total_credits),
    currency: row.currency ?? "USD",
    opened_at: toIsoString(row.opened_at) ?? "",
    closed_at: toIsoString(row.closed_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * List folios with optional filters.
 */
export const listFolios = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  folioStatus?: string;
  folioType?: string;
  reservationId?: string;
  guestId?: string;
  offset?: number;
}): Promise<FolioListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const folioStatus = options.folioStatus ? options.folioStatus.trim().toUpperCase() : null;
  const folioType = options.folioType ? options.folioType.trim().toUpperCase() : null;
  const reservationId = options.reservationId ?? null;
  const guestId = options.guestId ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<FolioRow>(FOLIO_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    folioStatus,
    folioType,
    reservationId,
    guestId,
    offset,
  ]);

  return rows.map(mapRowToFolio);
};

/**
 * Get folio by ID.
 */
export const getFolioById = async (
  folioId: string,
  tenantId: string,
): Promise<FolioListItem | null> => {
  const { rows } = await query<FolioRow>(FOLIO_BY_ID_SQL, [folioId, tenantId]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapRowToFolio(row);
};

// ============================================================================
// CHARGE POSTINGS
// ============================================================================

const mapRowToChargePosting = (row: ChargePostingRow): ChargePostingListItem => {
  const { value: transactionType, display: transactionTypeDisplay } = formatEnumDisplay(
    row.transaction_type,
    "Charge",
  );
  const { value: postingType, display: postingTypeDisplay } = formatEnumDisplay(
    row.posting_type,
    "Debit",
  );

  return ChargePostingListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    folio_id: row.folio_id,
    folio_number: row.folio_number ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    posting_date: toIsoString(row.posting_date) ?? "",
    business_date: toIsoString(row.business_date) ?? "",
    transaction_type: transactionType,
    transaction_type_display: transactionTypeDisplay,
    posting_type: postingType,
    posting_type_display: postingTypeDisplay,
    charge_code: row.charge_code,
    charge_description: row.charge_description,
    charge_category: row.charge_category ?? undefined,
    quantity: toNumberOrFallback(row.quantity),
    unit_price: toNumberOrFallback(row.unit_price),
    subtotal: toNumberOrFallback(row.subtotal),
    tax_amount: toNumberOrFallback(row.tax_amount),
    service_charge: toNumberOrFallback(row.service_charge),
    discount_amount: toNumberOrFallback(row.discount_amount),
    total_amount: toNumberOrFallback(row.total_amount),
    currency: row.currency ?? "USD",
    payment_method: row.payment_method ?? undefined,
    source_system: row.source_system ?? undefined,
    outlet: row.outlet ?? undefined,
    is_voided: row.is_voided,
    voided_at: toIsoString(row.voided_at),
    void_reason: row.void_reason ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    version: row.version ? row.version.toString() : "0",
  });
};

/**
 * List charge postings with optional filters.
 */
export const listChargePostings = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  folioId?: string;
  transactionType?: string;
  chargeCode?: string;
  includeVoided?: boolean;
  offset?: number;
  reservationId?: string;
}): Promise<ChargePostingListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const folioId = options.folioId ?? null;
  const transactionType = options.transactionType
    ? options.transactionType.trim().toUpperCase()
    : null;
  const chargeCode = options.chargeCode ?? null;
  const includeVoided = options.includeVoided ?? null;
  const offset = options.offset ?? 0;
  const reservationId = options.reservationId ?? null;

  const { rows } = await query<ChargePostingRow>(CHARGE_POSTING_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    folioId,
    transactionType,
    chargeCode,
    includeVoided === true ? null : false,
    offset,
    reservationId,
  ]);

  return rows.map(mapRowToChargePosting);
};

/**
 * Run pre-audit checks for a property's current business date.
 * Returns a checklist with pass/fail per item that front-desk staff
 * should review before starting the night audit.
 */
export const getPreAuditChecklist = async (options: {
  tenantId: string;
  propertyId: string;
}): Promise<{ business_date: string; checks: PreAuditCheckItem[] }> => {
  const { tenantId, propertyId } = options;

  // 1. Get current business date
  const { rows: dateRows } = await query<{
    business_date: string;
    date_status: string;
    night_audit_status: string;
  }>(
    `SELECT business_date::text, date_status, night_audit_status
     FROM business_dates
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND date_status = 'OPEN' AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()
     ORDER BY business_date DESC LIMIT 1`,
    [tenantId, propertyId],
  );

  const businessDate = dateRows[0]?.business_date ?? new Date().toISOString().slice(0, 10);
  const checks: PreAuditCheckItem[] = [];

  // 2. Check no audit already in progress
  const auditStatus = dateRows[0]?.night_audit_status ?? "PENDING";
  checks.push({
    check: "No audit in progress",
    passed: auditStatus === "PENDING" || auditStatus === "FAILED",
    detail:
      auditStatus === "IN_PROGRESS"
        ? "Night audit is currently running"
        : auditStatus === "COMPLETED"
          ? "Night audit already completed for this date"
          : "Ready for audit",
  });

  // 3. Open cashier sessions — all should be closed
  const { rows: openSessions } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM cashier_sessions
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND session_status = 'open'
       AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()`,
    [tenantId, propertyId],
  );
  const openCount = Number(openSessions[0]?.cnt ?? 0);
  checks.push({
    check: "All cashier sessions closed",
    passed: openCount === 0,
    detail: openCount > 0 ? `${openCount} cashier session(s) still open` : "All sessions closed",
  });

  // 4. Pending arrivals — expected today that haven't checked in
  const { rows: pendingArrivals } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'CONFIRMED'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const arrivalCount = Number(pendingArrivals[0]?.cnt ?? 0);
  checks.push({
    check: "No pending arrivals",
    passed: arrivalCount === 0,
    detail:
      arrivalCount > 0
        ? `${arrivalCount} reservation(s) expected today not yet checked in`
        : "All expected arrivals processed",
  });

  // 5. Pending departures — expected today that haven't checked out
  const { rows: pendingDepartures } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_out_date = $3::date AND status = 'CHECKED_IN'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const departureCount = Number(pendingDepartures[0]?.cnt ?? 0);
  checks.push({
    check: "No pending departures",
    passed: departureCount === 0,
    detail:
      departureCount > 0
        ? `${departureCount} guest(s) due out today still checked in`
        : "All departures processed",
  });

  // 6. Unbalanced folios — open folios with unsettled charges
  const { rows: unbalancedFolios } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM folios
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND folio_status = 'OPEN' AND COALESCE(balance, 0) != 0
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const unbalancedCount = Number(unbalancedFolios[0]?.cnt ?? 0);
  checks.push({
    check: "No unbalanced open folios",
    passed: unbalancedCount === 0,
    detail:
      unbalancedCount > 0
        ? `${unbalancedCount} open folio(s) with non-zero balance`
        : "All open folios balanced",
  });

  // 7. Room status verified — no rooms in 'out_of_order' that have checked-in reservations
  const { rows: conflictRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT r.id)::text AS cnt
     FROM rooms r
     JOIN reservations res
       ON res.tenant_id = r.tenant_id
       AND res.room_number = r.room_number
       AND res.status = 'CHECKED_IN'
     WHERE r.tenant_id = $1::uuid AND r.property_id = $2::uuid
       AND r.is_out_of_order = true
       AND COALESCE(r.is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const conflictCount = Number(conflictRooms[0]?.cnt ?? 0);
  checks.push({
    check: "Room statuses consistent",
    passed: conflictCount === 0,
    detail:
      conflictCount > 0
        ? `${conflictCount} room(s) marked out-of-order but occupied`
        : "All room statuses consistent",
  });

  return { business_date: businessDate, checks };
};

// ============================================================================
// BUCKET CHECK (OCCUPANCY VERIFICATION)
// ============================================================================

/**
 * Bucket check: compare system occupancy counts against expected
 * room states for a given business date. Helps front desk verify
 * stayover, due-out, and arrival counts match physical reality.
 */
export const getBucketCheck = async (options: {
  tenantId: string;
  propertyId: string;
  businessDate?: string;
}): Promise<{ business_date: string; items: BucketCheckItem[]; is_balanced: boolean }> => {
  const { tenantId, propertyId } = options;

  // Resolve business date
  const bdParam = options.businessDate ?? null;
  const { rows: dateRows } = await query<{ business_date: string }>(
    bdParam
      ? `SELECT $1::date::text AS business_date`
      : `SELECT business_date::text
         FROM business_dates
         WHERE tenant_id = $1::uuid AND property_id = $2::uuid
           AND date_status = 'OPEN' AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()
         ORDER BY business_date DESC LIMIT 1`,
    bdParam ? [bdParam] : [tenantId, propertyId],
  );
  const businessDate = dateRows[0]?.business_date ?? new Date().toISOString().slice(0, 10);

  const items: BucketCheckItem[] = [];

  // 1. Total sellable rooms
  const { rows: totalRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND is_out_of_order = false AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const totalSellable = Number(totalRooms[0]?.cnt ?? 0);

  // 2. Rooms physically occupied (distinct rooms with CHECKED_IN reservations).
  // COUNT(DISTINCT room_number) guards against data anomalies where a room
  // could have multiple CHECKED_IN rows (e.g., room-move corrections), which
  // would otherwise inflate the occupancy count and break the bucket check.
  const { rows: occupiedRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT room_number)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'CHECKED_IN' AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const physicalOccupied = Number(occupiedRooms[0]?.cnt ?? 0);

  // 3. Reservation-based stayovers (checked in, not departing today)
  const { rows: stayovers } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'CHECKED_IN' AND check_out_date > $3::date
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const stayoverCount = Number(stayovers[0]?.cnt ?? 0);

  // 4. Due-outs (checked in, departing today)
  const { rows: dueOuts } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'CHECKED_IN' AND check_out_date = $3::date
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const dueOutCount = Number(dueOuts[0]?.cnt ?? 0);

  // 5. Expected arrivals (confirmed, arriving today)
  const { rows: arrivals } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'CONFIRMED'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const arrivalCount = Number(arrivals[0]?.cnt ?? 0);

  // 6. Already checked-in today
  const { rows: checkedInToday } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'CHECKED_IN'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const checkedInTodayCount = Number(checkedInToday[0]?.cnt ?? 0);

  // Expected occupied = stayovers + due-outs (still in-house)
  const expectedOccupied = stayoverCount + dueOutCount;
  const occupancyMatch = physicalOccupied === expectedOccupied;

  items.push(
    {
      category: "Total Sellable Rooms",
      expected: totalSellable,
      actual: totalSellable,
      matched: true,
      detail: `${totalSellable} rooms available (excludes out-of-order)`,
    },
    {
      category: "Occupied Rooms (Physical)",
      expected: expectedOccupied,
      actual: physicalOccupied,
      matched: occupancyMatch,
      detail: occupancyMatch
        ? "Physical occupancy matches reservation count"
        : `Mismatch: ${physicalOccupied} physical vs ${expectedOccupied} expected (${stayoverCount} stayovers + ${dueOutCount} due-outs)`,
    },
    {
      category: "Stayovers",
      expected: stayoverCount,
      actual: stayoverCount,
      matched: true,
      detail: `${stayoverCount} guest(s) staying through tonight`,
    },
    {
      category: "Due-Outs",
      expected: dueOutCount,
      actual: dueOutCount,
      matched: true,
      detail: `${dueOutCount} guest(s) due to depart today`,
    },
    {
      category: "Expected Arrivals",
      expected: arrivalCount,
      actual: checkedInTodayCount,
      matched: arrivalCount === checkedInTodayCount,
      detail:
        arrivalCount === checkedInTodayCount
          ? `All ${arrivalCount} expected arrival(s) checked in`
          : `${checkedInTodayCount} of ${arrivalCount} expected arrival(s) checked in`,
    },
  );

  const isBalanced = items.every((i) => i.matched);

  return { business_date: businessDate, items, is_balanced: isBalanced };
};

// ============================================================================
// CASHIER SESSIONS
// ============================================================================

export const listCashierSessions = async (options: {
  tenantId: string;
  propertyId?: string;
  sessionStatus?: string;
  limit?: number;
  offset?: number;
  userId?: string;
  shiftType?: string;
}) => {
  const { tenantId, limit = 100, offset = 0 } = options;
  const propertyId = options.propertyId ?? null;
  const sessionStatus = options.sessionStatus ?? null;
  const userId = options.userId ?? null;
  const shiftType = options.shiftType ?? null;

  const { rows } = await query(CASHIER_SESSION_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    sessionStatus,
    offset,
    userId,
    shiftType,
  ]);

  return rows;
};

export const getCashierSessionById = async (sessionId: string, tenantId: string) => {
  const { rows } = await query(CASHIER_SESSION_BY_ID_SQL, [sessionId, tenantId]);
  return rows[0] ?? null;
};
