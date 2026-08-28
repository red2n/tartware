/**
 * DEV DOC
 * Module: emitters/pdf.ts
 * Purpose: Emit a composed document as a paginated A4 PDF.
 * Ownership: document-service
 *
 * Like the HTML emitter, this reads {@link ComposedDocument} and never the
 * payload, so the two outputs cannot disagree about what a folio says.
 *
 * Layout is a single downward flow with an explicit page break before any block
 * that will not fit. PDFKit will break a paragraph on its own, but it will
 * happily split a table row across a page boundary and leave the amount on the
 * next page — so tables measure each row first and break between rows.
 *
 * **Script coverage.** Text is set in Helvetica, a PDF core font with WinAnsi
 * coverage: Latin-1 and Latin-1 Supplement, which covers `en` and `fr`. A
 * locale in a non-Latin script (the UI already ships `zh-TW`) needs a TTF
 * embedded here first; `registerDocumentFont` is the seam for that, and until
 * one is registered a CJK folio will render blanks. Deliberately not solved by
 * shipping a 20 MB CJK font in the repository.
 */

import type { ComposedDocument, DocumentBlock } from "@tartware/schemas";
import PDFDocument from "pdfkit";

/** A4 in PostScript points, and the margin every page is laid out inside. */
const PAGE = { size: "A4" as const, margin: 50 };

const FONT = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
};

const SIZE = {
  h1: 20,
  h2: 15,
  h3: 12,
  body: 9.5,
  small: 8,
  sectionTitle: 8,
};

const COLOR = {
  ink: "#1a1a1a",
  muted: "#666666",
  rule: "#d4d4d4",
  hairline: "#eeeeee",
};

const SPACER_HEIGHT: Record<string, number> = {
  SMALL: 6,
  MEDIUM: 14,
  LARGE: 26,
};

/** Fonts registered by the host, keyed by the name templates refer to. */
const registeredFonts = new Map<string, Buffer>();

/**
 * Register a TTF for use as the document body font.
 *
 * The seam for non-Latin scripts. Not called anywhere yet — see the module note.
 */
export const registerDocumentFont = (name: string, data: Buffer): void => {
  registeredFonts.set(name, data);
};

type Doc = InstanceType<typeof PDFDocument>;

/** Usable width between the margins. */
const contentWidth = (doc: Doc): number =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

/** Y coordinate past which content must move to the next page. */
const pageBottom = (doc: Doc): number => doc.page.height - doc.page.margins.bottom - 24; // 24pt reserved for the page number

/** Start a new page when `needed` points will not fit below the cursor. */
const ensureSpace = (doc: Doc, needed: number): void => {
  if (doc.y + needed > pageBottom(doc)) doc.addPage();
};

const applyFont = (doc: Doc, options: { bold?: boolean; size: number; color?: string }): void => {
  doc
    .font(options.bold ? FONT.bold : FONT.regular)
    .fontSize(options.size)
    .fillColor(options.color ?? COLOR.ink);
};

/** Column x-offsets and widths derived from the relative weights. */
const columnLayout = (
  doc: Doc,
  columns: Array<{ weight: number }>,
): Array<{ x: number; width: number }> => {
  const gutter = 6;
  const total = columns.reduce((sum, column) => sum + column.weight, 0) || 1;
  const available = contentWidth(doc) - gutter * (columns.length - 1);
  let x = doc.page.margins.left;

  return columns.map((column) => {
    const width = (column.weight / total) * available;
    const layout = { x, width };
    x += width + gutter;
    return layout;
  });
};

const alignOf = (align: string): "left" | "center" | "right" =>
  align === "RIGHT" ? "right" : align === "CENTER" ? "center" : "left";

/** Draw a horizontal rule across the content width. */
const rule = (doc: Doc, color: string, y: number): void => {
  doc
    .save()
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.5)
    .strokeColor(color)
    .stroke()
    .restore();
};

/** True when a table's header row carries any label worth printing. */
const hasHeaderLabels = (columns: Array<{ label: string }>): boolean =>
  columns.some((column) => column.label.trim() !== "");

