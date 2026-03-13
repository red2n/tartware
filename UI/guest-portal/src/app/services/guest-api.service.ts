import { Injectable } from "@angular/core";

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
	}): Promise<{ roomTypes: RoomTypeResult[] }> {
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

	async createBooking(body: BookingRequest): Promise<BookingResponse> {
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

	async lookupBooking(confirmationCode: string): Promise<BookingDetail | null> {
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
}

// ── View-model types (UI-only, not shared with backend) ──

export interface RoomTypeResult {
	room_type_id: string;
	name: string;
	description: string;
	base_rate: number;
	currency: string;
	max_occupancy: number;
	amenities: string[];
	available_count: number;
}

export interface BookingRequest {
	tenant_id: string;
	property_id: string;
	guest_email: string;
	guest_first_name: string;
	guest_last_name: string;
	guest_phone?: string;
	room_type_id: string;
	check_in_date: string;
	check_out_date: string;
	adults: number;
	children?: number;
	payment_token?: string;
	special_requests?: string;
	idempotency_key?: string;
}

export interface BookingResponse {
	reservationId: string;
	confirmationCode: string;
	status: string;
	guestEmail: string;
}

export interface BookingDetail {
	reservationId: string;
	confirmationCode: string;
	status: string;
	propertyName: string;
	guestName: string;
	checkInDate: string;
	checkOutDate: string;
	adults: number;
	children: number;
}

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
