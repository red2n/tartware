import { describe, expect, it } from "vitest";

import { DEFAULT_ENABLED_MODULES, normalizeModuleList } from "../src/modules/module-registry.js";

describe("Module Registry", () => {
  it("returns defaults for non-arrays and invalid values", () => {
    expect(normalizeModuleList("core")).toEqual(DEFAULT_ENABLED_MODULES);
    expect(normalizeModuleList([1, null, ""])).toEqual(DEFAULT_ENABLED_MODULES);
  });

  it("normalizes and de-duplicates module ids", () => {
    const modules = normalizeModuleList(["CORE", "core", "analytics-bi", "unknown"]);
    expect(modules).toEqual(["core", "analytics-bi"]);
  });
});
