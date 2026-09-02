/**
 * DEV DOC
 * Module: sql/folio-document-queries.ts
 * Purpose: Reads that assemble a printable folio.
 * Ownership: billing-service
 *
 * The document service never queries the database — it renders what it is
 * handed. These are the reads that produce that payload, kept apart from the
 * folio API queries because a printed folio needs things the API does not:
 * the property's postal address and tax registrations, the stay window derived
 * from `reservation_nights`, and a tax summary grouped by code.
 */

/**
 * Folio, property, guest and stay in one read.
 *
 * The stay is derived from `reservation_rooms` / `reservation_nights` rather
 * than `reservations.check_in_date`, because since WS-01 a booking can hold
 * several rooms with different windows and the folio must print the window that
 * was actually sold.
 */
export const FOLIO_DOCUMENT_HEADER_SQL = `
  WITH stay AS (
    SELECT
      rn.reservation_id,
      MIN(rn.stay_date)                                   AS arrival_date,
      MAX(rn.stay_date) + INTERVAL '1 day'                AS departure_date,
      COUNT(DISTINCT rn.stay_date)                        AS nights,
      MAX(rn.rate_code)                                   AS rate_plan_name
    FROM public.reservation_nights rn
    WHERE rn.tenant_id = $2::uuid
    GROUP BY rn.reservation_id
  ),
  rooms AS (
    SELECT
      rr.reservation_id,
      STRING_AGG(DISTINCT rr.room_number, ', ' ORDER BY rr.room_number) AS room_numbers,
      SUM(rr.adults)                                                    AS adults,
      SUM(COALESCE(rr.children, 0))                                     AS children,
      MAX(rt.type_name)                                                 AS room_type_name
    FROM public.reservation_rooms rr
    LEFT JOIN public.room_types rt ON rt.id = rr.room_type_id
    WHERE rr.tenant_id = $2::uuid
      AND COALESCE(rr.is_deleted, false) = false
    GROUP BY rr.reservation_id
  )
  SELECT
    f.folio_id,
    f.folio_number,
    f.folio_type,
    f.folio_status,
    COALESCE(f.currency_code, prop.currency)  AS currency_code,
    f.opened_at,
    f.closed_at,
    f.reference_number,
    f.total_charges,
    f.total_payments,
    f.total_credits,
    f.balance,
    f.guest_name                              AS folio_guest_name,
    f.company_name,
    f.tax_id                                  AS folio_tax_id,
    f.billing_address_line1,
    f.billing_address_line2,
    f.billing_city,
    f.billing_state,
    f.billing_postal_code,
    f.billing_country,
    prop.id                                   AS property_id,
    prop.property_name,
    prop.address                              AS property_address,
    prop.phone                                AS property_phone,
    prop.email                                AS property_email,
    prop.website                              AS property_website,
    prop.tax_id                               AS property_tax_id,
    prop.timezone                             AS property_timezone,
    g.first_name                              AS guest_first_name,
    g.last_name                               AS guest_last_name,
    g.email                                   AS guest_email,
    g.phone                                   AS guest_phone,
    f.reservation_id,
    r.confirmation_number,
    stay.arrival_date,
    stay.departure_date,
    stay.nights,
    rooms.adults,
    rooms.children,
    rooms.room_numbers,
    rooms.room_type_name,
    stay.rate_plan_name
  FROM public.folios f
  LEFT JOIN public.properties   prop  ON prop.id = f.property_id
  LEFT JOIN public.guests       g     ON g.id = f.guest_id
  LEFT JOIN public.reservations r     ON r.id = f.reservation_id
  LEFT JOIN stay                      ON stay.reservation_id = f.reservation_id
  LEFT JOIN rooms                     ON rooms.reservation_id = f.reservation_id
  WHERE f.folio_id = $1::uuid
    AND f.tenant_id = $2::uuid
    AND COALESCE(f.is_deleted, false) = false
    AND f.deleted_at IS NULL
`;

