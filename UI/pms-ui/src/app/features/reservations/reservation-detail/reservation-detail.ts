import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type {
	AvailabilityResponse,
	AvailableRoom,
	GuestWithStats,
	ReservationDetail,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { reservationStatusClass } from "../../../shared/badge-utils";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { ToastService } from "../../../shared/toast/toast.service";

type DetailRow = { label: string; value: string; badge?: string; icon?: string; hint?: string };

/** Statuses that allow front-desk check-in per PMS industry standard. */
const CHECKIN_ALLOWED = new Set(["PENDING", "CONFIRMED"]);
/** Statuses that allow check-out. */
const CHECKOUT_ALLOWED = new Set(["CHECKED_IN"]);
/** Statuses that allow cancellation. */
const CANCEL_ALLOWED = new Set(["PENDING", "CONFIRMED", "WAITLISTED"]);

@Component({
	selector: "app-reservation-detail",
	standalone: true,
	imports: [
		NgClass,
		RouterLink,
		MatIconModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
	],
	templateUrl: "./reservation-detail.html",
	styleUrl: "./reservation-detail.scss",
})
export class ReservationDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly reservation = signal<ReservationDetail | null>(null);
	readonly guestProfile = signal<GuestWithStats | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	/* ── Action state ── */
	readonly actionLoading = signal(false);
	readonly actionSuccess = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);
	readonly confirmingCheckIn = signal(false);
	readonly confirmingCheckOut = signal(false);
	readonly confirmingCancel = signal(false);
	readonly confirmingExpressCheckout = signal(false);
	readonly folioBalance = signal<{ total_charges: number; total_payments: number; balance: number } | null>(null);
	readonly loadingFolioBalance = signal(false);

	/* ── Room selection for check-in ── */
	readonly availableRooms = signal<AvailableRoom[]>([]);
	readonly loadingRooms = signal(false);
	readonly roomLoadError = signal<string | null>(null);
	readonly selectedRoomId = signal<string | null>(null);
	readonly useAutoAssign = signal(true);
	readonly roomPage = signal(1);
	readonly roomPageSize = 5;
	readonly buildings = signal<{ building_id: string; building_name: string }[]>([]);
	readonly buildingFilter = signal("");
	readonly showAllRoomTypes = signal(false);

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
		const p = this.guestProfile();
		if (!r) return [];

		const rows: DetailRow[] = [
			{ label: "Guest Name", value: r.guest_name ?? "—" },
			{ label: "Email", value: r.guest_email ?? "—" },
			{ label: "Phone", value: (p?.phone ?? r.guest_phone) || "—" },
		];

		if (p) {
			// Customer type from vip_status
			const vip = p.vip_status;
			const customerType =
				vip === "NONE"
					? "Standard"
					: vip === "VVIP"
						? "VVIP"
						: `VIP Level ${vip.replace("VIP", "")}`;
			rows.push({ label: "Customer Type", value: customerType });

			if (p.loyalty_tier) {
				rows.push({ label: "Loyalty Tier", value: p.loyalty_tier });
			}

			// Date of birth with birthday proximity indicator
			if (p.date_of_birth) {
				const dob =
					p.date_of_birth instanceof Date
						? p.date_of_birth
						: new Date(p.date_of_birth as unknown as string);
				const dobDisplay = dob.toLocaleDateString(this.settings.locale() || "en-US", {
					month: "long",
					day: "numeric",
					year: "numeric",
				});
				const diff = this.birthdayDaysOffset(dob);
				let icon: string | undefined;
				let hint: string | undefined;
				if (diff === 0) {
					icon = "cake";
					hint = "Birthday today!";
				} else if (diff > 0 && diff <= 5) {
					icon = "cake";
					hint = `Birthday in ${diff} day${diff === 1 ? "" : "s"}`;
				} else if (diff < 0 && diff >= -5) {
					icon = "cake";
					hint = `Birthday was ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;
				}
				rows.push({ label: "Date of Birth", value: dobDisplay, icon, hint });
			}

			// Lifetime revenue from that guest
			const revenue = p.lifetime_value ?? p.total_revenue;
			if (revenue != null) {
				rows.push({
					label: "Lifetime Revenue",
					value: this.formatCurrency(Number(revenue), r.currency ?? "USD"),
				});
			}
		}

		return rows;
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
			if (res.guest_id) {
				void this.loadGuestProfile(res.guest_id);
			}
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load reservation");
		} finally {
			this.loading.set(false);
		}
	}

	goBack(): void {
		this.router.navigate(["/reservations"]);
	}

	/** Fetch the full guest profile to enrich the guest info panel. Non-critical — silently degrades on failure. */
	private async loadGuestProfile(guestId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const profile = await this.api.get<GuestWithStats>(`/guests/${guestId}`, {
				tenant_id: tenantId,
			});
			this.guestProfile.set(profile);
		} catch {
			// Non-critical — guest enrichment failure gracefully degrades to reservation-only data
		}
	}

	/**
	 * Returns the number of days from today until the guest's next (or most recent past) birthday.
	 * Negative = birthday was N days ago. Positive = birthday is in N days. 0 = today.
	 */
	private birthdayDaysOffset(dob: Date): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const thisBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
		const diff = Math.round((thisBirthday.getTime() - today.getTime()) / 86_400_000);
		if (diff < -5) {
			const nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
			return Math.round((nextBirthday.getTime() - today.getTime()) / 86_400_000);
		}
		return diff;
	}

	/* ── Action confirmations ── */

	showCheckInConfirm(): void {
		this.clearActionState();
		this.confirmingCheckIn.set(true);
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
		this.roomPage.set(1);
		this.buildingFilter.set("");
		this.showAllRoomTypes.set(false);
		this.buildings.set([]);
		void this.loadBuildings();
		this.loadAvailableRooms();
	}

	showCheckOutConfirm(): void {
		this.clearActionState();
		this.confirmingCheckOut.set(true);
	}

	showExpressCheckout(): void {
		this.clearActionState();
		this.confirmingExpressCheckout.set(true);
		void this.loadFolioBalance();
	}

	private async loadFolioBalance(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;
		this.loadingFolioBalance.set(true);
		try {
			const res = await this.api.get<{ data: { total_charges: number; total_payments: number; balance: number }[] }>(
				"/billing/folios",
				{ tenant_id: tenantId, reservation_id: r.id, limit: "1" },
			);
			const folio = res.data?.[0] ?? null;
			this.folioBalance.set(folio);
		} catch {
			this.folioBalance.set(null);
		} finally {
			this.loadingFolioBalance.set(false);
		}
	}

	showCancelConfirm(): void {
		this.clearActionState();
		this.confirmingCancel.set(true);
	}

	cancelAction(): void {
		this.confirmingCheckIn.set(false);
		this.showAllRoomTypes.set(false);
		this.confirmingCheckOut.set(false);
		this.confirmingCancel.set(false);
		this.confirmingExpressCheckout.set(false);
	}

	/** Load available rooms matching the reservation's room type for manual selection. */
	private async loadAvailableRooms(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.loadingRooms.set(true);
		this.roomLoadError.set(null);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: r.property_id,
				check_in_date: r.check_in_date.substring(0, 10),
				check_out_date: r.check_out_date.substring(0, 10),
				reservation_id: r.id,
			};
			if (r.room_type_id && !this.showAllRoomTypes()) params["room_type_id"] = r.room_type_id;
			if (this.buildingFilter()) params["building_id"] = this.buildingFilter();

			const res = await this.api.get<AvailabilityResponse>("/rooms/availability", params);
			this.availableRooms.set(res.available_rooms ?? []);
		} catch (e) {
			this.availableRooms.set([]);
			this.roomLoadError.set(e instanceof Error ? e.message : "Failed to load rooms");
		} finally {
			this.loadingRooms.set(false);
		}
	}

	/** Load buildings list for the current property (used as filter in check-in panel). */
	private async loadBuildings(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const r = this.reservation();
		if (!tenantId || !r) return;
		try {
			const data = await this.api.get<{ building_id: string; building_name: string }[]>(
				"/buildings",
				{ tenant_id: tenantId, property_id: r.property_id },
			);
			this.buildings.set(data ?? []);
		} catch {
			this.buildings.set([]);
		}
	}

	/** Apply building filter and reload available rooms. */
	filterByBuilding(buildingId: string): void {
		this.buildingFilter.set(buildingId);
		this.roomPage.set(1);
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
		void this.loadAvailableRooms();
	}

	toggleShowAllRoomTypes(): void {
		this.showAllRoomTypes.update((v) => !v);
		this.roomPage.set(1);
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
		void this.loadAvailableRooms();
	}

	selectRoom(roomId: string): void {
		this.selectedRoomId.set(roomId);
		this.useAutoAssign.set(false);
	}

	selectAutoAssign(): void {
		this.selectedRoomId.set(null);
		this.useAutoAssign.set(true);
	}

	paginatedRooms(): AvailableRoom[] {
		const all = this.availableRooms();
		const start = (this.roomPage() - 1) * this.roomPageSize;
		return all.slice(start, start + this.roomPageSize);
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
			this.toast.success(`Guest checked in successfully. Room: ${roomLabel}.`);
			this.confirmingCheckIn.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Check-in failed");
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
			this.toast.success("Guest checked out. Room status set to Vacant Dirty.");
			this.confirmingCheckOut.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Check-out failed");
		} finally {
			this.actionLoading.set(false);
		}
	}

	async expressCheckout(): Promise<void> {
		const r = this.reservation();
		const tenantId = this.auth.tenantId();
		if (!r || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.express_checkout`, {
				reservation_id: r.id,
				property_id: r.property_id,
			});
			this.toast.success("Express checkout completed. Folio closed and room released.");
			this.confirmingExpressCheckout.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Express checkout failed");
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
			this.toast.success("Reservation cancelled.");
			this.confirmingCancel.set(false);
			await this.pollUntilStatusChanged(r.id, r.status);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Cancellation failed");
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
		this.confirmingExpressCheckout.set(false);
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

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}
}
