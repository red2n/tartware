import { describe, expect, it } from "vitest";

import {
  renderTemplate,
  extractTemplateVariables,
} from "../src/utils/template-renderer.js";

describe("renderTemplate", () => {
  it("replaces simple variables", () => {
    const result = renderTemplate("Hello {{name}}, welcome to {{hotel}}!", {
      name: "John",
      hotel: "Tartware City Center",
    });
    expect(result).toBe("Hello John, welcome to Tartware City Center!");
  });

  it("is case-insensitive for variable lookup", () => {
    const result = renderTemplate("Dear {{GUEST_NAME}}", { guest_name: "Alice" });
    expect(result).toBe("Dear Alice");
  });

  it("uses fallback when variable is missing", () => {
    const result = renderTemplate("Room: {{room_number | TBD}}", {});
    expect(result).toBe("Room: TBD");
  });

  it("prefers actual value over fallback", () => {
    const result = renderTemplate("Room: {{room_number | TBD}}", { room_number: "201" });
    expect(result).toBe("Room: 201");
  });

  it("preserves unresolved variables without fallback", () => {
    const result = renderTemplate("Hi {{name}}, your code is {{code}}", {
      name: "Bob",
    });
    expect(result).toBe("Hi Bob, your code is {{code}}");
  });

  it("handles numeric and boolean context values", () => {
    const result = renderTemplate("Nights: {{nights}}, VIP: {{vip}}", {
      nights: 3,
      vip: true,
    });
    expect(result).toBe("Nights: 3, VIP: true");
  });

  it("skips null/undefined context values", () => {
    const result = renderTemplate("Name: {{name | Guest}}", {
      name: null,
    });
    expect(result).toBe("Name: Guest");
  });

  it("handles empty template", () => {
    expect(renderTemplate("", { name: "test" })).toBe("");
  });

  it("handles template with no variables", () => {
    expect(renderTemplate("No variables here", {})).toBe("No variables here");
  });

  it("handles whitespace in variable names", () => {
    const result = renderTemplate("{{ guest_name }}", { guest_name: "Jane" });
    expect(result).toBe("Jane");
  });
});

describe("extractTemplateVariables", () => {
  it("extracts unique variable names", () => {
    const vars = extractTemplateVariables(
      "Hello {{name}}, your room is {{room_number}}. Welcome {{name}}!",
    );
    expect(vars).toContain("name");
    expect(vars).toContain("room_number");
    expect(vars).toHaveLength(2);
  });

  it("lowercases and trims variable names", () => {
    const vars = extractTemplateVariables("{{ Guest_Name }} and {{ HOTEL }}");
    expect(vars).toContain("guest_name");
    expect(vars).toContain("hotel");
  });

  it("extracts variables with fallbacks", () => {
    const vars = extractTemplateVariables("{{name | Unknown}} and {{room | TBD}}");
    expect(vars).toContain("name");
    expect(vars).toContain("room");
    expect(vars).toHaveLength(2);
  });

  it("returns empty array for no variables", () => {
    expect(extractTemplateVariables("No variables here")).toEqual([]);
  });

  it("returns empty array for empty template", () => {
    expect(extractTemplateVariables("")).toEqual([]);
  });
});
