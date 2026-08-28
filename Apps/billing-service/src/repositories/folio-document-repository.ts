/**
 * DEV DOC
 * Module: folio-document-repository.ts
 * Purpose: Assemble a complete `FolioDocument` payload for the renderer.
 * Ownership: billing-service (owner of the folios table)
 *
 * This is the whole of billing's side of WS-06: the renderer holds no database
 * handle, so everything a folio prints has to be gathered here and handed over
 * as one payload. That is deliberate — a folio PDF cannot then disagree with
 * the folio API about what a guest owes, because both read the same rows.
 *
 * Amounts are converted from `pg`'s NUMERIC-as-string exactly once, here. The
 * renderer formats; it does not do arithmetic.
 */

import type {
  FolioDocument,
  FolioDocumentChargeRow,
  FolioDocumentHeaderRow,
  FolioDocumentPaymentRow,
  FolioDocumentTaxRow,
  PropertyTaxRegistrationRow,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  FOLIO_DOCUMENT_CHARGES_SQL,
  FOLIO_DOCUMENT_HEADER_SQL,
  FOLIO_DOCUMENT_PAYMENTS_SQL,
  FOLIO_DOCUMENT_TAXES_SQL,
  PROPERTY_TAX_REGISTRATIONS_SQL,
} from "../sql/folio-document-queries.js";

/** NUMERIC arrives as a string; make it a number once, at the boundary. */
const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Same, but absent stays absent — an optional quantity must not print as 0. */
const toOptionalNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Dates go to the renderer as ISO strings; it decides how to print them. */
const toIso = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
};

/** A date-only column stays date-only, so no timezone can shift the night. */
const toIsoDate = (value: Date | string | null | undefined): string | undefined => {
  const iso = toIso(value);
  return iso?.slice(0, 10);
};

/** Drop keys whose value is undefined so optional schema fields stay absent. */
const compact = <T extends Record<string, unknown>>(input: T): T =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;

/**
 * Read a property address out of the `properties.address` JSONB blob.
 *
 * The column is free-form JSON, so the keys are matched leniently — a property
 * seeded with `street` and one seeded with `line1` both have to print.
 */
const readAddress = (
  address: Record<string, unknown> | null,
): FolioDocument["property"]["address"] => {
  if (!address || typeof address !== "object") return undefined;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = address[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return undefined;
  };

  const resolved = compact({
    line1: pick("line1", "address_line1", "street", "street1"),
    line2: pick("line2", "address_line2", "street2"),
    city: pick("city", "town"),
    state: pick("state", "province", "region"),
    postal_code: pick("postal_code", "postcode", "zip", "zip_code"),
    country: pick("country", "country_code"),
  });

  return Object.keys(resolved).length > 0 ? resolved : undefined;
};

/** Build the guest party from the folio's own name fields, then the profile. */
const readGuest = (header: FolioDocumentHeaderRow): FolioDocument["guest"] => {
  const profileName = [header.guest_first_name, header.guest_last_name]
    .filter((part) => part && part.trim() !== "")
    .join(" ")
    .trim();

  const billingAddress = compact({
    line1: header.billing_address_line1 ?? undefined,
    line2: header.billing_address_line2 ?? undefined,
    city: header.billing_city ?? undefined,
    state: header.billing_state ?? undefined,
    postal_code: header.billing_postal_code ?? undefined,
    country: header.billing_country ?? undefined,
  });

  return compact({
    name: header.folio_guest_name ?? (profileName || "Guest"),
    address: Object.keys(billingAddress).length > 0 ? billingAddress : undefined,
    email: header.guest_email ?? undefined,
    phone: header.guest_phone ?? undefined,
    tax_id: header.folio_tax_id ?? undefined,
  }) as FolioDocument["guest"];
};

/**
 * Assemble the payload for one folio.
 *
 * Returns `null` when the folio does not exist for this tenant — the caller
 * turns that into a 404 rather than rendering an empty document.
 */
