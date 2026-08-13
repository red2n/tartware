import { Injectable } from "@angular/core";
import type {
	AvailableRoomType,
	BookingLookupResponse,
	BookingResult,
	GuestBookingBody,
} from "@tartware/schemas";

/**
 * Lightweight API client for the guest self-service endpoints.
 * All requests go through the Angular dev proxy to the API Gateway (:8080).
 */
@Injectable({ providedIn: "root" })
export class GuestApiService {
	private readonly baseUrl = "/v1/self-service";

	async searchRooms(params: {
		tenant_id: string;
		property_id: string;
		check_in_date: string;
		check_out_date: string;
		adults: number;
		children?: number;
	}): Promise<{ roomTypes: AvailableRoomType[] }> {
		const qs = new URLSearchParams({
			tenant_id: params.tenant_id,
			property_id: params.property_id,
			check_in_date: params.check_in_date,
			check_out_date: params.check_out_date,
			adults: String(params.adults),
		});
		if (params.children) qs.set("children", String(params.children));

		const res = await fetch(`${this.baseUrl}/search?${qs}`);
		if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
		return res.json();
	}

	async createBooking(body: GuestBookingBody): Promise<BookingResult> {
		const res = await fetch(`${this.baseUrl}/book`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Booking failed: ${res.statusText}`);
		}
		return res.json();
	}

	async lookupBooking(confirmationCode: string): Promise<BookingLookupResponse | null> {
		const res = await fetch(`${this.baseUrl}/booking/${encodeURIComponent(confirmationCode)}`);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`Lookup failed: ${res.statusText}`);
		return res.json();
	}

	async startCheckin(body: {
		confirmation_code: string;
		last_name: string;
		tenant_id: string;
	}): Promise<CheckinStartResult> {
		const res = await fetch(`${this.baseUrl}/check-in/start`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Check-in failed: ${res.statusText}`);
		}
		return res.json();
	}

	async completeCheckin(
		checkinId: string,
		body: { tenant_id: string; accepted_terms: boolean },
	): Promise<CheckinCompleteResult> {
		const res = await fetch(`${this.baseUrl}/check-in/${encodeURIComponent(checkinId)}/complete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Check-in completion failed: ${res.statusText}`);
		}
		return res.json();
	}

	/**
	 * Read a check-in back.
	 *
	 * The portal started and completed a check-in without ever reading its state,
	 * so a refresh mid-flow lost the session. See ui-gaps/11-self-service-coverage.md.
	 */
	async getCheckin(checkinId: string, tenantId: string): Promise<CheckinStatusResult | null> {
		const qs = new URLSearchParams({ tenant_id: tenantId });
		const res = await fetch(
			`${this.baseUrl}/check-in/${encodeURIComponent(checkinId)}?${qs}`,
		);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`Check-in lookup failed: ${res.statusText}`);
		return res.json();
	}

	/** Folio preview before committing to checkout — the guest sees the bill first. */
	async previewCheckout(params: {
		tenant_id: string;
		confirmation_code: string;
	}): Promise<CheckoutPreview> {
		const qs = new URLSearchParams({
			tenant_id: params.tenant_id,
			confirmation_code: params.confirmation_code,
		});
		const res = await fetch(`${this.baseUrl}/check-out/preview?${qs}`);
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Checkout preview failed: ${res.statusText}`);
		}
		return res.json();
	}

	async completeCheckout(body: {
		tenant_id: string;
		confirmation_code: string;
		express?: boolean;
		notes?: string;
	}): Promise<CheckoutResult> {
		const res = await fetch(`${this.baseUrl}/check-out`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ express: true, ...body }),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Checkout failed: ${res.statusText}`);
		}
		return res.json();
	}

	async getKeys(reservationId: string, tenantId: string): Promise<MobileKey[]> {
		const qs = new URLSearchParams({ tenant_id: tenantId });
		const res = await fetch(
			`${this.baseUrl}/keys/${encodeURIComponent(reservationId)}?${qs}`,
		);
		if (!res.ok) throw new Error(`Key lookup failed: ${res.statusText}`);
		const body = await res.json();
		return Array.isArray(body) ? body : (body?.data ?? body?.keys ?? []);
	}

	/** The HTML variant is what a guest reads and signs; this is its URL, not its body. */
	registrationCardUrl(reservationId: string, tenantId: string): string {
		const qs = new URLSearchParams({ tenant_id: tenantId });
		return `${this.baseUrl}/registration-card/${encodeURIComponent(reservationId)}/html?${qs}`;
	}

	async getRewards(params: {
		tenant_id: string;
		property_id?: string;
		tier?: string;
	}): Promise<Reward[]> {
		const qs = new URLSearchParams({ tenant_id: params.tenant_id });
		if (params.property_id) qs.set("property_id", params.property_id);
		if (params.tier) qs.set("tier", params.tier);
		const res = await fetch(`${this.baseUrl}/rewards?${qs}`);
		if (!res.ok) throw new Error(`Reward catalog failed: ${res.statusText}`);
		const body = await res.json();
		return Array.isArray(body) ? body : (body?.data ?? []);
	}

	async redeemReward(body: {
		tenant_id?: string;
		property_id: string;
		guest_id: string;
		reward_id: string;
		reservation_id?: string;
	}): Promise<unknown> {
		const res = await fetch(`${this.baseUrl}/rewards/redeem`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Redemption failed: ${res.statusText}`);
		}
		return res.json();
	}

	/**
	 * Submit post-stay feedback.
	 *
	 * The confirmation code is the credential — the server resolves it to the
	 * reservation and derives guest, property and stay from it, so the portal never
	 * sends a guest_id it could not prove.
	 * See ui-gaps/09-guest-feedback.md.
	 */
	async submitFeedback(body: {
		tenant_id: string;
		confirmation_code: string;
		review_text: string;
		review_title?: string;
		overall_rating?: number;
		cleanliness_rating?: number;
		staff_rating?: number;
		location_rating?: number;
		value_rating?: number;
		would_recommend?: boolean;
		would_return?: boolean;
	}): Promise<{ message: string }> {
		const res = await fetch(`${this.baseUrl}/feedback`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (res.status === 404) {
			throw new Error("We could not find a booking with that confirmation code.");
		}
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? `Could not send feedback: ${res.statusText}`);
		}
		return res.json();
	}

	async getRedemptions(params: {
		tenant_id: string;
		guest_id?: string;
	}): Promise<Redemption[]> {
		const qs = new URLSearchParams({ tenant_id: params.tenant_id });
		if (params.guest_id) qs.set("guest_id", params.guest_id);
		const res = await fetch(`${this.baseUrl}/rewards/redemptions?${qs}`);
		if (!res.ok) throw new Error(`Redemption history failed: ${res.statusText}`);
		const body = await res.json();
		return Array.isArray(body) ? body : (body?.data ?? []);
	}
}

/**
 * Response shapes below are read defensively — each endpoint's envelope is
 * unwrapped above, and every display field is optional, because these nine
 * endpoints had no client until 2026-08-11 and their exact payloads have never
 * been exercised by a browser.
 */

export interface CheckinStatusResult {
	checkin_id?: string;
	status?: string;
	reservation_id?: string;
	room_number?: string | null;
	requires_terms?: boolean;
}

export interface CheckoutPreview {
	reservation_id?: string;
	confirmation_number?: string;
	guest_name?: string;
	room_number?: string | null;
	check_out_date?: string;
	balance?: number | string;
	currency?: string;
	total_charges?: number | string;
	total_payments?: number | string;
	charges?: Array<{
		description?: string;
		amount?: number | string;
		posting_date?: string;
	}>;
}

export interface CheckoutResult {
	status?: string;
	message?: string;
	balance?: number | string;
}

export interface MobileKey {
	key_id?: string;
	room_number?: string | null;
	key_code?: string | null;
	valid_from?: string;
	valid_until?: string;
	status?: string;
}

export interface Reward {
	reward_id?: string;
	reward_code?: string;
	reward_name?: string;
	description?: string;
	points_required?: number;
	category?: string;
}

export interface Redemption {
	redemption_id?: string;
	redemption_code?: string;
	reward_name?: string;
	status?: string;
	redeemed_at?: string;
	points_used?: number;
}

// ── Checkin view-model types (UI display shapes — not yet aligned with backend) ──

export interface CheckinStartResult {
	checkinId: string;
	reservationId: string;
	guestName: string;
	roomNumber: string | null;
	checkInDate: string;
	checkOutDate: string;
	requiresTerms: boolean;
}

export interface CheckinCompleteResult {
	checkinId: string;
	status: string;
	roomNumber: string;
	keyCode: string | null;
}