/**
 * Charge lines, oldest first.
 *
 * Voided postings are excluded: a folio is what the guest owes, and a voided
 * line is not part of that. The void trail lives in the charge-posting API.
 */
export const FOLIO_DOCUMENT_CHARGES_SQL = `
  SELECT
    c.posting_id,
    c.posting_date,
    c.charge_code,
    c.charge_description,
    c.quantity,
    c.unit_price,
    c.subtotal,
    c.tax_amount,
    c.total_amount,
    rr.room_number
  FROM public.charge_postings c
  LEFT JOIN public.reservation_rooms rr
    ON rr.reservation_room_id = c.reservation_room_id
  WHERE c.folio_id = $1::uuid
    AND c.tenant_id = $2::uuid
    AND COALESCE(c.is_voided, false) = false
    AND COALESCE(c.is_deleted, false) = false
    AND c.deleted_at IS NULL
  ORDER BY c.posting_date ASC, c.posting_time ASC
`;

/**
 * Payments applied to this folio.
 *
 * `payments` carries no `folio_id`, so the link runs through the GL entry the
 * capture writes in the same transaction — which does carry one. Joining on
 * `reservation_id` instead would over-report on a split folio, printing another
 * folio's payments on this one.
 */
export const FOLIO_DOCUMENT_PAYMENTS_SQL = `
  SELECT DISTINCT
    p.id                                          AS payment_id,
    COALESCE(p.processed_at, p.created_at)        AS payment_date,
    p.payment_method::text                        AS payment_method,
    p.payment_reference,
    p.amount
  FROM public.payments p
  JOIN public.general_ledger_entries gl
    ON gl.source_table = 'payments'
   AND gl.source_id = p.id
   AND gl.tenant_id = p.tenant_id
  WHERE gl.folio_id = $1::uuid
    AND p.tenant_id = $2::uuid
    AND p.status = 'COMPLETED'
    AND COALESCE(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
  ORDER BY payment_date ASC
`;

/**
 * Tax summary for the folio, one line per tax code.
 *
 * Grouped from the postings themselves rather than recomputed, so the summary
 * always adds up to what the lines above it say.
 */
export const FOLIO_DOCUMENT_TAXES_SQL = `
  SELECT
    COALESCE(c.tax_code, 'TAX')             AS tax_code,
    COALESCE(tc.tax_name, c.tax_code, 'Tax') AS tax_name,
    MAX(c.tax_rate)                          AS tax_rate,
    SUM(COALESCE(c.subtotal, 0))             AS taxable_amount,
    SUM(COALESCE(c.tax_amount, 0))           AS tax_amount
  FROM public.charge_postings c
  LEFT JOIN public.tax_configurations tc
    ON tc.tax_code = c.tax_code
   AND tc.tenant_id = c.tenant_id
   AND COALESCE(tc.is_active, true) = true
  WHERE c.folio_id = $1::uuid
    AND c.tenant_id = $2::uuid
    AND COALESCE(c.is_voided, false) = false
    AND COALESCE(c.is_deleted, false) = false
    AND c.deleted_at IS NULL
    AND COALESCE(c.tax_amount, 0) <> 0
  GROUP BY COALESCE(c.tax_code, 'TAX'), COALESCE(tc.tax_name, c.tax_code, 'Tax')
  ORDER BY tax_code
`;

/**
 * The property's own tax registrations, for the letterhead (PMS-15-17).
 *
 * `properties.tax_id` is the primary registration; `tax_configurations` may
 * carry further jurisdiction-specific numbers (a tourist levy registration is
 * the usual second one).
 */
export const PROPERTY_TAX_REGISTRATIONS_SQL = `
  SELECT DISTINCT
    tc.tax_name                    AS label,
    tc.tax_registration_number     AS value
  FROM public.tax_configurations tc
  WHERE tc.tenant_id = $2::uuid
    AND (tc.property_id = $1::uuid OR tc.property_id IS NULL)
    AND tc.tax_registration_number IS NOT NULL
    AND tc.tax_registration_number <> ''
    AND COALESCE(tc.is_active, true) = true
  ORDER BY label
`;
