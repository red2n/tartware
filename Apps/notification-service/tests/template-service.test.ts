import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import { listTemplates, getTemplate } from "../src/services/template-service.js";
import { query } from "../src/lib/db.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "aaaa1111-1111-1111-1111-111111111111";

const makeTemplateRow = (overrides: Record<string, unknown> = {}) => ({
  id: TEMPLATE_ID,
  tenant_id: TENANT_ID,
  property_id: null,
  template_name: "Booking Confirmation",
  template_code: "BOOKING_CONFIRMED",
  communication_type: "EMAIL",
  category: "reservations",
  subject: "Your booking is confirmed",
  body: "Dear {{guest_name}}, your reservation {{confirmation_number}} is confirmed.",
  html_body: null,
  language_code: "en",
  variables: null,
  is_active: true,
  is_automated: true,
  trigger_event: "reservation.confirmed",
  trigger_offset_hours: null,
  send_priority: 10,
  from_name: "Hotel Front Desk",
  from_email: "frontdesk@hotel.com",
  from_phone: null,
  reply_to_email: null,
  cc_emails: null,
  bcc_emails: null,
  attachments: null,
  metadata: null,
  usage_count: 42,
  last_used_at: new Date("2026-01-15T10:00:00Z"),
  created_by: null,
  updated_by: null,
  created_at: new Date("2025-06-01T00:00:00Z"),
  updated_at: new Date("2025-12-01T00:00:00Z"),
  ...overrides,
});

describe("template-service", () => {
  it("listTemplates returns rows from database", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [makeTemplateRow(), makeTemplateRow({ id: "bbbb2222-2222-2222-2222-222222222222", template_code: "CHECK_IN_CONFIRMATION" })],
      rowCount: 2,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await listTemplates(TENANT_ID, 50, 0);

    expect(results).toHaveLength(2);
    expect(results[0]?.template_code).toBe("BOOKING_CONFIRMED");
    expect(results[1]?.template_code).toBe("CHECK_IN_CONFIRMATION");
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.any(String), [TENANT_ID, 50, 0]);
  });

  it("listTemplates caps limit to 200", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    await listTemplates(TENANT_ID, 500, 0);

    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.any(String), [TENANT_ID, 200, 0]);
  });

  it("getTemplate returns single template", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [makeTemplateRow()],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await getTemplate(TENANT_ID, TEMPLATE_ID);

    expect(result).not.toBeNull();
    expect(result?.template_name).toBe("Booking Confirmation");
    expect(result?.is_active).toBe(true);
  });

  it("getTemplate returns null when not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const result = await getTemplate(TENANT_ID, TEMPLATE_ID);

    expect(result).toBeNull();
  });
});
