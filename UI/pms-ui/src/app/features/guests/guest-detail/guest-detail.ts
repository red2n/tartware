import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { GuestWithStats } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { loyaltyTierClass, vipStatusClass } from "../../../shared/badge-utils";

/** API returns version as string instead of bigint. */
type GuestDetail = Omit<GuestWithStats, "version"> & { version: string };

type DetailRow = { label: string; value: string; badge?: string };

type PreferenceItem = {
	id: string;
	preference_category_display: string;
	preference_type: string;
	preference_value?: string;
	priority: number;
	is_mandatory: boolean;
	is_active: boolean;
	notes?: string;
};

type DocumentItem = {
	id: string;
	document_type_display: string;
	document_number?: string;
	file_name: string;
	is_verified: boolean;
	verification_status_display: string;
	is_expired: boolean;
	expiry_date?: string;
};

type CommunicationItem = {
	id: string;
	communication_type_display: string;
	direction_display: string;
	subject?: string;
	message: string;
	status_display: string;
	created_at: string;
};

type DetailTab = "profile" | "preferences" | "documents" | "communications";

@Component({
	selector: "app-guest-detail",
	standalone: true,
	imports: [NgClass, RouterLink, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
	templateUrl: "./guest-detail.html",
	styleUrl: "./guest-detail.scss",
})
export class GuestDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly guest = signal<GuestDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeTab = signal<DetailTab>("profile");

	readonly preferences = signal<PreferenceItem[]>([]);
	readonly documents = signal<DocumentItem[]>([]);
	readonly communications = signal<CommunicationItem[]>([]);
	readonly loadingTab = signal(false);

	readonly loyaltyTierClass = loyaltyTierClass;

	readonly personalRows = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g) return [];
		return [
			{
				label: "Full Name",
				value: [g.title, g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" "),
			},
			{ label: "Email", value: g.email ?? "—" },
			{ label: "Phone", value: g.phone ?? "—" },
			{ label: "Secondary Phone", value: g.secondary_phone ?? "—" },
			{
				label: "Date of Birth",
				value: g.date_of_birth ? this.formatDate(g.date_of_birth) : "—",
			},
			{ label: "Gender", value: g.gender ?? "—" },
			{ label: "Nationality", value: g.nationality ?? "—" },
		].filter((row) => row.value !== "—");
	});

	readonly addressRows = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g?.address) return [];
		const a = g.address;
		const parts = [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean);
		if (parts.length === 0) return [];
		return [{ label: "Address", value: parts.join(", ") }];
	});

	readonly identityRows = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g) return [];
		return [
			{ label: "ID Type", value: g.id_type ?? "—" },
			{ label: "ID Number", value: g.id_number ?? "—" },
			{ label: "Passport", value: g.passport_number ?? "—" },
			{
				label: "Passport Expiry",
				value: g.passport_expiry ? this.formatDate(g.passport_expiry) : "—",
			},
		].filter((row) => row.value !== "—");
	});

	readonly companyRows = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g) return [];
		return [
			{ label: "Company", value: g.company_name ?? "—" },
			{ label: "Tax ID", value: g.company_tax_id ?? "—" },
		].filter((row) => row.value !== "—");
	});

	readonly loyaltyRows = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g) return [];
		const rows: DetailRow[] = [];
		if (g.vip_status) {
			rows.push({
				label: "VIP Status",
				value: "VIP",
				badge: vipStatusClass(true),
			});
		}
		if (g.loyalty_tier) {
			rows.push({
				label: "Loyalty Tier",
				value: this.tierLabel(g.loyalty_tier),
				badge: loyaltyTierClass(g.loyalty_tier),
			});
		}
		rows.push({
			label: "Loyalty Points",
			value: g.loyalty_points.toLocaleString(),
		});
		return rows;
	});

	readonly stayStats = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g) return [];
		return [
			{ label: "Total Bookings", value: String(g.total_bookings) },
			{ label: "Total Nights", value: String(g.total_nights) },
			{ label: "Total Revenue", value: this.formatCurrency(g.total_revenue) },
			{ label: "Lifetime Value", value: this.formatCurrency(g.lifetime_value) },
			{
				label: "Avg Stay Length",
				value: g.average_stay_length != null ? `${g.average_stay_length.toFixed(1)} nights` : "—",
			},
			{
				label: "Last Stay",
				value: g.last_stay_date ? this.formatDate(g.last_stay_date) : "—",
			},
			{ label: "Upcoming", value: String(g.upcoming_reservations ?? 0) },
			{ label: "Past Stays", value: String(g.past_reservations ?? 0) },
			{ label: "Cancelled", value: String(g.cancelled_reservations ?? 0) },
		].filter((row) => row.value !== "—");
	});

	readonly preferenceSummary = computed<DetailRow[]>(() => {
		const g = this.guest();
		if (!g?.preferences) return [];
		const p = g.preferences;
		const rows: DetailRow[] = [];
		if (p.roomType) rows.push({ label: "Room Type", value: p.roomType });
		if (p.bedType) rows.push({ label: "Bed Type", value: p.bedType });
		if (p.floor) rows.push({ label: "Floor", value: p.floor });
		if (p.smoking) rows.push({ label: "Smoking", value: "Yes" });
		if (p.language) rows.push({ label: "Language", value: p.language.toUpperCase() });
		if (p.dietaryRestrictions?.length)
			rows.push({ label: "Dietary", value: p.dietaryRestrictions.join(", ") });
		if (p.specialRequests?.length)
			rows.push({
				label: "Special Requests",
				value: p.specialRequests.join(", "),
			});
		return rows;
	});

	ngOnInit(): void {
		this.loadGuest();
	}

	setTab(tab: DetailTab): void {
		this.activeTab.set(tab);
		if (tab === "preferences" && this.preferences().length === 0) {
			this.loadPreferences();
		} else if (tab === "documents" && this.documents().length === 0) {
			this.loadDocuments();
		} else if (tab === "communications" && this.communications().length === 0) {
			this.loadCommunications();
		}
	}

	goBack(): void {
		this.router.navigate(["/guests"]);
	}

	formatDate(date: string | Date | null | undefined): string {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	formatCurrency(amount: number | null | undefined): string {
		if (amount == null) return "—";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	}

	tierLabel(tier: string): string {
		return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
	}

	initials(guest: GuestDetail): string {
		return `${guest.first_name.charAt(0)}${guest.last_name.charAt(0)}`.toUpperCase();
	}

	async loadGuest(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const guestId = this.route.snapshot.paramMap.get("guestId");
		if (!tenantId || !guestId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			// Guests are tenant-scoped — don't filter by property
			const params: Record<string, string> = { tenant_id: tenantId };
			const guest = await this.api.get<GuestDetail>(`/guests/${guestId}`, params);
			this.guest.set(guest);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load guest");
		} finally {
			this.loading.set(false);
		}
	}

	async loadPreferences(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const guestId = this.route.snapshot.paramMap.get("guestId");
		if (!tenantId || !guestId) return;

		this.loadingTab.set(true);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				active_only: "true",
			};
			const items = await this.api.get<PreferenceItem[]>(`/guests/${guestId}/preferences`, params);
			this.preferences.set(items);
		} catch {
			/* preferences are supplementary — fail silently */
		} finally {
			this.loadingTab.set(false);
		}
	}

	async loadDocuments(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const guestId = this.route.snapshot.paramMap.get("guestId");
		if (!tenantId || !guestId) return;

		this.loadingTab.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const items = await this.api.get<DocumentItem[]>(`/guests/${guestId}/documents`, params);
			this.documents.set(items);
		} catch {
			/* documents are supplementary — fail silently */
		} finally {
			this.loadingTab.set(false);
		}
	}

	async loadCommunications(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const guestId = this.route.snapshot.paramMap.get("guestId");
		if (!tenantId || !guestId) return;

		this.loadingTab.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const items = await this.api.get<CommunicationItem[]>(
				`/guests/${guestId}/communications`,
				params,
			);
			this.communications.set(items);
		} catch {
			/* communications are supplementary — fail silently */
		} finally {
			this.loadingTab.set(false);
		}
	}
}
