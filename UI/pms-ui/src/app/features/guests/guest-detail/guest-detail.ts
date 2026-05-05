import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { DialogService } from 'primeng/dynamicdialog';
import { IconComponent } from '../../../shared/components/icon/icon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { GuestConsentLedger, GuestWithStats } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { loyaltyTierClass, vipStatusClass } from "../../../shared/badge-utils";
import { ToastService } from "../../../shared/toast/toast.service";

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

type DetailTab = "profile" | "preferences" | "documents" | "communications" | "account";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
@Component({
	selector: "app-guest-detail",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		RouterLink,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		TranslatePipe,
	],
	templateUrl: "./guest-detail.html",
	styleUrl: "./guest-detail.scss",
})
export class GuestDetailComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialog = inject(DialogService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly guest = signal<GuestDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeTab = signal<DetailTab>("profile");

	readonly preferences = signal<PreferenceItem[]>([]);
	readonly documents = signal<DocumentItem[]>([]);
	readonly communications = signal<CommunicationItem[]>([]);
	readonly loadingTab = signal(false);

	/* ── Phase E: account actions ── */
	readonly vipForm = signal({ vip_status: "NONE", reason: "" });
	readonly blacklistForm = signal({ is_blacklisted: false, reason: "" });
	readonly loyaltyForm = signal({ loyalty_tier: "", loyalty_number: "", points_adjustment: "" });
	readonly contactForm = signal({ email: "", phone: "", secondary_phone: "" });
	readonly mergeForm = signal({ duplicate_guest_id: "" });
	readonly gdprRectifyForm = signal({ field: "", new_value: "", reason: "" });
	readonly gdprRestrictForm = signal({ restrict: true, reason: "" });
	readonly consentLedger = signal<GuestConsentLedger | null>(null);
	readonly consentForm = signal<GuestConsentLedger>({});
	readonly processing = signal<string | null>(null);

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
				value: g.vip_status,
				badge: vipStatusClass(g.vip_status),
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
		} else if (tab === "account") {
			this.primeAccountForms();
			this.loadConsent();
		}
	}

	private primeAccountForms(): void {
		const g = this.guest();
		if (!g) return;
		this.vipForm.set({ vip_status: g.vip_status ?? "NONE", reason: "" });
		this.blacklistForm.set({
			is_blacklisted: g.is_blacklisted ?? false,
			reason: g.blacklist_reason ?? "",
		});
		this.loyaltyForm.set({
			loyalty_tier: g.loyalty_tier ?? "",
			loyalty_number: "",
			points_adjustment: "",
		});
		this.contactForm.set({
			email: g.email ?? "",
			phone: g.phone ?? "",
			secondary_phone: g.secondary_phone ?? "",
		});
	}

	private guestUrl(suffix: string): string | null {
		const tenantId = this.auth.tenantId();
		const guestId = this.guest()?.id;
		if (!tenantId || !guestId) return null;
		return `/tenants/${tenantId}/guests/${guestId}${suffix}`;
	}

	async submitVip(): Promise<void> {
		const url = this.guestUrl("/vip");
		if (!url) return;
		const f = this.vipForm();
		this.processing.set("vip");
		try {
			await this.api.post(url, { vip_status: f.vip_status, reason: f.reason || undefined });
			this.toast.success("VIP status updated.");
			setTimeout(() => this.loadGuest(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update VIP status");
		} finally {
			this.processing.set(null);
		}
	}

	async submitBlacklist(): Promise<void> {
		const url = this.guestUrl("/blacklist");
		if (!url) return;
		const f = this.blacklistForm();
		if (f.is_blacklisted && !f.reason.trim()) {
			this.toast.error("Reason is required when blacklisting a guest.");
			return;
		}
		this.processing.set("blacklist");
		try {
			await this.api.post(url, {
				is_blacklisted: f.is_blacklisted,
				reason: f.reason || undefined,
			});
			this.toast.success(f.is_blacklisted ? "Guest blacklisted." : "Guest removed from blacklist.");
			setTimeout(() => this.loadGuest(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update blacklist");
		} finally {
			this.processing.set(null);
		}
	}

	async submitLoyalty(): Promise<void> {
		const url = this.guestUrl("/loyalty");
		if (!url) return;
		const f = this.loyaltyForm();
		const body: Record<string, unknown> = {
			loyalty_tier: f.loyalty_tier || undefined,
			loyalty_number: f.loyalty_number || undefined,
		};
		if (f.points_adjustment) {
			const delta = Number(f.points_adjustment);
			if (!Number.isFinite(delta)) {
				this.toast.error("Points adjustment must be numeric.");
				return;
			}
			body["points_adjustment"] = delta;
		}
		this.processing.set("loyalty");
		try {
			await this.api.post(url, body);
			this.toast.success("Loyalty enrollment updated.");
			setTimeout(() => this.loadGuest(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update loyalty");
		} finally {
			this.processing.set(null);
		}
	}

	async submitContact(): Promise<void> {
		const url = this.guestUrl("/contact");
		if (!url) return;
		const f = this.contactForm();
		this.processing.set("contact");
		try {
			await this.api.post(url, {
				email: f.email || undefined,
				phone: f.phone || undefined,
				secondary_phone: f.secondary_phone || undefined,
			});
			this.toast.success("Contact details updated.");
			setTimeout(() => this.loadGuest(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update contact");
		} finally {
			this.processing.set(null);
		}
	}

	async submitMerge(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const g = this.guest();
		if (!tenantId || !g) return;
		const dup = this.mergeForm().duplicate_guest_id.trim();
		if (!dup) {
			this.toast.error("Enter the duplicate guest ID to merge.");
			return;
		}
		if (!confirm(`Merge guest ${dup} INTO this guest? This cannot be undone.`)) return;
		this.processing.set("merge");
		try {
			await this.api.post("/guests/merge", {
				tenant_id: tenantId,
				primary_guest_id: g.id,
				duplicate_guest_id: dup,
			});
			this.toast.success("Guest merge submitted.");
			this.mergeForm.set({ duplicate_guest_id: "" });
			setTimeout(() => this.loadGuest(), 1500);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to merge guests");
		} finally {
			this.processing.set(null);
		}
	}

	async exportGdpr(): Promise<void> {
		const url = this.guestUrl("/gdpr-export");
		if (!url) return;
		this.processing.set("gdpr-export");
		try {
			const data = await this.api.get<unknown>(url);
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const link = document.createElement("a");
			const href = URL.createObjectURL(blob);
			link.href = href;
			link.download = `guest-${this.guest()?.id}-gdpr-export.json`;
			link.click();
			URL.revokeObjectURL(href);
			this.toast.success("GDPR data export downloaded.");
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to export guest data");
		} finally {
			this.processing.set(null);
		}
	}

	async eraseGdpr(): Promise<void> {
		const url = this.guestUrl("/gdpr-erase");
		if (!url) return;
		if (
			!confirm(
				"Erase this guest's personal data per GDPR Art. 17? Reservations are kept (anonymised). This cannot be undone.",
			)
		)
			return;
		this.processing.set("gdpr-erase");
		try {
			await this.api.post(url, { reason: "Right to erasure request" });
			this.toast.success("Erasure request submitted.");
			setTimeout(() => this.loadGuest(), 1500);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to erase guest data");
		} finally {
			this.processing.set(null);
		}
	}

	async rectifyGdpr(): Promise<void> {
		const url = this.guestUrl("/gdpr-rectify");
		if (!url) return;
		const f = this.gdprRectifyForm();
		if (!f.field.trim() || !f.new_value.trim()) {
			this.toast.error("Field and new value are required.");
			return;
		}
		this.processing.set("gdpr-rectify");
		try {
			await this.api.post(url, {
				field: f.field.trim(),
				new_value: f.new_value.trim(),
				reason: f.reason || undefined,
			});
			this.toast.success("Rectification submitted.");
			this.gdprRectifyForm.set({ field: "", new_value: "", reason: "" });
			setTimeout(() => this.loadGuest(), 1500);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to rectify");
		} finally {
			this.processing.set(null);
		}
	}

	async restrictGdpr(): Promise<void> {
		const url = this.guestUrl("/gdpr-restrict");
		if (!url) return;
		const f = this.gdprRestrictForm();
		this.processing.set("gdpr-restrict");
		try {
			await this.api.post(url, { restrict: f.restrict, reason: f.reason || undefined });
			this.toast.success(f.restrict ? "Processing restricted." : "Restriction lifted.");
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update restriction");
		} finally {
			this.processing.set(null);
		}
	}

	async loadConsent(): Promise<void> {
		const url = this.guestUrl("/consent");
		if (!url) return;
		try {
			const ledger = await this.api.get<GuestConsentLedger>(url);
			this.consentLedger.set(ledger);
			this.consentForm.set({ ...ledger });
		} catch {
			/* consent ledger optional */
		}
	}

	async submitConsent(): Promise<void> {
		const url = this.guestUrl("/consent");
		if (!url) return;
		this.processing.set("consent");
		try {
			await this.api.post(url, this.consentForm());
			this.toast.success("Consent preferences updated.");
			setTimeout(() => this.loadConsent(), 800);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update consent");
		} finally {
			this.processing.set(null);
		}
	}

	toggleConsent(key: keyof GuestConsentLedger, value: boolean): void {
		this.consentForm.set({ ...this.consentForm(), [key]: value });
	}

	goBack(): void {
		this.router.navigate(["/guests"]);
	}

	formatDate(date: string | Date | null | undefined): string {
		if (!date) return "—";
		return this.settings.formatDate(
			typeof date === "string" ? date : date.toISOString().slice(0, 10),
		);
	}

	formatCurrency(amount: number | null | undefined): string {
		if (amount == null) return "—";
		return this.settings.formatCurrency(amount);
	}

	tierLabel(tier: string): string {
		return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
	}

	initials(guest: GuestDetail): string {
		return `${guest.first_name.charAt(0)}${guest.last_name.charAt(0)}`.toUpperCase();
	}

	openEditDialog(): void {
		const g = this.guest();
		if (!g) return;

		import("../edit-guest-dialog/edit-guest-dialog").then(({ EditGuestDialogComponent }) => {
			const ref = this.dialog.open(EditGuestDialogComponent, {
				width: "600px",
				closable: false,
				data: {
					id: g.id,
					first_name: g.first_name,
					last_name: g.last_name,
					email: g.email,
					phone: g.phone,
					title: g.title,
					nationality: g.nationality,
					gender: g.gender,
					date_of_birth: g.date_of_birth,
					company_name: g.company_name,
					vip_status: g.vip_status,
					loyalty_tier: g.loyalty_tier,
				},
			});
			ref!.onClose.subscribe((updated: boolean) => {
				if (updated) {
					this.toast.success("Guest profile update submitted. It may take a moment to apply.");
					setTimeout(() => this.loadGuest(), 1500);
				}
			});
		});
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