const drawSectionTitle = (doc: Doc, title: string): void => {
  ensureSpace(doc, 26);
  applyFont(doc, { bold: true, size: SIZE.sectionTitle, color: COLOR.muted });
  doc.text(title.toUpperCase(), doc.page.margins.left, doc.y, {
    width: contentWidth(doc),
    characterSpacing: 0.4,
  });
  doc.moveDown(0.3);
};

const drawTable = (doc: Doc, block: Extract<DocumentBlock, { kind: "TABLE" }>): void => {
  if (block.title) drawSectionTitle(doc, block.title);

  if (block.rows.length === 0) {
    if (block.empty_text) {
      applyFont(doc, { size: SIZE.body, color: COLOR.muted });
      doc.text(block.empty_text, doc.page.margins.left, doc.y, {
        width: contentWidth(doc),
      });
      doc.moveDown(0.6);
    }
    return;
  }

  const layout = columnLayout(doc, block.columns);
  const showHeader = hasHeaderLabels(block.columns);

  const drawHeader = (): void => {
    if (!showHeader) return;
    applyFont(doc, { bold: true, size: SIZE.small, color: COLOR.muted });
    const top = doc.y;
    let bottom = top;
    block.columns.forEach((column, index) => {
      const slot = layout[index];
      if (!slot) return;
      doc.text(column.label.toUpperCase(), slot.x, top, {
        width: slot.width,
        align: alignOf(column.align),
      });
      bottom = Math.max(bottom, doc.y);
    });
    doc.y = bottom + 3;
    rule(doc, COLOR.rule, doc.y);
    doc.y += 4;
  };

  ensureSpace(doc, 48);
  drawHeader();

  for (const row of block.rows) {
    applyFont(doc, { size: SIZE.body });

    // Measure before drawing: a row split across a page break leaves the
    // description on one page and the amount on the next.
    const rowHeight = row.reduce((tallest, cell, index) => {
      const slot = layout[index];
      if (!slot) return tallest;
      return Math.max(tallest, doc.heightOfString(cell, { width: slot.width }));
    }, 0);

    if (doc.y + rowHeight + 6 > pageBottom(doc)) {
      doc.addPage();
      drawHeader();
      applyFont(doc, { size: SIZE.body });
    }

    const top = doc.y;
    row.forEach((cell, index) => {
      const slot = layout[index];
      const column = block.columns[index];
      if (!slot || !column) return;
      doc.text(cell, slot.x, top, {
        width: slot.width,
        align: alignOf(column.align),
      });
    });

    doc.y = top + rowHeight + 4;
    rule(doc, COLOR.hairline, doc.y - 2);
  }

  doc.moveDown(0.6);
};

const drawKeyValues = (doc: Doc, block: Extract<DocumentBlock, { kind: "KEY_VALUES" }>): void => {
  if (block.title) drawSectionTitle(doc, block.title);

  const columnCount = block.columns;
  const gutter = 24;
  const columnWidth = (contentWidth(doc) - gutter * (columnCount - 1)) / columnCount;
  const labelWidth = Math.min(110, columnWidth * 0.45);
  const valueWidth = columnWidth - labelWidth - 6;

  for (let index = 0; index < block.rows.length; index += columnCount) {
    const rowCells = block.rows.slice(index, index + columnCount);

    const rowHeight = rowCells.reduce((tallest, cell) => {
      applyFont(doc, { size: SIZE.body });
      return Math.max(
        tallest,
        doc.heightOfString(cell.value, { width: valueWidth }),
        doc.heightOfString(cell.label, { width: labelWidth }),
      );
    }, 0);

    ensureSpace(doc, rowHeight + 4);
    const top = doc.y;

    rowCells.forEach((cell, column) => {
      const x = doc.page.margins.left + column * (columnWidth + gutter);
      applyFont(doc, { size: SIZE.body, color: COLOR.muted });
      doc.text(cell.label, x, top, { width: labelWidth });
      applyFont(doc, { size: SIZE.body, color: COLOR.ink });
      doc.text(cell.value, x + labelWidth + 6, top, { width: valueWidth });
    });

    doc.y = top + rowHeight + 2;
  }

  doc.moveDown(0.4);
};

