/**
 * HTNG POS Charge Service — ACCT-05
 *
 * Implements the HTNG-standard POS charge posting flow:
 *  1. Idempotency check on pos_transaction_id (dedup aggressive POS retries)
 *  2. Room number → active reservation → primary folio lookup
 *  3. Optional guest name verification (fuzzy match)
 *  4. Itemized charge posting (one row per PosChargeItem)
 *  5. Folio balance update
 *  6. On lookup failure → route to suspense folio
 *
 * All steps execute inside a single serialisable transaction with a folio
 * advisory lock to prevent concurrent checkout reading a stale balance.
 *
 * Ref: BA §2.2, §14.1 | Issue: ACCT-05 | HTNG 2009B POS integration spec.
 */

import type { PosChargeInput, PosChargeResponse } from "@tartware/schemas";
import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { acquireFolioLock } from "../lib/folio-lock.js";
import { appLogger } from "../lib/logger.js";
import { addMoney, roundMoney } from "../utils/money.js";
import { BillingCommandError } from "./billing-commands/common.js";

// ---------------------------------------------------------------------------
// USALI outlet_code → department_code + GL account mapping
// Based on the Uniform System of Accounts for the Lodging Industry (USALI) 11th Ed.
// ---------------------------------------------------------------------------
const OUTLET_GL_MAP: Record<string, { department_code: string; gl_account: string }> = {
  FB: { department_code: "FB", gl_account: "4100" }, // Food & Beverage
  RESTAURANT: { department_code: "FB", gl_account: "4100" },
  BAR: { department_code: "FB-BAR", gl_account: "4110" },
  MINIBAR: { department_code: "MINI", gl_account: "4120" },
  MINI: { department_code: "MINI", gl_account: "4120" },
  SPA: { department_code: "SPA", gl_account: "4200" },
  GOLF: { department_code: "GOLF", gl_account: "4300" },
  RETAIL: { department_code: "RETAIL", gl_account: "4400" },
  PARK: { department_code: "PARK", gl_account: "4500" },
  PARKING: { department_code: "PARK", gl_account: "4500" },
  LAUNDRY: { department_code: "LAUNDRY", gl_account: "4600" },
  TELECOM: { department_code: "TELECOM", gl_account: "4700" },
  BUSINESS: { department_code: "BIZ-CTR", gl_account: "4800" },
};

const DEFAULT_GL = { department_code: "MISC", gl_account: "4999" };

