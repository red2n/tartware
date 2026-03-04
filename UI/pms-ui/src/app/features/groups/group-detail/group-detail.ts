import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { GroupBookingListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { groupBlockStatusClass } from "../../../shared/badge-utils";
import { formatCurrency, formatLongDate } from "../../../shared/format-utils";

type DetailRow = { label: string; value: string; badge?: string };

@Component({
	selector: "app-group-detail",
	standalone: true,
	imports: [NgClass, RouterLink, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, TranslatePipe],
	templateUrl: "./group-detail.html",
	styleUrl: "./group-detail.scss",
})
export class GroupDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly group = signal<GroupBookingListItem | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	statusClass = groupBlockStatusClass;
	formatDate = formatLongDate;
	formatCurrency = formatCurrency;

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

	private pickupBadge(percentage: number): string {
		if (percentage >= 80) return "badge-success";
		if (percentage >= 50) return "badge-warning";
		return "badge-danger";
	}
}