const drawTotals = (doc: Doc, block: Extract<DocumentBlock, { kind: "TOTALS" }>): void => {
  const width = Math.min(260, contentWidth(doc));
  const x = doc.page.width - doc.page.margins.right - width;
  const labelWidth = width * 0.6;
  const valueWidth = width - labelWidth;

  ensureSpace(doc, block.rows.length * 16 + 10);

  for (const row of block.rows) {
    if (row.emphasis) {
      doc.y += 4;
      doc
        .save()
        .moveTo(x, doc.y)
        .lineTo(x + width, doc.y)
        .lineWidth(1)
        .strokeColor(COLOR.ink)
        .stroke()
        .restore();
      doc.y += 5;
    }

    const size = row.emphasis ? SIZE.h3 : SIZE.body;
    const top = doc.y;
    applyFont(doc, {
      size,
      bold: row.emphasis,
      color: row.emphasis ? COLOR.ink : COLOR.muted,
    });
    doc.text(row.label, x, top, { width: labelWidth });
    applyFont(doc, { size, bold: row.emphasis, color: COLOR.ink });
    doc.text(row.value, x + labelWidth, top, {
      width: valueWidth,
      align: "right",
    });
    doc.y = Math.max(doc.y, top + size + 3);
  }

  doc.moveDown(0.5);
};

const drawBlock = (doc: Doc, block: DocumentBlock): void => {
  switch (block.kind) {
    case "HEADING": {
      const size = block.level === 1 ? SIZE.h1 : block.level === 2 ? SIZE.h2 : SIZE.h3;
      ensureSpace(doc, size + 12);
      if (block.level > 1) doc.moveDown(0.5);
      applyFont(doc, { bold: true, size });
      doc.text(block.text, doc.page.margins.left, doc.y, {
        width: contentWidth(doc),
      });
      doc.moveDown(0.25);
      return;
    }

    case "TEXT": {
      applyFont(doc, {
        size: SIZE.body,
        bold: block.style === "STRONG",
        color: block.style === "MUTED" ? COLOR.muted : COLOR.ink,
      });
      ensureSpace(doc, doc.heightOfString(block.text, { width: contentWidth(doc) }));
      doc.text(block.text, doc.page.margins.left, doc.y, {
        width: contentWidth(doc),
      });
      return;
    }

    case "KEY_VALUES":
      drawKeyValues(doc, block);
      return;

    case "TABLE":
      drawTable(doc, block);
      return;

    case "TOTALS":
      drawTotals(doc, block);
      return;

    case "DIVIDER":
      ensureSpace(doc, 14);
      doc.y += 6;
      rule(doc, COLOR.rule, doc.y);
      doc.y += 8;
      return;

    case "SPACER":
      doc.y += SPACER_HEIGHT[block.size] ?? 14;
      return;

    case "SIGNATURE": {
      ensureSpace(doc, 52);
      doc.y += 28;
      const width = Math.min(240, contentWidth(doc));
      doc
        .save()
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + width, doc.y)
        .lineWidth(0.75)
        .strokeColor(COLOR.ink)
        .stroke()
        .restore();
      doc.y += 4;
      applyFont(doc, { size: SIZE.small, color: COLOR.muted });
      doc.text(block.label, doc.page.margins.left, doc.y, { width });
      return;
    }

    default:
  }
};

/** Stamp "n / total" on every page, once the total is finally known. */
const stampPageNumbers = (doc: Doc): void => {
  const range = doc.bufferedPageRange();
  if (range.count <= 1) return;

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    applyFont(doc, { size: SIZE.small, color: COLOR.muted });
    doc.text(
      `${index + 1} / ${range.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 6,
      { width: contentWidth(doc), align: "right", lineBreak: false },
    );
  }
};

/**
 * Render a composed document to PDF bytes.
 *
 * Buffered rather than streamed: the page count is not known until the last
 * block is drawn, and a folio without "page 1 of 3" on it is a folio a guest
 * cannot tell is incomplete.
 */
export const emitPdf = async (document: ComposedDocument): Promise<Buffer> => {
  const doc = new PDFDocument({
    size: PAGE.size,
    margin: PAGE.margin,
    bufferPages: true,
    info: { Title: document.title, Creator: "Tartware PMS" },
  });

  const font = registeredFonts.get("body");
  if (font) doc.registerFont(FONT.regular, font);

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (const block of [...document.header, ...document.body, ...document.footer]) {
    drawBlock(doc, block);
  }

  stampPageNumbers(doc);
  doc.end();

  return finished;
};
