import { describe, expect, it } from "vitest";

import {
  addMoney,
  moneyEquals,
  moneyGt,
  moneyGte,
  parseDbMoney,
  parseDbMoneyOrZero,
  roundMoney,
  subtractMoney,
  toCents,
  toDollars,
} from "../src/utils/money.js";

describe("money utilities", () => {
  it("converts to cents and back safely", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
    expect(toDollars(toCents(12.34))).toBe(12.34);
  });

  it("adds and subtracts without floating-point drift", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subtractMoney(1.0, 0.3)).toBe(0.7);
  });

  it("rounds consistently", () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(roundMoney(10.554)).toBe(10.55);
  });

  it("compares amounts reliably", () => {
    expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true);
    expect(moneyGte(1.01, 1.0)).toBe(true);
    expect(moneyGt(1.01, 1.0)).toBe(true);
  });

  it("parses database money inputs safely", () => {
    expect(parseDbMoney(null)).toBeNull();
    expect(parseDbMoney(undefined)).toBeNull();
    expect(parseDbMoney("12.345")).toBe(12.35);
    expect(parseDbMoney(12.345)).toBe(12.35);
    expect(parseDbMoney("not-a-number")).toBeNull();
    expect(parseDbMoneyOrZero(null)).toBe(0);
  });
});
