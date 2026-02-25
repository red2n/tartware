import { Component, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router } from "@angular/router";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { formatCurrency } from "../../../shared/format-utils";

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
};

@Component({
	selector: "app-create-reservation",
	standalone: true,
	imports: [
		FormsModule,
		MatIconModule,
		MatProgressSpinnerModule,
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

	readonly roomTypes = signal<RoomType[]>([]);
	readonly allRates = signal<RateDetail[]>([]);
	readonly guests = signal<GuestOption[]>([]);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly loadingRef = signal(false);

	touched: Record<string, boolean> = {};

	// Step 1: Dates & Room Type
	checkInDate = "";
	checkOutDate = "";
	roomTypeId = "";

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
		const q = this.guestSearch.toLowerCase().trim();
		if (!q) return this.guests();
		return this.guests().filter(
			(g) =>
				g.first_name.toLowerCase().includes(q) ||
				g.last_name.toLowerCase().includes(q) ||
				g.email?.toLowerCase().includes(q),
		);
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
		return rate.base_rate * this.nights;
	}

	/** Step completion guards */
	get datesComplete(): boolean {
		return !!(this.checkInDate && this.checkOutDate && this.nights > 0 && this.roomTypeId);
	}

	get rateComplete(): boolean {
		return !!this.selectedRateCode;
	}

	get guestComplete(): boolean {
		return !!this.guestId;
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
			this.error.set("Failed to load reference data");
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
	}

	selectGuest(g: GuestOption): void {
		this.guestId = g.id;
	}

	guestDisplayName(g: GuestOption): string {
		return `${g.first_name} ${g.last_name}`;
	}

	fmtCurrency(amount: number, currency: string): string {
		return formatCurrency(amount, currency);
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
			this.error.set("No property selected");
			return;
		}

		this.saving.set(true);
		this.error.set(null);

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
			this.router.navigate(["/reservations"]);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.error.set(e instanceof Error ? e.message : "Failed to create reservation");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.router.navigate(["/reservations"]);
	}

	private toDateString(d: Date): string {
		return d.toISOString().split("T")[0];
	}
}
