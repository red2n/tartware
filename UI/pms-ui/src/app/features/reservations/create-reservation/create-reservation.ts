import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { ToastService } from "../../../shared/toast/toast.service";

type RoomType = {
	room_type_id: string;
	type_name: string;
	type_code: string;
	category: string;
	base_price: number;
	base_occupancy: number;
	max_occupancy: number;
	bed_type: string;
	number_of_beds: number;
	size_sqm?: number;
	currency: string;
	is_active: boolean;
};

type RateDetail = {
	id: string;
	rate_code: string;
	rate_name: string;
	rate_type: string;
	base_rate: number;
	single_occupancy_rate: number;
	double_occupancy_rate: number;
	extra_person_rate: number;
	room_type_id: string;
	valid_from: string;
	status: string;
	currency: string;
	meal_plan: string;
	min_length_of_stay: number;
	cancellation_policy: { type: string; hours: number; penalty: number };
};

type GuestOption = {
	id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	date_of_birth?: string | Date;
	vip_status?: string;
	loyalty_tier?: string;
	total_revenue?: number;
	lifetime_value?: number;
	created_at?: string;
};

import type { RoomRecommendationResponse } from "@tartware/schemas";

/** Aggregated recommendation stats per room type */
type RoomTypeRecommendation = {
	roomTypeId: string;
	avgScore: number;
	roomCount: number;
	hasUpgrade: boolean;
	bestScore: number;
};

@Component({
	selector: "app-create-reservation",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
		TranslatePipe,
	],
	templateUrl: "./create-reservation.html",
	styleUrl: "./create-reservation.scss",
})
export class CreateReservationComponent implements OnInit {
	currentStep = 0;
	readonly steps = ["Stay Details", "Select Rate", "Guest & Booking", "Confirm"];

	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	// ── Settings-driven signals ───────────────────────────────────────────────
	/** Whether the guest's phone number is required before confirming. */
	readonly requirePhone = computed(() => this.settings.getBool("booking.require_phone", false));
	/** Furthest future check-in date the booking engine allows, in days from today. */
	readonly maxAdvanceDays = computed(() =>
		this.settings.getNumber("booking.max_advance_days", 365),
	);
	/** Minimum lead time in hours before check-in. */
	readonly minAdvanceHours = computed(() =>
		this.settings.getNumber("booking.min_advance_hours", 0),
	);
	/** Free cancellation window in hours before arrival. */
	readonly freeCancelHours = computed(() =>
		this.settings.getNumber("booking.free_cancel_hours", 24),
	);
	/** Percentage of total booking charged for a no-show. */
	readonly noShowChargePercent = computed(() =>
		this.settings.getNumber("booking.no_show_charge_percent", 100),
	);
	/** Booking cutoff time (e.g. "18:00" — last time a same-day booking is accepted). */
	readonly cutoffTime = computed(() =>
		this.settings.formatTime(this.settings.getString("booking.cutoff_time", "18:00")),
	);
	/** Whether guests are automatically enrolled in the loyalty program on booking. */
	readonly autoEnrollLoyalty = computed(() =>
		this.settings.getBool("booking.auto_enroll_loyalty", false),
	);

	/** Earliest allowed check-in: today + floor(minAdvanceHours/24) days. */
	readonly minCheckInDate = computed(() => {
		const d = new Date();
		const advanceDays = Math.floor(this.minAdvanceHours() / 24);
		if (advanceDays > 0) d.setDate(d.getDate() + advanceDays);
		return this.toDateString(d);
	});

	/** Latest allowed check-in date based on max advance booking days setting. */
	readonly maxCheckInDate = computed(() => {
		const d = new Date();
		d.setDate(d.getDate() + this.maxAdvanceDays());
		return this.toDateString(d);
	});

	readonly roomTypes = signal<RoomType[]>([]);
	readonly allRates = signal<RateDetail[]>([]);
	readonly guests = signal<GuestOption[]>([]);
	readonly calendarRates = signal<Map<string, number>>(new Map());
	readonly saving = signal(false);
	readonly loadingRef = signal(false);
	readonly guestPage = signal(1);
	readonly guestPageSize = 5;

	// Recommendation engine state
	readonly recommendations = signal<Map<string, RoomTypeRecommendation>>(new Map());
	readonly loadingRecs = signal(false);
	readonly hasRecommendations = computed(() => this.recommendations().size > 0);

	/** Monotonically increasing counter to discard stale recommendation responses. */
	private recRequestSeq = 0;

	/** Monotonically increasing counter to discard stale calendar rate responses. */
	private calRateSeq = 0;

