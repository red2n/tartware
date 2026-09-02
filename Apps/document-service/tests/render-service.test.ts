import { describe, expect, it } from "vitest";

import { renderDocument } from "../src/services/render-service.js";

import { folioFixture } from "./fixtures.js";

const render = (over: Parameters<typeof renderDocument>[0] extends infer T
  ? Partial<T>
  : never = {}) =>
  renderDocument({
    templateId: "FOLIO_STANDARD",
    format: "HTML",
    locale: "en",
    payload: folioFixture(),
    ...over,
  });

const html = async (locale = "en") => {
  const result = await render({ locale });
  if (!result.ok) throw new Error(`render refused: ${result.failure.code}`);
  return result.body.toString("utf8");
};

describe("renderDocument — the folio it was built for", () => {
  it("renders a closed folio to HTML", async () => {
    const page = await html();
    expect(page).toContain("The Tartware Grand");
    expect(page).toContain("F-2026-000412");
    expect(page).toContain("Ada Lovelace");
    expect(page).toContain("Restaurant — dinner");
  });

  it("prints the property's tax registration lines", async () => {
    // PMS-15-17: most EU jurisdictions require this on an invoice-like document.
    const page = await html();
    expect(page).toContain("VAT Reg. No.");
    expect(page).toContain("GB123456789");
    expect(page).toContain("EDI-99881");
  });

  it("formats every amount in the folio's own currency", async () => {
    const page = await html();
    expect(page).toContain("£210.00");
    expect(page).toContain("£86.40");
    expect(page).toContain("£536.40");
  });

  it("prints the stay dates in the document timezone, not the host's", async () => {
    const page = await html();
    expect(page).toContain("Sep 10, 2026");
    expect(page).toContain("Sep 13, 2026");
  });

  it("reports the metadata a caller needs without parsing the body", async () => {
    const result = await render();
    if (!result.ok) throw new Error("expected success");
    expect(result.meta).toMatchObject({
      template_id: "FOLIO_STANDARD",
      kind: "FOLIO",
      format: "HTML",
      locale: "en",
      title: "Guest Folio",
    });
    expect(result.meta.bytes).toBeGreaterThan(1000);
  });
});

describe("renderDocument — two languages, one payload", () => {
  it("swaps every label and the number formatting together", async () => {
    const [english, french] = await Promise.all([html("en"), html("fr")]);

    expect(english).toContain("Balance due");
    expect(english).toContain("Guest Folio");
    expect(french).toContain("Solde dû");
    expect(french).toContain("Note de séjour");
    expect(french).not.toContain("Balance due");

    // The amounts are the same money, printed the way each locale writes it.
    expect(english).toContain("£536.40");
    expect(french).toContain("536,40");
  });

  it("falls back to a base language for a regional tag", async () => {
    const result = await render({ locale: "fr-CA" });
    if (!result.ok) throw new Error("expected success");
    expect(result.meta.locale).toBe("fr");
    expect(result.body.toString("utf8")).toContain("Solde dû");
  });

  it("falls back to English for a language with no table", async () => {
    const result = await render({ locale: "de-AT" });
    if (!result.ok) throw new Error("expected success");
    // Reported honestly, so a caller is not left assuming they got German.
    expect(result.meta.locale).toBe("en");
    expect(result.body.toString("utf8")).toContain("Balance due");
  });
});

describe("renderDocument — sections that earn their place", () => {
  it("drops the tax summary when the folio has no tax lines", async () => {
    const page = await render({ payload: folioFixture({ taxes: [] }) }).then((r) => {
      if (!r.ok) throw new Error("expected success");
      return r.body.toString("utf8");
    });
    expect(page).not.toContain("Tax summary");
  });

  it("says so when a folio has no charges rather than printing an empty table", async () => {
    const page = await render({ payload: folioFixture({ charges: [] }) }).then((r) => {
      if (!r.ok) throw new Error("expected success");
      return r.body.toString("utf8");
    });
    expect(page).toContain("No charges posted.");
  });

  it("omits the company block entirely when there is no company", async () => {
    const page = await html();
    expect(page).not.toContain("Billed to");
  });

  it("includes the company block when there is one", async () => {
    const page = await render({
      payload: folioFixture({
        company: { name: "Analytical Engines Ltd", tax_id: "GB999888777" },
      }),
    }).then((r) => {
      if (!r.ok) throw new Error("expected success");
      return r.body.toString("utf8");
    });
    expect(page).toContain("Billed to");
    expect(page).toContain("Analytical Engines Ltd");
  });
});

describe("renderDocument — refusals", () => {
  it("refuses an unknown template", async () => {
    const result = await render({ templateId: "NOPE" });
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "TEMPLATE_NOT_FOUND" },
    });
  });

  it("refuses a payload that is not a folio, and says which field", async () => {
    const result = await render({ payload: { kind: "FOLIO" } });
    if (result.ok) throw new Error("expected refusal");
    expect(result.failure.code).toBe("PAYLOAD_INVALID");
    expect(result.failure.issues?.map((i) => i.path)).toContain("property");
  });

  it("refuses a folio whose totals are missing rather than printing a blank balance", async () => {
    const broken = folioFixture();
    const result = await render({
      payload: { ...broken, totals: undefined },
    });
    expect(result).toMatchObject({ ok: false, failure: { code: "PAYLOAD_INVALID" } });
  });
});

describe("renderDocument — PDF", () => {
  it("emits a structurally valid PDF", async () => {
    const result = await render({ format: "PDF" });
    if (!result.ok) throw new Error(`render refused: ${result.failure.code}`);

    const bytes = result.body;
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.subarray(-6).toString("latin1").trim()).toBe("%%EOF");
    expect(bytes.byteLength).toBeGreaterThan(1500);
    expect(result.contentType).toBe("application/pdf");
  });

  it("produces a different PDF per locale from the same payload", async () => {
    const [english, french] = await Promise.all([
      render({ format: "PDF", locale: "en" }),
      render({ format: "PDF", locale: "fr" }),
    ]);
    if (!english.ok || !french.ok) throw new Error("expected success");
    expect(english.body.equals(french.body)).toBe(false);
  });

  it("paginates a folio with more charges than fit on one page", async () => {
    const many = folioFixture({
      charges: Array.from({ length: 120 }, (_, index) => ({
        posting_id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
        posting_date: "2026-09-11",
        charge_code: "FNB",
        description: `Minibar item ${index + 1}`,
        quantity: 1,
        total_amount: 4.5,
        room_number: "412",
      })),
    });

    const single = await render({ format: "PDF" });
    const paginated = await render({ format: "PDF", payload: many });
    if (!single.ok || !paginated.ok) throw new Error("expected success");

    expect(paginated.body.byteLength).toBeGreaterThan(single.body.byteLength);
    // More than one /Type /Page object means the flow actually broke pages.
    const pageCount = (paginated.body.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [])
      .length;
    expect(pageCount).toBeGreaterThan(1);
  });

  it("refuses a folio with more rows than the configured ceiling", async () => {
    const huge = folioFixture({
      charges: Array.from({ length: 6000 }, (_, index) => ({
        posting_id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
        posting_date: "2026-09-11",
        charge_code: "FNB",
        description: `Item ${index}`,
        total_amount: 1,
      })),
    });
    const result = await render({ format: "PDF", payload: huge });
    expect(result).toMatchObject({ ok: false, failure: { code: "TOO_MANY_ROWS" } });
  });
});
