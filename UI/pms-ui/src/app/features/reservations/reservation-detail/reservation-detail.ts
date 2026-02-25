import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { AvailabilityResponse, AvailableRoom, ReservationDetail } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { reservationStatusClass } from "../../../shared/badge-utils";
import { formatCurrency, formatLongDate } from "../../../shared/format-utils";

type DetailRow = { label: string; value: string; badge?: string };

/** Statuses that allow front-desk check-in per PMS industry standard. */
const CHECKIN_ALLOWED = new Set(["PENDING", "CONFIRMED"]);
/** Statuses that allow check-out. */
const CHECKOUT_ALLOWED = new Set(["CHECKED_IN"]);
/** Statuses that allow cancellation. */
const CANCEL_ALLOWED = new Set(["PENDING", "CONFIRMED", "WAITLISTED"]);

@Component({
	selector: "app-reservation-detail",
	standalone: true,
	imports: [NgClass, RouterLink, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
	templateUrl: "./reservation-detail.html",
	styleUrl: "./reservation-detail.scss",
})
export class ReservationDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly reservation = signal<ReservationDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	/* ── Action state ── */
	readonly actionLoading = signal(false);
	readonly actionSuccess = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);
	readonly confirmingCheckIn = signal(false);
	readonly confirmingCheckOut = signal(false);
	readonly confirmingCancel = signal(false);

	/* ── Room selection for check-in ── */
	readonly availableRooms = signal<AvailableRoom[]>([]);
	readonly loadingRooms = signal(false);
	readonly selectedRoomId = signal<string | null>(null);
	readonly useAutoAssign = signal(true);

	statusClass = reservationStatusClass;

	/** Whether the current reservation can be checked in. */
	readonly canCheckIn = computed(() => {
		const r = this.reservation();
		return r ? CHECKIN_ALLOWED.has(r.status.toUpperCase()) : false;
	});

	/** Whether the current reservation can be checked out. */
	readonly canCheckOut = computed(() => {
		const r = this.reservation();
		return r ? CHECKOUT_ALLOWED.has(r.status.toUpperCase()) : false;
	});

	/** Whether the current reservation can be cancelled. */
	readonly canCancel = computed(() => {
		const r = this.reservation();
		return r ? CANCEL_ALLOWED.has(r.status.toUpperCase()) : false;
	});

	readonly bookingRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		return [
			{ label: "Confirmation #", value: r.confirmation_number },
			{
				label: "Status",
				value: r.status_display,
				badge: this.statusClass(r.status),
			},
			{ label: "Check-in", value: this.formatDate(r.check_in_date) },
			{ label: "Check-out", value: this.formatDate(r.check_out_date) },
			{ label: "Nights", value: String(r.nights) },
			{ label: "Room Type", value: r.room_type_name ?? "—" },
			{ label: "Room", value: r.room_number ?? "Not assigned" },
			{ label: "Source", value: r.source ?? "—" },
			{ label: "Type", value: r.reservation_type ?? "—" },
		];
	});

	readonly guestRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		return [
			{ label: "Guest Name", value: r.guest_name ?? "—" },
			{ label: "Email", value: r.guest_email ?? "—" },
			{ label: "Phone", value: r.guest_phone ?? "—" },
		];
	});

	readonly financialRows = computed<DetailRow[]>(() => {
		const r = this.reservation();
		if (!r) return [];
		const fmt = (n: number) => this.formatCurrency(n, r.currency);
		return [
			{ label: "Room Rate", value: fmt(r.room_rate) },
			{ label: "Total Amount", value: fmt(r.total_amount) },
			{ label: "Tax", value: fmt(r.tax_amount) },
			{ label: "Discount", value: fmt(r.discount_amount) },
			{ label: "Paid", value: fmt(r.paid_amount) },
			{
				label: "Balance Due",
				value: fmt(r.balance_due),
				badge: r.balance_due > 0 ? "badge-warning" : "badge-success",
			},
		];
	});

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get("reservationId");
		if (id) {
			this.loadReservation(id);
		}
	}

	async loadReservation(id: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const res = await this.api.get<ReservationDetail>(`/reservations/${id}`, {
				tenant_id: tenantId,
			});
			this.reservation.set(res);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load reservation");
		} finally {
			this.loading.set(false);
		}
	}

	goBack(): void {
		this.router.navigate(["/reservations"]);
	}

	/* ── Action confirmations ── */

	showCheckInConfirm(): void {
		this.clearActionState();
		this.confirmingCheckIn.set(true);
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
		this.loadAvailableRooms();
	}

	showCheckOutConfirm(): void {
		this.clearActionState();
		this.confirmingCheckOut.set(true);
	}

	showCancelConfirm(): void {
		this.clearActionState();
		this.confirmingCancel.set(true);
	}

	cancelAction(): void {
		this.confirmingCheckIn.set(false);
		this.confirmingCheckOut.set(false);
		this.confirmingCancel.set(false);
	}

	/** Load available rooms matching the reservation's room type for manual selection. */
	private async loadAvailableRooms(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.loadingRooms.set(true);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: r.property_id,
				check_in_date: r.check_in_date.substring(0, 10),
				check_out_date: r.check_out_date.substring(0, 10),
			};
			if (r.room_type_id) params["room_type_id"] = r.room_type_id;

			const res = await this.api.get<AvailabilityResponse>("/rooms/availability", params);
			this.availableRooms.set(res.available_rooms ?? []);
		} catch {
			this.availableRooms.set([]);
		} finally {
			this.loadingRooms.set(false);
		}
	}

	selectRoom(roomId: string): void {
		this.selectedRoomId.set(roomId);
		this.useAutoAssign.set(false);
	}

	selectAutoAssign(): void {
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
	}

	/**
	 * PMS industry-standard check-in:
	 * 1. Validates reservation status (PENDING/CONFIRMED)
	 * 2. Assigns selected room or auto-assigns best available
	 * 3. Marks room OCCUPIED, reservation CHECKED_IN
	 */
	async checkIn(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			const body: Record<string, unknown> = {};
			const roomId = this.selectedRoomId();
			if (roomId) body["room_id"] = roomId;

			await this.api.post(`/tenants/${tenantId}/reservations/${r.id}/check-in`, body);

			const roomLabel = roomId
				? (this.availableRooms().find((rm) => rm.room_id === roomId)?.room_number ??
					"selected room")
				: "auto-assigned room";
			this.actionSuccess.set(`Guest checked in successfully. Room: ${roomLabel}.`);
			this.confirmingCheckIn.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.actionError.set(e instanceof Error ? e.message : "Check-in failed");
		} finally {
			this.actionLoading.set(false);
		}
	}

	async checkOut(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			await this.api.post(`/tenants/${tenantId}/reservations/${r.id}/check-out`, {});
			this.actionSuccess.set("Guest checked out. Room status set to Vacant Dirty.");
			this.confirmingCheckOut.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.actionError.set(e instanceof Error ? e.message : "Check-out failed");
		} finally {
			this.actionLoading.set(false);
		}
	}

	async cancelReservation(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			await this.api.post(`/tenants/${tenantId}/reservations/${r.id}/cancel`, {});
			this.actionSuccess.set("Reservation cancelled.");
			this.confirmingCancel.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.actionError.set(e instanceof Error ? e.message : "Cancellation failed");
		} finally {
			this.actionLoading.set(false);
		}
	}

	private clearActionState(): void {
		this.actionSuccess.set(null);
		this.actionError.set(null);
		this.confirmingCheckIn.set(false);
		this.confirmingCheckOut.set(false);
		this.confirmingCancel.set(false);
	}

	/**
	 * Commands are async (Kafka). Poll the reservation until the status
	 * reflects the change, so the UI updates without a manual refresh.
	 */
	private async pollUntilStatusChanged(id: string, previousStatus: string): Promise<void> {
		for (let i = 0; i < 8; i++) {
			await new Promise((r) => setTimeout(r, 800));
			await this.loadReservation(id);
			const current = this.reservation();
			if (current && current.status !== previousStatus) return;
		}
	}

	formatDate = formatLongDate;
	formatCurrency = formatCurrency;
}
