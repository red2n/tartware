/**
 * GL/ERP Export File Generator — ACCT-06
 *
 * Generates USALI-compliant CSV and XML representations of GL batch entries
 * for download or ERP push.
 *
 * Column order follows USALI 12th Edition standard export format:
 *   BatchNumber, BatchDate, AccountingPeriod, PostingDate, GLAccountCode,
 *   CostCenter, UsaliCategory, DepartmentCode, Description, DebitAmount,
 *   CreditAmount, Currency, FolioNumber, ConfirmationNumber, ReferenceNumber,
 *   SourceTable, SourceId
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Subset of the GL entry row used for export. */
export interface GlExportEntry {
  gl_entry_id: string;
  batch_number: string | null;
  batch_date: string | Date | null;
  accounting_period: string | null;
  posting_date: string | Date;
  gl_account_code: string;
  cost_center: string | null;
  usali_category: string | null;
  department_code: string | null;
  description: string | null;
  debit_amount: string | number;
  credit_amount: string | number;
  currency: string | null;
  folio_number: string | null;
  confirmation_number: string | null;
  reference_number: string | null;
  source_table: string | null;
  source_id: string | null;
}

// ─── CSV Generator ────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "BatchNumber",
  "BatchDate",
  "AccountingPeriod",
  "PostingDate",
  "GLAccountCode",
  "CostCenter",
  "UsaliCategory",
  "DepartmentCode",
  "Description",
  "DebitAmount",
  "CreditAmount",
  "Currency",
  "FolioNumber",
  "ConfirmationNumber",
  "ReferenceNumber",
  "SourceTable",
  "SourceId",
];

/** Escape a CSV field value per RFC 4180. */
const csvEscape = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toDateStr = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
};

const toAmountStr = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "0.00";
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isNaN(n) ? "0.00" : n.toFixed(2);
};

/**
 * Convert GL entries to USALI-compliant CSV text.
 * Returns a UTF-8 string with CRLF line endings (RFC 4180).
 */
export const glEntriesToCsv = (entries: GlExportEntry[]): string => {
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const e of entries) {
    const row = [
      csvEscape(e.batch_number),
      csvEscape(toDateStr(e.batch_date)),
      csvEscape(e.accounting_period),
      csvEscape(toDateStr(e.posting_date)),
      csvEscape(e.gl_account_code),
      csvEscape(e.cost_center),
      csvEscape(e.usali_category),
      csvEscape(e.department_code),
      csvEscape(e.description),
      csvEscape(toAmountStr(e.debit_amount)),
      csvEscape(toAmountStr(e.credit_amount)),
      csvEscape(e.currency ?? "USD"),
      csvEscape(e.folio_number),
      csvEscape(e.confirmation_number),
      csvEscape(e.reference_number),
      csvEscape(e.source_table),
      csvEscape(e.source_id),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\r\n");
};

// ─── XML Generator ────────────────────────────────────────────────────────────

/** Escape special XML characters. */
const xmlEscape = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Convert GL entries to USALI-compliant XML text.
 * Follows a simple standard structure for ERP import.
 */
export const glEntriesToXml = (
  entries: GlExportEntry[],
  meta: { batchId: string; exportedAt: string; propertyId: string },
): string => {
  const entryElements = entries
    .map(
      (e) => `    <GlEntry id="${xmlEscape(e.gl_entry_id)}">
      <BatchNumber>${xmlEscape(e.batch_number)}</BatchNumber>
      <BatchDate>${xmlEscape(toDateStr(e.batch_date))}</BatchDate>
      <AccountingPeriod>${xmlEscape(e.accounting_period)}</AccountingPeriod>
      <PostingDate>${xmlEscape(toDateStr(e.posting_date))}</PostingDate>
      <GlAccountCode>${xmlEscape(e.gl_account_code)}</GlAccountCode>
      <CostCenter>${xmlEscape(e.cost_center)}</CostCenter>
      <UsaliCategory>${xmlEscape(e.usali_category)}</UsaliCategory>
      <DepartmentCode>${xmlEscape(e.department_code)}</DepartmentCode>
      <Description>${xmlEscape(e.description)}</Description>
      <DebitAmount>${xmlEscape(toAmountStr(e.debit_amount))}</DebitAmount>
      <CreditAmount>${xmlEscape(toAmountStr(e.credit_amount))}</CreditAmount>
      <Currency>${xmlEscape(e.currency ?? "USD")}</Currency>
      <FolioNumber>${xmlEscape(e.folio_number)}</FolioNumber>
      <ConfirmationNumber>${xmlEscape(e.confirmation_number)}</ConfirmationNumber>
      <ReferenceNumber>${xmlEscape(e.reference_number)}</ReferenceNumber>
      <SourceTable>${xmlEscape(e.source_table)}</SourceTable>
      <SourceId>${xmlEscape(e.source_id)}</SourceId>
    </GlEntry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<GlExport xmlns="urn:tartware:usali-gl-export:v1"
          batchId="${xmlEscape(meta.batchId)}"
          propertyId="${xmlEscape(meta.propertyId)}"
          exportedAt="${xmlEscape(meta.exportedAt)}"
          standard="USALI-12th-Edition"
          entryCount="${entries.length}">
  <GlEntries>
${entryElements}
  </GlEntries>
</GlExport>`;
};
