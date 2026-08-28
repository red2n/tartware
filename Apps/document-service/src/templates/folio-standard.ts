/**
 * DEV DOC
 * Module: templates/folio-standard.ts
 * Purpose: The standard guest folio, as data.
 * Ownership: document-service
 *
 * There is no rendering logic here and there is not meant to be. Every label is
 * an i18n key, every value is a path into the `FolioDocument` payload, and the
 * layout is a list of sections. A property that wants a different folio style
 * (PMS-11-02) writes another one of these; it does not write code.
 *
 * The template is parsed through `DocumentTemplateSchema` at module load, so a
 * malformed template fails at boot rather than on a guest's check-out.
 */
import { type DocumentTemplate, DocumentTemplateSchema } from "@tartware/schemas";

/** Right-aligned money column bound to the folio's own currency. */
const money = (path: string) => ({
  from: "PATH" as const,
  path,
  format: "MONEY" as const,
  currency_path: "$.folio.currency_code",
});

export const FOLIO_STANDARD: DocumentTemplate = DocumentTemplateSchema.parse({
  id: "FOLIO_STANDARD",
  kind: "FOLIO",
  name: "Standard guest folio",
  title: { from: "STRING", key: "doc.folio.title" },

  // ---- Letterhead -------------------------------------------------------
  header: [
    { kind: "HEADING", level: 1, text: { from: "PATH", path: "property.name" } },
    {
      kind: "TEXT",
      style: "MUTED",
      text: { from: "PATH", path: "property.legal_name" },
    },
    {
      kind: "TEXT",
      style: "MUTED",
      text: {
        from: "JOIN",
        parts: [
          { from: "PATH", path: "property.address.line1" },
          { from: "PATH", path: "property.address.line2" },
          { from: "PATH", path: "property.address.city" },
          { from: "PATH", path: "property.address.state" },
          { from: "PATH", path: "property.address.postal_code" },
          { from: "PATH", path: "property.address.country" },
        ],
      },
    },
    {
      kind: "TEXT",
      style: "MUTED",
      text: {
        from: "JOIN",
        separator: "  ·  ",
        parts: [
          { from: "PATH", path: "property.phone" },
          { from: "PATH", path: "property.email" },
          { from: "PATH", path: "property.website" },
        ],
      },
    },
    // Tax registration numbers. Most EU jurisdictions require the issuer's
    // registration on any document that functions as an invoice (PMS-15-17).
    // Blank headers so this reads as a continuation of the letterhead.
    {
      kind: "TABLE",
      rows_path: "property.tax_registrations",
      columns: [
        {
          header: { from: "LITERAL", value: "" },
          cell: { from: "PATH", path: "label" },
          weight: 1,
        },
        {
          header: { from: "LITERAL", value: "" },
          cell: { from: "PATH", path: "value" },
          weight: 2,
        },
      ],
    },
    { kind: "DIVIDER" },
  ],

  // ---- Body -------------------------------------------------------------
  sections: [
    { kind: "HEADING", level: 2, text: { from: "STRING", key: "doc.folio.title" } },
    {
      kind: "KEY_VALUES",
      columns: 2,
      rows: [
        {
          label: { from: "STRING", key: "folio.number" },
          value: { from: "PATH", path: "folio.folio_number" },
        },
        {
          label: { from: "STRING", key: "folio.status" },
          value: { from: "PATH", path: "folio.folio_status" },
        },
        {
          label: { from: "STRING", key: "folio.type" },
          value: { from: "PATH", path: "folio.folio_type" },
        },
        {
          label: { from: "STRING", key: "folio.opened" },
          value: { from: "PATH", path: "folio.opened_at", format: "DATE" },
        },
        {
          label: { from: "STRING", key: "folio.closed" },
          value: { from: "PATH", path: "folio.closed_at", format: "DATE" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "folio.reference" },
          value: { from: "PATH", path: "folio.reference_number" },
          omit_when_empty: true,
        },
      ],
    },
    { kind: "SPACER", size: "SMALL" },

    {
      kind: "KEY_VALUES",
      title: { from: "STRING", key: "guest.section" },
      columns: 2,
      rows: [
        {
          label: { from: "STRING", key: "guest.name" },
          value: { from: "PATH", path: "guest.name" },
        },
        {
          label: { from: "STRING", key: "guest.address" },
          value: {
            from: "JOIN",
            parts: [
              { from: "PATH", path: "guest.address.line1" },
              { from: "PATH", path: "guest.address.line2" },
              { from: "PATH", path: "guest.address.city" },
              { from: "PATH", path: "guest.address.postal_code" },
              { from: "PATH", path: "guest.address.country" },
            ],
          },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "guest.email" },
          value: { from: "PATH", path: "guest.email" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "guest.phone" },
          value: { from: "PATH", path: "guest.phone" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "guest.tax_id" },
          value: { from: "PATH", path: "guest.tax_id" },
          omit_when_empty: true,
        },
      ],
    },

    // Company block disappears entirely on a folio with no company — every row
    // omits when empty, and a KEY_VALUES with no surviving rows is dropped.
    {
      kind: "KEY_VALUES",
      title: { from: "STRING", key: "company.section" },
      columns: 2,
      rows: [
        {
          label: { from: "STRING", key: "guest.name" },
          value: { from: "PATH", path: "company.name" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "guest.address" },
          value: {
            from: "JOIN",
            parts: [
              { from: "PATH", path: "company.address.line1" },
              { from: "PATH", path: "company.address.city" },
              { from: "PATH", path: "company.address.postal_code" },
              { from: "PATH", path: "company.address.country" },
            ],
          },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "guest.tax_id" },
          value: { from: "PATH", path: "company.tax_id" },
          omit_when_empty: true,
        },
      ],
    },

    {
      kind: "KEY_VALUES",
      title: { from: "STRING", key: "stay.section" },
      columns: 2,
      rows: [
        {
          label: { from: "STRING", key: "stay.confirmation" },
          value: { from: "PATH", path: "stay.confirmation_number" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.room" },
          value: { from: "PATH", path: "stay.room_number" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.room_type" },
          value: { from: "PATH", path: "stay.room_type" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.rate_plan" },
          value: { from: "PATH", path: "stay.rate_plan" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.arrival" },
          value: { from: "PATH", path: "stay.arrival_date", format: "DATE" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.departure" },
          value: { from: "PATH", path: "stay.departure_date", format: "DATE" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.nights" },
          value: { from: "PATH", path: "stay.nights", format: "NUMBER" },
          omit_when_empty: true,
        },
        // Two rows rather than one joined "2 adults 1 children": JOIN drops an
        // empty part but keeps the literal beside it, so a stay with no
        // children would have printed "2 adults children".
        {
          label: { from: "STRING", key: "stay.adults" },
          value: { from: "PATH", path: "stay.adults", format: "NUMBER" },
          omit_when_empty: true,
        },
        {
          label: { from: "STRING", key: "stay.children" },
          value: { from: "PATH", path: "stay.children", format: "NUMBER" },
          omit_when_empty: true,
        },
      ],
    },
    { kind: "SPACER", size: "MEDIUM" },

    // ---- Charges --------------------------------------------------------
    {
      kind: "TABLE",
      title: { from: "STRING", key: "charges.section" },
      rows_path: "charges",
      empty_text: { from: "STRING", key: "charges.empty" },
      columns: [
        {
          header: { from: "STRING", key: "charges.date" },
          cell: { from: "PATH", path: "posting_date", format: "DATE" },
          weight: 2,
        },
        {
          header: { from: "STRING", key: "charges.description" },
          cell: { from: "PATH", path: "description" },
          weight: 5,
        },
        {
          header: { from: "STRING", key: "charges.room" },
          cell: { from: "PATH", path: "room_number" },
          align: "CENTER",
          weight: 1,
        },
        {
          header: { from: "STRING", key: "charges.quantity" },
          cell: { from: "PATH", path: "quantity", format: "NUMBER" },
          align: "RIGHT",
          weight: 1,
        },
        {
          header: { from: "STRING", key: "charges.amount" },
          cell: money("total_amount"),
          align: "RIGHT",
          weight: 2,
        },
      ],
    },

    // ---- Payments -------------------------------------------------------
    {
      kind: "TABLE",
      title: { from: "STRING", key: "payments.section" },
      rows_path: "payments",
      empty_text: { from: "STRING", key: "payments.empty" },
      columns: [
        {
          header: { from: "STRING", key: "payments.date" },
          cell: { from: "PATH", path: "payment_date", format: "DATE" },
          weight: 2,
        },
        {
          header: { from: "STRING", key: "payments.method" },
          cell: { from: "PATH", path: "method" },
          weight: 3,
        },
        {
          header: { from: "STRING", key: "payments.reference" },
          cell: { from: "PATH", path: "reference" },
          weight: 3,
        },
        {
          header: { from: "STRING", key: "payments.amount" },
          cell: money("amount"),
          align: "RIGHT",
          weight: 2,
        },
      ],
    },

    // ---- Tax summary ----------------------------------------------------
    // No empty_text: a folio with no tax lines drops this section entirely.
    {
      kind: "TABLE",
      title: { from: "STRING", key: "taxes.section" },
      rows_path: "taxes",
      columns: [
        {
          header: { from: "STRING", key: "taxes.code" },
          cell: { from: "PATH", path: "code" },
          weight: 2,
        },
        {
          header: { from: "STRING", key: "taxes.label" },
          cell: { from: "PATH", path: "label" },
          weight: 5,
        },
        {
          header: { from: "STRING", key: "taxes.rate" },
          cell: { from: "PATH", path: "rate", format: "NUMBER" },
          align: "RIGHT",
          weight: 1,
        },
        {
          header: { from: "STRING", key: "taxes.amount" },
          cell: money("amount"),
          align: "RIGHT",
          weight: 2,
        },
      ],
    },

    { kind: "SPACER", size: "SMALL" },
    {
      kind: "TOTALS",
      rows: [
        {
          label: { from: "STRING", key: "totals.charges" },
          value: money("totals.total_charges"),
        },
        {
          label: { from: "STRING", key: "totals.payments" },
          value: money("totals.total_payments"),
        },
        {
          label: { from: "STRING", key: "totals.credits" },
          value: money("totals.total_credits"),
        },
        {
          label: { from: "STRING", key: "totals.balance" },
          value: money("totals.balance"),
          emphasis: true,
        },
      ],
    },
  ],

  // ---- Footer -----------------------------------------------------------
  footer: [
    { kind: "DIVIDER" },
    { kind: "TEXT", style: "MUTED", text: { from: "STRING", key: "footer.thanks" } },
    {
      kind: "TEXT",
      style: "MUTED",
      text: {
        from: "JOIN",
        separator: " ",
        parts: [
          { from: "STRING", key: "footer.generated" },
          { from: "PATH", path: "generated_at", format: "DATETIME" },
        ],
      },
    },
    { kind: "SIGNATURE", label: { from: "STRING", key: "footer.signature" } },
  ],
});