	/** Room types sorted: recommended first (by best score desc), then the rest. */
	readonly sortedRoomTypes = computed(() => {
		const recs = this.recommendations();
		const types = this.roomTypes();
		if (recs.size === 0) return types;
		return [...types].sort((a, b) => {
			const ra = recs.get(a.room_type_id);
			const rb = recs.get(b.room_type_id);
			if (ra && !rb) return -1;
			if (!ra && rb) return 1;
			if (ra && rb) return rb.bestScore - ra.bestScore;
			return 0;
		});
	});

	touched: Record<string, boolean> = {};

	// Step 1: Dates & Room Type
	checkInDate = "";
	checkOutDate = "";
	roomTypeId = "";

	/** Today's date as YYYY-MM-DD — used as a floor for minCheckOut. */
	readonly todayStr = this.toDateString(new Date());

	/** Earliest allowed check-out: day after the selected check-in date. */
	get minCheckOut(): string {
		if (!this.checkInDate) return this.minCheckInDate();
		const d = new Date(`${this.checkInDate}T00:00:00`);
		d.setDate(d.getDate() + 1);
		return this.toDateString(d);
	}

	/** When check-in changes, auto-correct check-out if it's now invalid, then refresh recommendations. */
	onCheckInChange(): void {
		if (this.checkOutDate && this.checkOutDate <= this.checkInDate) {
			this.checkOutDate = this.minCheckOut;
		}
		this.fetchRecommendations();
		this.fetchCalendarRates();
	}

	/** When check-out changes, refresh recommendations. */
	onCheckOutChange(): void {
		this.fetchRecommendations();
		this.fetchCalendarRates();
	}

	// Step 2: Rate selection
	selectedRateCode = "";

	// Step 3: Guest & Details
	guestId = "";
	guestSearch = "";
	source = "DIRECT";
	reservationType = "TRANSIENT";
	notes = "";

	readonly sources = [
		{ value: "DIRECT", label: "Direct" },
		{ value: "WEBSITE", label: "Website" },
		{ value: "PHONE", label: "Phone" },
		{ value: "WALKIN", label: "Walk-in" },
		{ value: "OTA", label: "OTA" },
		{ value: "CORPORATE", label: "Corporate" },
	];

	readonly reservationTypes = [
		{ value: "TRANSIENT", label: "Transient" },
		{ value: "CORPORATE", label: "Corporate" },
		{ value: "GROUP", label: "Group" },
		{ value: "PACKAGE", label: "Package" },
		{ value: "COMPLIMENTARY", label: "Complimentary" },
		{ value: "DAY_USE", label: "Day Use" },
	];

	/** Rates filtered to selected room type + active status */
	availableRates(): RateDetail[] {
		if (!this.roomTypeId) return [];
		return this.allRates().filter(
			(r) => r.room_type_id === this.roomTypeId && r.status === "ACTIVE",
		);
	}

	/** Guests filtered by search term */
	filteredGuests(): GuestOption[] {
		const sorted = [...this.guests()].sort((a, b) => {
			const da = a.created_at ? new Date(a.created_at).getTime() : 0;
			const db = b.created_at ? new Date(b.created_at).getTime() : 0;
			return db - da;
		});
		const q = this.guestSearch.toLowerCase().trim();
		if (!q) return sorted;
		return sorted.filter(
			(g) =>
				g.first_name.toLowerCase().includes(q) ||
				g.last_name.toLowerCase().includes(q) ||
				g.email?.toLowerCase().includes(q),
		);
	}

	paginatedGuests(): GuestOption[] {
		const all = this.filteredGuests();
		const start = (this.guestPage() - 1) * this.guestPageSize;
		return all.slice(start, start + this.guestPageSize);
	}

	onGuestSearch(): void {
		this.guestPage.set(1);
	}

	get selectedRoomType(): RoomType | undefined {
		return this.roomTypes().find((rt) => rt.room_type_id === this.roomTypeId);
	}

	get selectedRate(): RateDetail | undefined {
		return this.allRates().find((r) => r.rate_code === this.selectedRateCode);
	}

	get selectedGuest(): GuestOption | undefined {
		return this.guests().find((g) => g.id === this.guestId);
	}

	get nights(): number {
		if (!this.checkInDate || !this.checkOutDate) return 0;
		const ci = new Date(this.checkInDate);
		const co = new Date(this.checkOutDate);
		const diff = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : 0;
	}

	get totalAmount(): number {
		const rate = this.selectedRate;
		if (!rate || this.nights <= 0) return 0;
		const calRates = this.calendarRates();
		if (calRates.size === 0) return rate.base_rate * this.nights;

		let total = 0;
		const ci = new Date(`${this.checkInDate}T00:00:00`);
		for (let i = 0; i < this.nights; i++) {
			const d = new Date(ci);
			d.setDate(ci.getDate() + i);
			const key = this.toDateString(d);
			total += calRates.get(key) ?? rate.base_rate;
		}
		return total;
	}

