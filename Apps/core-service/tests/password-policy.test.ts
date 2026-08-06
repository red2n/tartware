import { describe, expect, it } from "vitest";

import {
  checkPassword,
  type PasswordPolicy,
  PasswordPolicyError,
} from "../src/services/password-policy-service.js";

const policy = (overrides: Partial<PasswordPolicy> = {}): PasswordPolicy => ({
  minLength: 12,
  requiresUppercase: true,
  requiresNumber: true,
  ...overrides,
});

describe("password policy enforcement", () => {
  it("accepts a password meeting every rule", () => {
    expect(checkPassword("CorrectHorse9Battery", policy())).toEqual([]);
  });

  it("rejects a password shorter than the minimum", () => {
    const violations = checkPassword("Short9A", policy());
    expect(violations).toContain("must be at least 12 characters");
  });

  it("rejects a password with no uppercase when required", () => {
    expect(checkPassword("lowercase9only", policy())).toContain("must contain an uppercase letter");
  });

  it("rejects a password with no digit when required", () => {
    expect(checkPassword("NoDigitsInHere", policy())).toContain("must contain a number");
  });

  it("reports every violation at once rather than stopping at the first", () => {
    expect(checkPassword("abc", policy())).toHaveLength(3);
  });

  it("skips complexity rules the tenant has turned off", () => {
    const relaxed = policy({ requiresUppercase: false, requiresNumber: false });
    expect(checkPassword("all lowercase words", relaxed)).toEqual([]);
  });

  it("still enforces length when complexity rules are off", () => {
    const relaxed = policy({ requiresUppercase: false, requiresNumber: false });
    expect(checkPassword("tooshort", relaxed)).toContain("must be at least 12 characters");
  });

  it("carries the violations on the error for the API response", () => {
    const error = new PasswordPolicyError(["must contain a number"]);
    expect(error.violations).toEqual(["must contain a number"]);
    expect(error.message).toContain("must contain a number");
  });
});
