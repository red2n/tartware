import { collectTemplateStringKeys } from "@tartware/schemas";
import { describe, expect, it } from "vitest";

import { allLocales, resolveLocale, supportedLocales } from "../src/locales/index.js";
import {
  assertTemplateCoverage,
  findCoverageGaps,
  getTemplate,
  listTemplates,
} from "../src/templates/index.js";

describe("template registry", () => {
  it("registers the standard folio", () => {
    expect(getTemplate("FOLIO_STANDARD")).toMatchObject({
      id: "FOLIO_STANDARD",
      kind: "FOLIO",
    });
  });

  it("returns undefined for an unknown id rather than throwing", () => {
    expect(getTemplate("NOPE")).toBeUndefined();
  });

  it("has every template translated in every registered locale", () => {
    // This is the check that runs at boot. A key added to a template without a
    // translation prints the raw key on a guest's folio.
    expect(findCoverageGaps()).toEqual([]);
    expect(() => assertTemplateCoverage()).not.toThrow();
  });

  it("keeps every locale table to the same key set", () => {
    const [first, ...rest] = allLocales();
    if (!first) throw new Error("no locales registered");
    const expected = Object.keys(first.strings).sort();
    for (const locale of rest) {
      expect(Object.keys(locale.strings).sort()).toEqual(expected);
    }
  });

  it("carries no locale strings that no template uses", () => {
    const used = new Set(listTemplates().flatMap(collectTemplateStringKeys));
    for (const { locale, strings } of allLocales()) {
      const unused = Object.keys(strings).filter((key) => !used.has(key));
      expect({ locale, unused }).toEqual({ locale, unused: [] });
    }
  });
});

describe("locale resolution", () => {
  it("lists what it can render", () => {
    expect(supportedLocales()).toEqual(["en", "fr"]);
  });

  it("resolves an exact tag", () => {
    expect(resolveLocale("fr").locale).toBe("fr");
  });

  it("walks a regional tag down to its base language", () => {
    expect(resolveLocale("fr-CA").locale).toBe("fr");
  });

  it("falls back to English for an unknown language", () => {
    expect(resolveLocale("de-AT").locale).toBe("en");
  });

  it("falls back for a malformed tag instead of throwing", () => {
    expect(resolveLocale("fr_CA").locale).toBe("en");
    expect(resolveLocale(undefined).locale).toBe("en");
  });
});