	/** Step completion guards */
	get datesComplete(): boolean {
		return !!(this.checkInDate && this.checkOutDate && this.nights > 0 && this.roomTypeId);
	}

	get rateComplete(): boolean {
		return !!this.selectedRateCode;
	}

	get guestComplete(): boolean {
		if (!this.guestId) return false;
		// If phone is required by settings, the selected guest must have a phone number
		if (this.requirePhone() && !this.selectedGuest?.phone) return false;
		return true;
	}

	nextStep(): void {
		if (this.currentStep < this.steps.length - 1) this.currentStep++;
	}

	prevStep(): void {
		if (this.currentStep > 0) this.currentStep--;
	}

	goToStep(index: number): void {
		if (index <= this.completedUpTo() + 1) this.currentStep = index;
	}

	/** Highest completed step index (for enabling tab clicks) */
	completedUpTo(): number {
		if (this.guestComplete) return 2;
		if (this.rateComplete) return 1;
		if (this.datesComplete) return 0;
		return -1;
	}

	ngOnInit(): void {
		this.loadReferenceData();
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		this.checkInDate = this.toDateString(today);
		this.checkOutDate = this.toDateString(tomorrow);
		this.fetchRecommendations();
	}

	/** Fetch recommendations from the recommendation engine and aggregate by room type. */
	async fetchRecommendations(): Promise<void> {
		if (!this.checkInDate || !this.checkOutDate || this.nights <= 0) {
			this.recommendations.set(new Map());
			return;
		}

		const propertyId = this.ctx.propertyId();
		const tenantId = this.auth.tenantId();
		if (!propertyId || !tenantId) return;

		const seq = ++this.recRequestSeq;
		this.loadingRecs.set(true);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				propertyId,
				checkInDate: this.checkInDate,
				checkOutDate: this.checkOutDate,
				limit: "50",
			};

			const resp = await this.api.get<RoomRecommendationResponse>("/recommendations", params);

			// Discard stale response if a newer request was fired while awaiting
			if (seq !== this.recRequestSeq) return;

