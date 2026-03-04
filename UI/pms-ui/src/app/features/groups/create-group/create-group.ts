import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router, RouterLink } from "@angular/router";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-create-group",
	standalone: true,
	imports: [FormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
	templateUrl: "./create-group.html",
	styleUrl: "./create-group.scss",
})
export class CreateGroupComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	touched: Record<string, boolean> = {};

	/* ── Group Details ── */
	groupName = "";
	groupType = "conference";
	organizationName = "";
	blockStatus = "tentative";

	/* ── Stay Dates ── */
	arrivalDate = "";
	departureDate = "";
	totalRoomsRequested = 1;
	cutoffDate = "";

	/* ── Contact ── */
	contactName = "";
	contactEmail = "";
	contactPhone = "";

	/* ── Financial (optional) ── */
	rateType = "";
	negotiatedRate: number | null = null;
	paymentMethod = "";
	depositAmount: number | null = null;

	/* ── Additional ── */
	meetingSpaceRequired = false;
	cateringRequired = false;
	notes = "";

	readonly groupTypes = [
		{ value: "conference", label: "Conference" },
		{ value: "wedding", label: "Wedding" },
		{ value: "corporate", label: "Corporate" },
		{ value: "tour_group", label: "Tour Group" },
		{ value: "sports_team", label: "Sports Team" },
		{ value: "reunion", label: "Reunion" },
		{ value: "convention", label: "Convention" },
		{ value: "government", label: "Government" },
		{ value: "airline_crew", label: "Airline Crew" },
		{ value: "educational", label: "Educational" },
		{ value: "other", label: "Other" },
	];

	readonly blockStatuses = [
		{ value: "inquiry", label: "Inquiry" },
		{ value: "tentative", label: "Tentative" },
		{ value: "definite", label: "Definite" },
	];

	readonly rateTypes = [
		{ value: "", label: "— Select —" },
		{ value: "group_rate", label: "Group Rate" },
		{ value: "negotiated", label: "Negotiated" },
		{ value: "contracted", label: "Contracted" },
		{ value: "special", label: "Special" },
		{ value: "rack", label: "Rack Rate" },
	];

	readonly paymentMethods = [
		{ value: "", label: "— Select —" },
		{ value: "direct_bill", label: "Direct Bill" },
		{ value: "credit_card", label: "Credit Card" },
		{ value: "deposit", label: "Deposit" },
		{ value: "prepaid", label: "Prepaid" },
		{ value: "individual_pay", label: "Individual Pay" },
		{ value: "mixed", label: "Mixed" },
	];

	readonly todayStr = this.toDateString(new Date());

	get minDeparture(): string {
		if (!this.arrivalDate) return this.todayStr;
		const d = new Date(`${this.arrivalDate}T00:00:00`);
		d.setDate(d.getDate() + 1);
		return this.toDateString(d);
	}

	get isValid(): boolean {
		return !!(
			this.groupName.trim() &&
			this.groupType &&
			this.contactName.trim() &&
			this.arrivalDate &&
			this.departureDate &&
			this.totalRoomsRequested > 0
		);
	}

	onArrivalChange(): void {
		if (this.departureDate && this.departureDate <= this.arrivalDate) {
			this.departureDate = this.minDeparture;
		}
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	async save(): Promise<void> {
		if (!this.isValid) return;

		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) {
			this.error.set("No property selected");
			return;
		}

		this.saving.set(true);
		this.error.set(null);

		const payload: Record<string, unknown> = {
			property_id: propertyId,
			group_name: this.groupName.trim(),
			group_type: this.groupType,
			contact_name: this.contactName.trim(),
			arrival_date: this.arrivalDate,
			departure_date: this.departureDate,
			total_rooms_requested: this.totalRoomsRequested,
			block_status: this.blockStatus,
		};

		if (this.organizationName.trim()) payload["organization_name"] = this.organizationName.trim();
		if (this.contactEmail.trim()) payload["contact_email"] = this.contactEmail.trim();
		if (this.contactPhone.trim()) payload["contact_phone"] = this.contactPhone.trim();
		if (this.cutoffDate) payload["cutoff_date"] = this.cutoffDate;
		if (this.rateType) payload["rate_type"] = this.rateType;
		if (this.negotiatedRate != null && this.negotiatedRate > 0)
			payload["negotiated_rate"] = this.negotiatedRate;
		if (this.paymentMethod) payload["payment_method"] = this.paymentMethod;
		if (this.depositAmount != null && this.depositAmount > 0)
			payload["deposit_amount"] = this.depositAmount;
		if (this.meetingSpaceRequired) payload["meeting_space_required"] = true;
		if (this.cateringRequired) payload["catering_required"] = true;
		if (this.notes.trim()) payload["notes"] = this.notes.trim();

		try {
			await this.api.post(`/tenants/${tenantId}/commands/group.create`, payload);
			this.toast.success("Group booking created successfully.");
			this.router.navigate(["/groups"]);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.error.set(e instanceof Error ? e.message : "Failed to create group booking");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.router.navigate(["/groups"]);
	}

	private toDateString(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