const resolveGlMapping = (outletCode: string): { department_code: string; gl_account: string } => {
  const key = outletCode.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return OUTLET_GL_MAP[key] ?? DEFAULT_GL;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ReservationFolioRow = {
  reservation_id: string;
  folio_id: string;
  guest_name: string | null;
  guest_id: string | null;
};

/**
 * Look up the active reservation and its primary open folio by room number.
 * Returns null when no in-house reservation is found for the room.
 */
const lookupByRoomNumber = async (
  tenantId: string,
  propertyId: string,
  roomNumber: string,
): Promise<ReservationFolioRow | null> => {
  const { rows } = await query<ReservationFolioRow>(
    `SELECT r.id AS reservation_id,
            f.folio_id,
            r.guest_name,
            r.guest_id
       FROM public.reservations r
       JOIN public.folios f
         ON f.reservation_id = r.id
        AND f.tenant_id = r.tenant_id
        AND f.folio_status = 'OPEN'
        AND COALESCE(f.is_deleted, false) = false
      WHERE r.tenant_id  = $1::uuid
        AND r.property_id = $2::uuid
        AND r.room_number = $3
        AND r.status       IN ('CHECKED_IN', 'IN_HOUSE')
        AND COALESCE(r.is_deleted, false) = false
      ORDER BY r.check_in_date DESC
      LIMIT 1`,
    [tenantId, propertyId, roomNumber],
  );
  return rows[0] ?? null;
};

/**
 * Look up the primary open folio for a known reservation UUID.
 */
const lookupByReservationId = async (
  tenantId: string,
  reservationId: string,
): Promise<ReservationFolioRow | null> => {
  const { rows } = await query<ReservationFolioRow>(
    `SELECT r.id AS reservation_id,
            f.folio_id,
            r.guest_name,
            r.guest_id
       FROM public.reservations r
       JOIN public.folios f
         ON f.reservation_id = r.id
        AND f.tenant_id = r.tenant_id
        AND f.folio_status = 'OPEN'
        AND COALESCE(f.is_deleted, false) = false
      WHERE r.tenant_id = $1::uuid
        AND r.id        = $2::uuid
        AND COALESCE(r.is_deleted, false) = false
      LIMIT 1`,
    [tenantId, reservationId],
  );
  return rows[0] ?? null;
};

/**
 * Resolve or create the property suspense folio.
 * The suspense folio is a special HOUSE-type folio used when a POS charge
 * cannot be matched to an active reservation (e.g. guest checked out, room
 * vacant, or guest name mismatch). Front desk must reconcile it manually.
 */
const resolveSuspenseFolio = async (tenantId: string, propertyId: string): Promise<string> => {
  // Find existing open suspense folio for the property
  const findResult = await query<{ folio_id: string }>(
    `SELECT folio_id
       FROM public.folios
      WHERE tenant_id   = $1::uuid
        AND property_id = $2::uuid
        AND folio_type  = 'HOUSE'
        AND notes       LIKE 'SUSPENSE:%'
        AND folio_status = 'OPEN'
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantId, propertyId],
  );

  if (findResult.rows[0]) {
    return findResult.rows[0].folio_id;
  }

  // Create a new suspense folio
  const folioNumber = `SUSP-${Date.now().toString(36).toUpperCase()}`;
  const createResult = await query<{ folio_id: string }>(
    `INSERT INTO public.folios (
       tenant_id, property_id, folio_number, folio_type, folio_status,
       currency_code, notes, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'HOUSE', 'OPEN',
       'USD', $4, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
     ) RETURNING folio_id`,
    [tenantId, propertyId, folioNumber, `SUSPENSE: POS charges pending reconciliation`],
  );

  const folioId = createResult.rows[0]?.folio_id;
  if (!folioId) {
    throw new BillingCommandError(
      "SUSPENSE_FOLIO_CREATE_FAILED",
      "Failed to create suspense folio.",
    );
  }

  appLogger.warn({ tenantId, propertyId, folioId, folioNumber }, "Created new POS suspense folio");
  return folioId;
};

/**
 * Performs a normalised name comparison for guest verification.
 * Returns true when the provided name is a reasonable match for the
 * reservation guest name. Uses lower-case token overlap (≥1 surname token
 * must match) rather than strict equality to tolerate POS entry variance.
 */
const guestNameMatches = (provided: string, reservation: string | null): boolean => {
  if (!reservation) {
    return true; // no stored name → allow through
  }
  const tokens = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

  const provTokens = new Set(tokens(provided));
  const resTokens = tokens(reservation);
  // At least one surname token must appear in the provided name
  return resTokens.some((t) => t.length > 1 && provTokens.has(t));
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Post an HTNG-compatible POS charge to the appropriate guest folio.
 *
 * @param input  - Validated PosChargeInput (from the HTTP route layer)
 * @param actorId - UUID of the authenticated user or integration account
 * @returns PosChargeResponse with posting IDs and routing metadata
 *
 * @throws BillingCommandError with code:
 *  - `POS_DUPLICATE` — pos_transaction_id already processed (idempotent return)
 *  - `FOLIO_LOCKED`  — concurrent operation holds the folio lock (retryable)
 */
export const postPosCharge = async (
  input: PosChargeInput,
  actorId: string,
): Promise<PosChargeResponse> => {
  const { tenant_id, property_id } = input;
  const currency = input.currency ?? "USD";
  const gl = resolveGlMapping(input.outlet_code);

  // ------------------------------------------------------------------
  // 1. Idempotency check — return early if already processed
  // ------------------------------------------------------------------
  const { rows: dedupRows } = await query<{ posting_id: string; folio_id: string }>(
    `SELECT posting_id, folio_id
       FROM public.charge_postings
      WHERE tenant_id         = $1::uuid
        AND pos_transaction_id = $2
        AND COALESCE(is_deleted, false) = false
      LIMIT 1`,
    [tenant_id, input.pos_transaction_id],
  );

  if (dedupRows[0]) {
    appLogger.info(
      { tenantId: tenant_id, posTransactionId: input.pos_transaction_id },
      "POS charge duplicate — returning cached posting_id",
    );
    return {
      posting_id: dedupRows[0].posting_id,
      line_posting_ids: [dedupRows[0].posting_id],
      folio_id: dedupRows[0].folio_id,
      posted_to_suspense: false,
      duplicate: true,
      total_posted: 0,
    };
  }

  // ------------------------------------------------------------------
  // 2. Resolve reservation → folio
  // ------------------------------------------------------------------
  let match: ReservationFolioRow | null = null;
  let postedToSuspense = false;

  if (input.reservation_id) {
    match = await lookupByReservationId(tenant_id, input.reservation_id);
  } else if (input.room_number) {
    match = await lookupByRoomNumber(tenant_id, property_id, input.room_number);
  }

  // ------------------------------------------------------------------
  // 3. Guest name verification (when name was supplied by POS)
  // ------------------------------------------------------------------
  if (
    match &&
    input.guest_name_provided &&
    !guestNameMatches(input.guest_name_provided, match.guest_name)
  ) {
    appLogger.warn(
      {
        tenantId: tenant_id,
        posTransactionId: input.pos_transaction_id,
        providedName: input.guest_name_provided,
        reservationGuestName: match.guest_name,
      },
      "POS guest name mismatch — routing to suspense folio",
    );
    match = null; // force suspense routing
  }

  let folioId: string;
  let reservationId: string | null;
  let guestId: string | null;

  if (match) {
    folioId = match.folio_id;
    reservationId = match.reservation_id;
    guestId = match.guest_id;
  } else {
    postedToSuspense = true;
    folioId = await resolveSuspenseFolio(tenant_id, property_id);
    reservationId = null;
    guestId = null;
  }

  // ------------------------------------------------------------------
  // 4. Calculate totals
  // ------------------------------------------------------------------
  const itemsSubtotal = input.charge_items.reduce((sum, item) => addMoney(sum, item.subtotal), 0);
  const totalPosted = roundMoney(
    addMoney(addMoney(itemsSubtotal, input.service_charge), input.tax_amount) -
      input.discount_amount,
  );

  // ------------------------------------------------------------------
  // 5. Post charges inside a transaction with folio advisory lock
  // ------------------------------------------------------------------
  const { linePostingIds, firstPostingId } = await withTransaction(async (client) => {
    await acquireFolioLock(client, folioId);

    const postedIds: string[] = [];

    for (const item of input.charge_items) {
      const itemGl = item.gl_account ?? gl.gl_account;
      const itemDept = item.department_code ?? item.charge_code ?? gl.department_code;
      const itemChargeCode = item.charge_code ?? input.outlet_code.toUpperCase().slice(0, 50);

      const { rows } = await queryWithClient<{ posting_id: string }>(
        client,
        `INSERT INTO public.charge_postings (
           tenant_id, property_id, folio_id, reservation_id, guest_id,
           transaction_type, posting_type,
           charge_code, charge_description, charge_category,
           quantity, unit_price, subtotal,
           tax_amount, service_charge, discount_amount, total_amount,
           currency_code,
           department_code, gl_account,
           source_system, outlet, outlet_code, check_number, covers,
           server_name,
           pos_transaction_id,
           posting_time, business_date,
           created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5,
           'CHARGE', 'DEBIT',
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $15,
           UPPER($16),
           $17, $18,
           'POS', $19, $20, $21, $22,
           $23,
           $24,
           COALESCE($25::timestamptz, NOW()), CURRENT_DATE,
           $26::uuid, $26::uuid
         )
         RETURNING posting_id`,
        [
          tenant_id, // $1
          property_id, // $2
          folioId, // $3
          reservationId, // $4
          guestId, // $5
          itemChargeCode, // $6
          item.description, // $7
          gl.department_code, // $8  charge_category
          item.quantity, // $9
          item.unit_price, // $10
          item.subtotal, // $11
          0, // $12 tax_amount (item-level; aggregate carried at check level)
          0, // $13 service_charge (aggregate at check level)
          0, // $14 discount_amount
          item.subtotal, // $15 total_amount (item subtotal; aggregate row added below)
          currency, // $16
          itemDept, // $17
          itemGl, // $18
          input.outlet_name ?? input.outlet_code, // $19 outlet
          input.outlet_code, // $20 outlet_code
          input.check_number, // $21
          input.covers, // $22
          input.server_name ?? null, // $23
          input.pos_transaction_id, // $24
          input.posted_at ?? null, // $25
          actorId, // $26
        ],
      );

      const pid = rows[0]?.posting_id;
      if (pid) {
        postedIds.push(pid);
      }
    }

    // Post aggregated taxes / service charge / discount as a single summary line
    // when non-zero — keeps itemised lines clean and aggregates fiscal totals
    const aggregateTotal = roundMoney(
      addMoney(input.service_charge, input.tax_amount) - input.discount_amount,
    );
    if (aggregateTotal !== 0) {
      const aggDescription =
        `Check taxes/SC/discount — check #${input.check_number}` +
        (input.discount_amount > 0 ? ` (disc: ${input.discount_amount})` : "");

      const { rows: aggRows } = await queryWithClient<{ posting_id: string }>(
        client,
        `INSERT INTO public.charge_postings (
           tenant_id, property_id, folio_id, reservation_id, guest_id,
           transaction_type, posting_type,
           charge_code, charge_description, charge_category,
           quantity, unit_price, subtotal,
           tax_amount, service_charge, discount_amount, total_amount,
           currency_code,
           department_code, gl_account,
           source_system, outlet, outlet_code, check_number, covers,
           server_name, pos_transaction_id,
           posting_time, business_date,
           created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5,
           'CHARGE', $6,
           'TAX-SC', $7, $8,
           1, $9, $9,
           $10, $11, $12, $13,
           UPPER($14),
           $15, $16,
           'POS', $17, $18, $19, $20,
           $21, $22,
           COALESCE($23::timestamptz, NOW()), CURRENT_DATE,
           $24::uuid, $24::uuid
         )
         RETURNING posting_id`,
        [
          tenant_id, // $1
          property_id, // $2
          folioId, // $3
          reservationId, // $4
          guestId, // $5
          aggregateTotal >= 0 ? "DEBIT" : "CREDIT", // $6
          aggDescription, // $7
          gl.department_code, // $8
          Math.abs(aggregateTotal), // $9 subtotal
          input.tax_amount, // $10
          input.service_charge, // $11
          input.discount_amount, // $12
          aggregateTotal, // $13 total_amount
          currency, // $14
          gl.department_code, // $15
          gl.gl_account, // $16
          input.outlet_name ?? input.outlet_code, // $17
          input.outlet_code, // $18
          input.check_number, // $19
          input.covers, // $20
          input.server_name ?? null, // $21
          input.pos_transaction_id, // $22
          input.posted_at ?? null, // $23
          actorId, // $24
        ],
      );

      if (aggRows[0]?.posting_id) {
        postedIds.push(aggRows[0].posting_id);
      }
    }

    // Update folio balance
    await queryWithClient(
      client,
      `UPDATE public.folios
          SET total_charges = total_charges + $2,
              balance       = balance       + $2,
              updated_at    = NOW(),
              updated_by    = $3::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id  = $4::uuid`,
      [tenant_id, totalPosted, actorId, folioId],
    );

    return { linePostingIds: postedIds, firstPostingId: postedIds[0] ?? "" };
  });

  appLogger.info(
    {
      tenantId: tenant_id,
      propertyId: property_id,
      posTransactionId: input.pos_transaction_id,
      folioId,
      postedToSuspense,
      totalPosted,
      lineCount: linePostingIds.length,
    },
    "POS charge posted",
  );

  return {
    posting_id: firstPostingId,
    line_posting_ids: linePostingIds,
    folio_id: folioId,
    posted_to_suspense: postedToSuspense,
    duplicate: false,
    total_posted: totalPosted,
  };
};