			// Aggregate recommendations by room type
			const byType = new Map<string, RoomTypeRecommendation>();
			for (const rec of resp.recommendations) {
				const existing = byType.get(rec.roomTypeId);
				if (existing) {
					existing.roomCount++;
					existing.avgScore =
						(existing.avgScore * (existing.roomCount - 1) + rec.relevanceScore) /
						existing.roomCount;
					existing.bestScore = Math.max(existing.bestScore, rec.relevanceScore);
					existing.hasUpgrade = existing.hasUpgrade || (rec.isUpgrade ?? false);
				} else {
					byType.set(rec.roomTypeId, {
						roomTypeId: rec.roomTypeId,
						avgScore: rec.relevanceScore,
						roomCount: 1,
						hasUpgrade: rec.isUpgrade ?? false,
						bestScore: rec.relevanceScore,
					});
				}
			}
			this.recommendations.set(byType);
		} catch {
			// Non-blocking — recommendations are a bonus, not a requirement
			if (seq === this.recRequestSeq) this.recommendations.set(new Map());
		} finally {
			if (seq === this.recRequestSeq) this.loadingRecs.set(false);
		}
	}

	/** Fetch rate calendar overrides for the selected rate + date range. */
	async fetchCalendarRates(): Promise<void> {
		const rate = this.selectedRate;
		if (!rate || !this.checkInDate || !this.checkOutDate || this.nights <= 0) {
			this.calendarRates.set(new Map());
			return;
		}
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const seq = ++this.calRateSeq;

		try {
			// end_date is exclusive (last night = checkOut - 1 day)
			const lastNight = new Date(`${this.checkOutDate}T00:00:00`);
			lastNight.setDate(lastNight.getDate() - 1);
			const endDate = this.toDateString(lastNight);

			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: propertyId,
				start_date: this.checkInDate,
				end_date: endDate,
				rate_id: rate.id,
			};
			if (this.roomTypeId) {
				params["room_type_id"] = this.roomTypeId;
			}
			const entries = await this.api.get<{ stay_date: string; rate_amount: number }[]>(
				"/rate-calendar",
				params,
			);
			if (seq !== this.calRateSeq) return;
			const map = new Map<string, number>();
			if (Array.isArray(entries)) {
				for (const e of entries) {
					map.set(e.stay_date.slice(0, 10), e.rate_amount);
				}
			}
			this.calendarRates.set(map);
		} catch {
			// Non-blocking — fall back to base_rate pricing
			if (seq === this.calRateSeq) this.calendarRates.set(new Map());
		}
	}

	/** Get recommendation data for a room type (if available). */
	recForType(roomTypeId: string): RoomTypeRecommendation | undefined {
		return this.recommendations().get(roomTypeId);
	}

	/** Format score as percentage. */
	recScorePercent(score: number): number {
		return Math.round(score * 100);
	}

	/** CSS class for recommendation score tier. */
	recScoreClass(score: number): string {
		const pct = this.recScorePercent(score);
		if (pct >= 80) return "rec-score-high";
		if (pct >= 50) return "rec-score-medium";
		return "rec-score-low";
	}

	async loadReferenceData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loadingRef.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const [roomTypes, guests, rates] = await Promise.all([
				this.api.get<RoomType[]>("/room-types", params),
				this.api.get<GuestOption[]>("/guests", { tenant_id: tenantId, limit: "100" }),
				this.api.get<RateDetail[]>("/rates", params),
			]);
			this.roomTypes.set(Array.isArray(roomTypes) ? roomTypes : []);
			this.guests.set(
				Array.isArray(guests) ? guests : ((guests as { data: GuestOption[] }).data ?? []),
			);
			this.allRates.set(Array.isArray(rates) ? rates : []);
		} catch {
			this.toast.error("Failed to load reference data");
		} finally {
			this.loadingRef.set(false);
		}
	}

	/** When room type changes, reset rate selection */
	onRoomTypeSelect(id: string): void {
		this.roomTypeId = id;
		this.selectedRateCode = "";
	}

	selectRate(rate: RateDetail): void {
		this.selectedRateCode = rate.rate_code;
		this.fetchCalendarRates();
	}

	selectGuest(g: GuestOption): void {
		this.guestId = g.id;
	}

	/** Derive human-readable customer type from vip_status. */
	guestCustomerType(g: GuestOption): string | null {
		const v = g.vip_status;
		if (!v || v === "NONE") return null;
		if (v === "VVIP") return "VVIP";
		return `VIP${v.replace("VIP", "")}`;
	}

	/** Birthday offset in days relative to today (negative = ago, 0 = today, positive = upcoming). */
	guestBirthdayOffset(g: GuestOption): number | null {
		if (!g.date_of_birth) return null;
		const dob = g.date_of_birth instanceof Date ? g.date_of_birth : new Date(g.date_of_birth);
		if (Number.isNaN(dob.getTime())) return null;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const thisBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
		const diff = Math.round((thisBday.getTime() - today.getTime()) / 86_400_000);
		if (diff < -5) {
			const nextBday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
			return Math.round((nextBday.getTime() - today.getTime()) / 86_400_000);
		}
		return diff;
	}

	/** Label to show for ±5-day birthday proximity. */
	guestBirthdayHint(g: GuestOption): string | null {
		const d = this.guestBirthdayOffset(g);
		if (d === null) return null;
		if (d === 0) return "🎂 Birthday today!";
		if (d > 0 && d <= 5) return `🎂 Birthday in ${d}d`;
		if (d < 0 && d >= -5) return `🎂 Birthday ${Math.abs(d)}d ago`;
		return null;
	}

	/** Format guest DOB for display (e.g. "Apr 5, 1990"). */
	guestDobDisplay(g: GuestOption): string | null {
		if (!g.date_of_birth) return null;
		const dob = g.date_of_birth instanceof Date ? g.date_of_birth : new Date(g.date_of_birth);
		if (Number.isNaN(dob.getTime())) return null;
		return dob.toLocaleDateString(this.settings.locale() || "en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	guestDisplayName(g: GuestOption): string {
		return `${g.first_name} ${g.last_name}`;
	}

	fmtCurrency(amount: number, currency: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	fmtDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}

	mealPlanLabel(code: string): string {
		const labels: Record<string, string> = {
			RO: "Room Only",
			BB: "Bed & Breakfast",
			HB: "Half Board",
			FB: "Full Board",
			AI: "All Inclusive",
		};
		return labels[code] || code;
	}

	cancellationLabel(policy: { type: string; hours: number }): string {
		if (policy.type === "non_refundable") return "Non-refundable";
		return `Free cancellation up to ${policy.hours}h before`;
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	async save(): Promise<void> {
		if (!this.selectedRate || !this.guestId || !this.roomTypeId) return;
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) {
			this.toast.error("No property selected");
			return;
		}

		this.saving.set(true);

		try {
			await this.api.post(`/tenants/${tenantId}/reservations`, {
				property_id: propertyId,
				guest_id: this.guestId,
				room_type_id: this.roomTypeId,
				check_in_date: this.checkInDate,
				check_out_date: this.checkOutDate,
				total_amount: this.totalAmount,
				rate_code: this.selectedRateCode,
				source: this.source,
				reservation_type: this.reservationType,
				notes: this.notes.trim() || undefined,
			});
			this.toast.success("Reservation created successfully.");
			this.router.navigate(["/reservations"]);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.toast.error(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.toast.error(e instanceof Error ? e.message : "Failed to create reservation");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.router.navigate(["/reservations"]);
	}

	private toDateString(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
