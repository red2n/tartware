/**
 * DEV DOC
 * Module: emitters/html.ts
 * Purpose: Emit a composed document as a self-contained, print-ready HTML page.
 * Ownership: document-service
 *
 * Reads {@link ComposedDocument} and nothing else — it never sees the payload,
 * which is what keeps it from quietly disagreeing with the PDF about content.
 *
 * Every string is escaped. The payload arrives from a caller and lands in a
 * page a browser will execute; a guest name of `<script>` must print as a guest
 * name, not run.
 */
import type { ComposedDocument, DocumentBlock } from "@tartware/schemas";

/** Escape text for interpolation into HTML body content or an attribute. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ALIGN_CSS: Record<string, string> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
};

const SPACER_CSS: Record<string, string> = {
  SMALL: "8px",
  MEDIUM: "18px",
  LARGE: "32px",
};

/**
 * A header row of entirely blank labels is a continuation of the block above
 * it — the tax-registration lines in the folio letterhead are the case this
 * exists for — so it is dropped rather than printed as an empty band.
 */
const hasHeaderLabels = (columns: Array<{ label: string }>): boolean =>
  columns.some((column) => column.label.trim() !== "");

const renderBlock = (block: DocumentBlock): string => {
  switch (block.kind) {
    case "HEADING":
      return `<h${block.level} class="h${block.level}">${escapeHtml(block.text)}</h${block.level}>`;

    case "TEXT":
      return `<p class="text ${block.style.toLowerCase()}">${escapeHtml(block.text)}</p>`;

    case "KEY_VALUES": {
      const title = block.title ? `<h3 class="section-title">${escapeHtml(block.title)}</h3>` : "";
      const rows = block.rows
        .map(
          (row) =>
            `<div class="kv"><span class="kv-label">${escapeHtml(row.label)}</span>` +
            `<span class="kv-value">${escapeHtml(row.value)}</span></div>`,
        )
        .join("");
      return `${title}<div class="kv-grid cols-${block.columns}">${rows}</div>`;
    }

    case "TABLE": {
      const title = block.title ? `<h3 class="section-title">${escapeHtml(block.title)}</h3>` : "";

      if (block.rows.length === 0) {
        const empty = block.empty_text
          ? `<p class="text muted">${escapeHtml(block.empty_text)}</p>`
          : "";
        return `${title}${empty}`;
      }

      const totalWeight = block.columns.reduce((sum, c) => sum + c.weight, 0);
      const head = hasHeaderLabels(block.columns)
        ? `<thead><tr>${block.columns
            .map(
              (column) =>
                `<th style="text-align:${ALIGN_CSS[column.align] ?? "left"};` +
                `width:${((column.weight / totalWeight) * 100).toFixed(2)}%">` +
                `${escapeHtml(column.label)}</th>`,
            )
            .join("")}</tr></thead>`
        : "";

      const body = block.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell, index) =>
                  `<td style="text-align:${
                    ALIGN_CSS[block.columns[index]?.align ?? "LEFT"] ?? "left"
                  }">${escapeHtml(cell)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");

      return `${title}<table class="table">${head}<tbody>${body}</tbody></table>`;
    }

    case "TOTALS":
      return `<table class="totals">${block.rows
        .map(
          (row) =>
            `<tr class="${row.emphasis ? "emphasis" : ""}">` +
            `<td class="totals-label">${escapeHtml(row.label)}</td>` +
            `<td class="totals-value">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("")}</table>`;

    case "DIVIDER":
      return `<hr class="divider" />`;

    case "SPACER":
      return `<div style="height:${SPACER_CSS[block.size] ?? "18px"}"></div>`;

    case "SIGNATURE":
      return (
        `<div class="signature"><div class="signature-line"></div>` +
        `<span class="signature-label">${escapeHtml(block.label)}</span></div>`
      );

    default:
      return "";
  }
};

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1a1a1a; background: #fff;
    margin: 0; padding: 32px; font-size: 13px; line-height: 1.5;
  }
  .document { max-width: 760px; margin: 0 auto; }
  .h1 { font-size: 22px; margin: 0 0 2px; font-weight: 600; }
  .h2 { font-size: 17px; margin: 18px 0 8px; font-weight: 600; }
  .h3 { font-size: 14px; margin: 14px 0 6px; font-weight: 600; }
  .section-title {
    font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
    color: #666; margin: 16px 0 6px; font-weight: 600;
  }
  .text { margin: 0 0 2px; }
  .text.muted { color: #666; }
  .text.strong { font-weight: 600; }
  .divider { border: none; border-top: 1px solid #d4d4d4; margin: 14px 0; }
  .kv-grid { display: grid; gap: 2px 24px; margin-bottom: 6px; }
  .kv-grid.cols-1 { grid-template-columns: 1fr; }
  .kv-grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .kv { display: flex; gap: 8px; }
  .kv-label { color: #666; min-width: 120px; }
  .kv-value { font-weight: 500; }
  .table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  .table th {
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: #666; font-weight: 600; padding: 6px 6px; border-bottom: 1px solid #d4d4d4;
  }
  .table td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .totals { margin: 8px 0 0 auto; border-collapse: collapse; min-width: 280px; }
  .totals td { padding: 4px 6px; }
  .totals .totals-label { color: #666; }
  .totals .totals-value { text-align: right; font-variant-numeric: tabular-nums; }
  .totals tr.emphasis td {
    font-weight: 700; font-size: 15px; border-top: 2px solid #1a1a1a; padding-top: 8px;
  }
  .signature { margin-top: 36px; }
  .signature-line { border-top: 1px solid #1a1a1a; width: 260px; margin-bottom: 4px; }
  .signature-label { font-size: 11px; color: #666; }
  @media print {
    body { padding: 0; }
    .table { page-break-inside: auto; }
    .table tr { page-break-inside: avoid; }
  }
`;

/** Emit a composed document as a complete HTML page. */
export const emitHtml = (document: ComposedDocument): string => {
  const render = (blocks: DocumentBlock[]) => blocks.map(renderBlock).join("\n");

  return `<!doctype html>
<html lang="${escapeHtml(document.locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(document.title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="document">
${render(document.header)}
${render(document.body)}
${render(document.footer)}
</div>
</body>
</html>`;
};
