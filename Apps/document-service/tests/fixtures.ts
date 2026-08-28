import type { FolioDocument } from "@tartware/schemas";

/** A closed folio with two rooms, tax lines and a settled balance. */
export const folioFixture = (
  overrides: Partial<FolioDocument> = {},
): FolioDocument => ({
  kind: "FOLIO",
  property: {
    property_id: "11111111-1111-4111-8111-111111111111",
    name: "The Tartware Grand",
    legal_name: "Tartware Hospitality Ltd",
    address: {
      line1: "12 Harbour Street",
      city: "Edinburgh",
      postal_code: "EH1 1AA",
      country: "United Kingdom",
    },
    phone: "+44 131 555 0100",
    email: "reception@tartware.example",
    tax_registrations: [
      { label: "VAT Reg. No.", value: "GB123456789" },
      { label: "Tourist Levy No.", value: "EDI-99881" },
    ],
  },
  guest: {
    name: "Ada Lovelace",
    address: { line1: "5 Analytical Way", city: "London", country: "United Kingdom" },
    email: "ada@example.com",
  },
  folio: {
    folio_id: "22222222-2222-4222-8222-222222222222",
    folio_number: "F-2026-000412",
    folio_type: "GUEST",
    folio_status: "CLOSED",
    currency_code: "GBP",
    opened_at: "2026-09-10T14:02:00Z",
    closed_at: "2026-09-13T10:31:00Z",
  },
  stay: {
    confirmation_number: "TW-884120",
    room_number: "412",
    room_type: "Deluxe Double",
    arrival_date: "2026-09-10",
    departure_date: "2026-09-13",
    nights: 3,
    adults: 2,
  },
  charges: [
    {
      posting_id: "33333333-3333-4333-8333-333333333331",
      posting_date: "2026-09-10",
      charge_code: "ROOM",
      description: "Room charge — Deluxe Double",
      quantity: 1,
      total_amount: 210,
      room_number: "412",
    },
    {
      posting_id: "33333333-3333-4333-8333-333333333332",
      posting_date: "2026-09-11",
      charge_code: "ROOM",
      description: "Room charge — Deluxe Double",
      quantity: 1,
      total_amount: 240,
      room_number: "412",
    },
    {
      posting_id: "33333333-3333-4333-8333-333333333333",
      posting_date: "2026-09-11",
      charge_code: "FNB",
      description: "Restaurant — dinner",
      quantity: 2,
      total_amount: 86.4,
      room_number: "412",
    },
  ],
  payments: [
    {
      payment_id: "44444444-4444-4444-8444-444444444441",
      payment_date: "2026-09-13",
      method: "VISA ****4242",
      reference: "ch_3PabcDEF",
      amount: 536.4,
    },
  ],
  taxes: [
    { code: "VAT20", label: "VAT", rate: 20, taxable_amount: 447, amount: 89.4 },
  ],
  totals: {
    total_charges: 536.4,
    total_payments: 536.4,
    total_credits: 0,
    balance: 0,
  },
  generated_at: "2026-09-13T10:32:11Z",
  ...overrides,
});
