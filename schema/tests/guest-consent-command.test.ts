/**
 * `guest.consent.update` payload contract.
 *
 * The command was dispatched by the gateway for months with no handler and no
 * validator, so a consent change returned 202 and was silently dropped
 * (ui-gaps/19-gateway-proxy-mismatches.md). These assertions pin the shape the
 * handler now relies on: partial updates are legal, an empty decision is not,
 * and server-owned fields cannot be written by a caller.
 */

import { describe, expect, it } from "vitest";

import { GuestConsentUpdateCommandSchema } from "../src/events/commands/guests.js";
import { registeredCommandNames, validateCommandPayload } from "../src/command-validators.js";

const GUEST_ID = "3f8c1d9e-4b2a-4c6d-8e7f-1a2b3c4d5e6f";

describe("guest.consent.update payload", () => {
	it("is registered as a dispatchable command", () => {
		expect(registeredCommandNames.has("guest.consent.update")).toBe(true);
	});

	it("accepts a single toggle, so a screen need not restate the others", () => {
		const parsed = GuestConsentUpdateCommandSchema.parse({
			guest_id: GUEST_ID,
			marketing_email: false,
		});

		expect(parsed).toEqual({ guest_id: GUEST_ID, marketing_email: false });
	});

	it("accepts all four toggles", () => {
		const parsed = GuestConsentUpdateCommandSchema.parse({
			guest_id: GUEST_ID,
			marketing_email: true,
			marketing_sms: false,
			analytics: true,
			third_party_sharing: false,
		});

		expect(parsed.analytics).toBe(true);
		expect(parsed.third_party_sharing).toBe(false);
	});

	it("rejects a decision with no toggle — there would be nothing to record", () => {
		expect(() => GuestConsentUpdateCommandSchema.parse({ guest_id: GUEST_ID })).toThrow();
	});

	it("rejects a missing or malformed guest id", () => {
		expect(() => GuestConsentUpdateCommandSchema.parse({ analytics: true })).toThrow();
		expect(() =>
			GuestConsentUpdateCommandSchema.parse({ guest_id: "not-a-uuid", analytics: true }),
		).toThrow();
	});

	it("drops updated_at, which the ledger reports and a caller must not set", () => {
		const parsed = GuestConsentUpdateCommandSchema.parse({
			guest_id: GUEST_ID,
			analytics: true,
			updated_at: "2020-01-01T00:00:00.000Z",
		});

		expect(parsed).not.toHaveProperty("updated_at");
	});

	it("validates through the shared dispatch validator", () => {
		expect(() =>
			validateCommandPayload("guest.consent.update", { guest_id: GUEST_ID, marketing_sms: true }),
		).not.toThrow();
		expect(() => validateCommandPayload("guest.consent.update", { guest_id: GUEST_ID })).toThrow();
	});
});