export const buildFolioDocument = async (
  folioId: string,
  tenantId: string,
): Promise<FolioDocument | null> => {
  const headerResult = await query<FolioDocumentHeaderRow>(FOLIO_DOCUMENT_HEADER_SQL, [
    folioId,
    tenantId,
  ]);
  const header = headerResult.rows[0];
  if (!header) return null;

  const [charges, payments, taxes, registrations] = await Promise.all([
    query<FolioDocumentChargeRow>(FOLIO_DOCUMENT_CHARGES_SQL, [folioId, tenantId]),
    query<FolioDocumentPaymentRow>(FOLIO_DOCUMENT_PAYMENTS_SQL, [folioId, tenantId]),
    query<FolioDocumentTaxRow>(FOLIO_DOCUMENT_TAXES_SQL, [folioId, tenantId]),
    query<PropertyTaxRegistrationRow>(PROPERTY_TAX_REGISTRATIONS_SQL, [
      header.property_id,
      tenantId,
    ]),
  ]);

  // The property's own tax number leads; jurisdiction-specific registrations
  // follow. Deduplicated, because a property-scoped and a tenant-scoped row can
  // carry the same number.
  const taxRegistrations = [
    ...(header.property_tax_id ? [{ label: "Tax ID", value: header.property_tax_id }] : []),
    ...registrations.rows.map((row) => ({ label: row.label, value: row.value })),
  ].filter((entry, index, all) => all.findIndex((other) => other.value === entry.value) === index);

  const stay = compact({
    reservation_id: header.reservation_id ?? undefined,
    confirmation_number: header.confirmation_number ?? undefined,
    room_number: header.room_numbers ?? undefined,
    room_type: header.room_type_name ?? undefined,
    arrival_date: toIsoDate(header.arrival_date),
    departure_date: toIsoDate(header.departure_date),
    nights: toOptionalNumber(header.nights),
    adults: toOptionalNumber(header.adults),
    children: toOptionalNumber(header.children),
    rate_plan: header.rate_plan_name ?? undefined,
  });

  return {
    kind: "FOLIO",
    property: compact({
      property_id: header.property_id,
      name: header.property_name,
      address: readAddress(header.property_address),
      phone: header.property_phone ?? undefined,
      email: header.property_email ?? undefined,
      website: header.property_website ?? undefined,
      tax_registrations: taxRegistrations,
    }) as FolioDocument["property"],
    guest: readGuest(header),
    ...(header.company_name ? { company: { name: header.company_name } } : {}),
    folio: compact({
      folio_id: header.folio_id,
      folio_number: header.folio_number,
      folio_type: header.folio_type,
      folio_status: header.folio_status,
      currency_code: header.currency_code ?? "USD",
      opened_at: toIso(header.opened_at) ?? new Date().toISOString(),
      closed_at: toIso(header.closed_at),
      reference_number: header.reference_number ?? undefined,
    }) as FolioDocument["folio"],
    ...(Object.keys(stay).length > 0 ? { stay } : {}),
    charges: charges.rows.map((row) =>
      compact({
        posting_id: row.posting_id,
        posting_date: toIsoDate(row.posting_date) ?? "",
        charge_code: row.charge_code,
        description: row.charge_description,
        quantity: toOptionalNumber(row.quantity),
        unit_price: toOptionalNumber(row.unit_price),
        subtotal: toOptionalNumber(row.subtotal),
        tax_amount: toOptionalNumber(row.tax_amount),
        total_amount: toNumber(row.total_amount),
        room_number: row.room_number ?? undefined,
      }),
    ) as FolioDocument["charges"],
    payments: payments.rows.map((row) =>
      compact({
        payment_id: row.payment_id,
        payment_date: toIsoDate(row.payment_date) ?? "",
        method: row.payment_method,
        reference: row.payment_reference ?? undefined,
        amount: toNumber(row.amount),
      }),
    ) as FolioDocument["payments"],
    taxes: taxes.rows.map((row) =>
      compact({
        code: row.tax_code,
        label: row.tax_name,
        rate: toOptionalNumber(row.tax_rate),
        taxable_amount: toOptionalNumber(row.taxable_amount),
        amount: toNumber(row.tax_amount),
      }),
    ) as FolioDocument["taxes"],
    totals: {
      total_charges: toNumber(header.total_charges),
      total_payments: toNumber(header.total_payments),
      total_credits: toNumber(header.total_credits),
      balance: toNumber(header.balance),
    },
    generated_at: new Date().toISOString(),
  };
};
