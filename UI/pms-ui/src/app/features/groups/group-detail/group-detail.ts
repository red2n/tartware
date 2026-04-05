import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import {
	type GroupBlockStatus,
	GroupBlockStatusDescriptions,
	type GroupBookingListItem,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { groupBlockStatusClass } from "../../../shared/badge-utils";
import { ToastService } from "../../../shared/toast/toast.service";

type DetailRow = { label: string; value: string; badge?: string; description?: string };

@Component({
	selector: "app-group-detail",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		RouterLink,
		MatIconModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		TranslatePipe,
	],
	templateUrl: "./group-detail.html",
	styleUrl: "./group-detail.scss",
})
export class GroupDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly group = signal<GroupBookingListItem | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	/* ── Action state ── */
	readonly actionLoading = signal(false);
	readonly actionSuccess = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);
	readonly confirmingCheckIn = signal(false);
	readonly preferredFloor = signal<number | null>(null);

	statusClass = groupBlockStatusClass;
	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	/** Group can be checked in when status is active (not cancelled/completed) and rooms have been picked. */
	readonly canCheckIn = computed(() => {
		const g = this.group();
		if (!g) return false;
		const status = g.block_status.toUpperCase();
		const blocked = new Set(["CANCELLED", "COMPLETED"]);
		return !blocked.has(status) && g.total_rooms_picked > 0;
	});

	readonly groupTypeIcon: Record<string, { icon: string; tooltip: string }> = {
		CONFERENCE: { icon: "groups", tooltip: "Conference" },
		WEDDING: { icon: "favorite", tooltip: "Wedding" },
		CORPORATE: { icon: "business", tooltip: "Corporate" },
		TOUR_GROUP: { icon: "tour", tooltip: "Tour Group" },
		SPORTS_TEAM: { icon: "sports", tooltip: "Sports Team" },
		REUNION: { icon: "celebration", tooltip: "Reunion" },
		CONVENTION: { icon: "location_city", tooltip: "Convention" },
		GOVERNMENT: { icon: "account_balance", tooltip: "Government" },
		AIRLINE_CREW: { icon: "flight", tooltip: "Airline Crew" },
		EDUCATIONAL: { icon: "school", tooltip: "Educational" },
		OTHER: { icon: "more_horiz", tooltip: "Other" },
	};

	readonly groupInfoRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Group Name", value: g.group_name },
			{ label: "Group Code", value: g.group_code ?? "—" },
			{
				label: "Type",
				value: g.group_type_display,
			},
			{
				label: "Status",
				value: g.block_status_display,
				badge: this.statusClass(g.block_status),
				description:
					GroupBlockStatusDescriptions[g.block_status.toUpperCase() as GroupBlockStatus] ?? "",
			},
			{ label: "Organization", value: g.organization_name ?? "—" },
			{ label: "Event", value: g.event_name ?? "—" },
			{ label: "Active", value: g.is_active ? "Yes" : "No" },
			{ label: "Confidence", value: g.booking_confidence ?? "—" },
		];
	});

	readonly stayRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Arrival", value: this.formatDate(g.arrival_date) },
			{ label: "Departure", value: this.formatDate(g.departure_date) },
			{ label: "Nights", value: String(g.number_of_nights) },
			{ label: "Cutoff Date", value: this.formatDate(g.cutoff_date) },
			{
				label: "Cutoff Days Before",
				value: g.cutoff_days_before_arrival != null ? String(g.cutoff_days_before_arrival) : "—",
			},
			{
				label: "Release Unsold",
				value: g.release_unsold_rooms ? "Yes" : "No",
			},
		];
	});

	readonly contactRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Contact Name", value: g.contact_name },
			{ label: "Email", value: g.contact_email ?? "—" },
			{ label: "Phone", value: g.contact_phone ?? "—" },
		];
	});

	readonly roomRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{ label: "Rooms Requested", value: String(g.total_rooms_requested) },
			{ label: "Rooms Blocked", value: String(g.total_rooms_blocked) },
			{ label: "Rooms Picked", value: String(g.total_rooms_picked) },
			{ label: "Rooms Confirmed", value: String(g.total_rooms_confirmed) },
			{
				label: "Pickup %",
				value: `${g.pickup_percentage}%`,
				badge: this.pickupBadge(g.pickup_percentage),
			},
			{
				label: "Rooming List",
				value: g.rooming_list_received ? "Received" : "Pending",
				badge: g.rooming_list_received ? "badge-success" : "badge-warning",
			},
			{
				label: "Rooming Deadline",
				value: g.rooming_list_deadline ? this.formatDate(g.rooming_list_deadline) : "—",
			},
		];
	});

	readonly financialRows = computed<DetailRow[]>(() => {
		const g = this.group();
		if (!g) return [];
		return [
			{
				label: "Negotiated Rate",
				value: g.negotiated_rate ? this.formatCurrency(+g.negotiated_rate, "USD") : "—",
			},
			{
				label: "Deposit Amount",
				value: g.deposit_amount ? this.formatCurrency(+g.deposit_amount, "USD") : "—",
			},
			{
				label: "Deposit Received",
				value: g.deposit_received ? "Yes" : "No",
				badge: g.deposit_received ? "badge-success" : "badge-warning",
			},
			{
				label: "Estimated Revenue",
				value: g.estimated_total_revenue
					? this.formatCurrency(+g.estimated_total_revenue, "USD")
					: "—",
			},
			{
				label: "Actual Revenue",
				value: g.actual_revenue ? this.formatCurrency(+g.actual_revenue, "USD") : "—",
			},
			{
				label: "Contract Signed",
				value: g.contract_signed ? "Yes" : "No",
				badge: g.contract_signed ? "badge-success" : "badge-muted",
			},
		];
	});

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get("groupId");
		if (id) {
			this.loadGroup(id);
		}
	}

	async loadGroup(id: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const res = await this.api.get<GroupBookingListItem>(`/group-bookings/${id}`, {
				tenant_id: tenantId,
			});
			this.group.set(res);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load group booking");
		} finally {
			this.loading.set(false);
		}
	}

	goBack(): void {
		this.router.navigate(["/groups"]);
	}

	/* ── Check-in action flow ── */

	showCheckInConfirm(): void {
		this.clearActionState();
		this.confirmingCheckIn.set(true);
		this.preferredFloor.set(null);
	}

	cancelAction(): void {
		this.confirmingCheckIn.set(false);
	}

	/**
	 * Dispatch the `group.check_in` command via Command Center.
	 * Uses proximity-based room assignment on the backend.
	 */
	async checkInGroup(): Promise<void> {
		const g = this.group();
		const tenantId = this.auth.tenantId();
		if (!g || !tenantId) return;

		this.actionLoading.set(true);
		this.actionError.set(null);
		this.actionSuccess.set(null);

		try {
			const payload: Record<string, unknown> = {
				group_booking_id: g.group_booking_id,
			};
			const floor = this.preferredFloor();
			if (floor != null) payload["preferred_floor"] = floor;

			await this.api.post(`/tenants/${tenantId}/commands/group.check_in`, payload);

			this.toast.success(`Group "${g.group_name}" check-in initiated. Rooms are being assigned.`);
			this.confirmingCheckIn.set(false);
			await this.pollGroupUntilChanged(g.group_booking_id);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Group check-in failed");
		} finally {
			this.actionLoading.set(false);
		}
	}

	private clearActionState(): void {
		this.actionSuccess.set(null);
		this.actionError.set(null);
		this.confirmingCheckIn.set(false);
	}

	/**
	 * Commands are async (Kafka). Poll the group booking until we detect
	 * a state change so the UI refreshes automatically.
	 */
	private async pollGroupUntilChanged(id: string): Promise<void> {
		const previousStatus = this.group()?.block_status;
		for (let i = 0; i < 8; i++) {
			await new Promise((r) => setTimeout(r, 800));
			await this.loadGroup(id);
			const current = this.group();
			if (current && current.block_status !== previousStatus) return;
		}
	}

	private pickupBadge(percentage: number): string {
		if (percentage >= 80) return "badge-success";
		if (percentage >= 50) return "badge-warning";
		return "badge-danger";
	}
}
