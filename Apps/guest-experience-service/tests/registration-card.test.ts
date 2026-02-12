import { describe, expect, it } from "vitest";

import {
  renderRegistrationCardHtml,
} from "../src/services/registration-card-service.js";

describe("registration card HTML rendering", () => {
  const baseData = {
    registrationNumber: "RC-TEST-001",
    propertyName: "Grand Hotel Test",
    propertyAddress: "123 Test St, City, Country",
    propertyPhone: "+1-555-0100",
    guestName: "John Doe",
    guestEmail: "john@example.com",
    guestPhone: "+1-555-0123",
    guestDob: "1990-01-15",
    guestNationality: "US",
    guestAddress: "456 Home Ave, Hometown, USA",
    confirmationCode: "ABC12345",
    arrivalDate: "2025-06-15",
    departureDate: "2025-06-18",
    numberOfNights: 3,
    adults: 2,
    children: 1,
    roomNumber: "301",
    roomType: "Deluxe King",
    rateCode: "BAR",
  };

  it("renders valid HTML with all guest fields", () => {
    const html = renderRegistrationCardHtml(baseData);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Grand Hotel Test");
    expect(html).toContain("John Doe");
    expect(html).toContain("john@example.com");
    expect(html).toContain("+1-555-0123");
    expect(html).toContain("ABC12345");
    expect(html).toContain("RC-TEST-001");
  });

  it("includes stay details", () => {
    const html = renderRegistrationCardHtml(baseData);
    expect(html).toContain("2025-06-15");
    expect(html).toContain("2025-06-18");
    expect(html).toContain("301");
    expect(html).toContain("Deluxe King");
    expect(html).toContain("BAR");
    expect(html).toContain("2 Adult(s)");
    expect(html).toContain("1 Child(ren)");
  });

  it("handles null optional fields gracefully", () => {
    const html = renderRegistrationCardHtml({
      ...baseData,
      propertyAddress: null,
      propertyPhone: null,
      guestEmail: null,
      guestPhone: null,
      guestDob: null,
      guestNationality: null,
      guestAddress: null,
      roomNumber: null,
      roomType: null,
      rateCode: null,
      children: 0,
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("John Doe");
    // Should not contain "Child(ren)" when children = 0
    expect(html).not.toContain("Child(ren)");
  });

  it("escapes HTML entities in guest data", () => {
    const html = renderRegistrationCardHtml({
      ...baseData,
      guestName: '<script>alert("xss")</script>',
      propertyName: 'Hotel "O\'Malley" & Sons',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Sons");
    expect(html).toContain("&quot;O&#39;Malley&quot;");
  });

  it("includes terms and conditions section", () => {
    const html = renderRegistrationCardHtml(baseData);
    expect(html).toContain("Terms &amp; Conditions");
    expect(html).toContain("Sign here");
  });

  it("includes signature area", () => {
    const html = renderRegistrationCardHtml(baseData);
    expect(html).toContain("Guest Signature");
    expect(html).toContain("signature-area");
  });
});
