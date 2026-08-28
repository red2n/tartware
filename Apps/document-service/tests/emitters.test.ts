import { composeDocument, DocumentTemplateSchema } from "@tartware/schemas";
import { describe, expect, it } from "vitest";

import { emitHtml } from "../src/emitters/html.js";
import { emitPdf } from "../src/emitters/pdf.js";

const compose = (payload: unknown) =>
  composeDocument({
    template: DocumentTemplateSchema.parse({
      id: "T",
      kind: "FOLIO",
      name: "T",
      title: { from: "PATH", path: "title" },
      sections: [
        { kind: "HEADING", level: 1, text: { from: "PATH", path: "title" } },
        { kind: "TEXT", text: { from: "PATH", path: "note" } },
        {
          kind: "TABLE",
          rows_path: "rows",
          columns: [
            {
              header: { from: "LITERAL", value: "Name" },
              cell: { from: "PATH", path: "name" },
            },
          ],
          empty_text: { from: "LITERAL", value: "None" },
        },
      ],
    }),
    payload,
  });

describe("emitHtml — escaping", () => {
  /**
   * The payload comes from a caller and lands in a page a browser executes.
   * A guest whose name is a script tag must print as a guest name.
   */
  it("escapes markup in headings, text and table cells", () => {
    const page = emitHtml(
      compose({
        title: "<script>alert(1)</script>",
        note: "5 > 3 && 2 < 4",
        rows: [{ name: '"><img src=x onerror=alert(1)>' }],
      }),
    );

    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).not.toContain("<img src=x");
    expect(page).toContain("&lt;script&gt;");
    expect(page).toContain("&gt;");
    expect(page).toContain("&amp;&amp;");
  });

  it("escapes the document title in the head as well as the body", () => {
    const page = emitHtml(compose({ title: "</title><script>x</script>", rows: [] }));
    expect(page).not.toContain("</title><script>");
  });

  it("escapes the locale before it reaches the lang attribute", () => {
    const document = compose({ title: "Folio", rows: [] });
    const page = emitHtml({ ...document, locale: 'en" onload="alert(1)' });
    expect(page).not.toContain('onload="alert(1)"');
    expect(page).toContain("&quot;");
  });

  it("emits a complete document", () => {
    const page = emitHtml(compose({ title: "Folio", note: "Hello", rows: [] }));
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page.trimEnd().endsWith("</html>")).toBe(true);
  });
});

describe("emitPdf", () => {
  it("emits a single-page PDF without a page counter", async () => {
    const bytes = await emitPdf(compose({ title: "Folio", rows: [] }));
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // One page needs no "1 / 1" stamp.
    expect(bytes.toString("latin1")).not.toContain("1 / 1");
  });

  it("survives a payload whose every field is missing", async () => {
    const bytes = await emitPdf(compose({}));
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
