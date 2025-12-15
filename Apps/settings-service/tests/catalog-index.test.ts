import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { catalogCategories } from "../src/data/catalog/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cwdCatalogDir = join(process.cwd(), "src/data/catalog");
const localCatalogDir = join(__dirname, "../src/data/catalog");
const catalogDir = existsSync(cwdCatalogDir) ? cwdCatalogDir : localCatalogDir;

const categoryModuleFiles = readdirSync(catalogDir).filter((file) => {
  if (!file.endsWith(".ts") || file.endsWith(".d.ts")) {
    return false;
  }
  return file !== "index.ts";
});

describe("catalog index", () => {
  it("exports every category module", () => {
    expect(catalogCategories.length).toBe(categoryModuleFiles.length);
  });

  it("uses unique category codes", () => {
    const codes = catalogCategories.map((category) => category.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
