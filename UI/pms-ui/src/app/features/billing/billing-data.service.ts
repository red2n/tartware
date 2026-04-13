import { computed, inject, Injectable, signal } from "@angular/core";

import type {
	BillingPaymentListItem,
	BillingPaymentListResponse,
	ChargePostingListItem,
	ChargePostingListResponse,
	FolioListItem,
	FolioListResponse,
	InvoiceListItem,
	InvoiceListResponse,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";

/**
 * Billing data service — owns all billing list data signals and loading methods.
 * Provided at component level so each billing page instance gets its own state.
 * Can be injected by child components that need billing data.
 */
@Injectable()
export class BillingDataService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);

	private unwrapListResponse<T>(response: T[] | { data?: T[] } | null | undefined): T[] {
		if (Array.isArray(response)) {
			return response;
		}
		return response?.data ?? [];
	}

	// ── Payments ──
	readonly payments = signal<BillingPaymentListItem[]>([]);
	readonly paymentsLoading = signal(false);
	readonly paymentsError = signal<string | null>(null);

	// ── Invoices ──
	readonly invoices = signal<InvoiceListItem[]>([]);
	readonly invoicesLoading = signal(false);
	readonly invoicesError = signal<string | null>(null);

	// ── Folios ──
	readonly folios = signal<FolioListItem[]>([]);
	readonly foliosLoading = signal(false);
	readonly foliosError = signal<string | null>(null);

	// ── Charges ──
	readonly charges = signal<ChargePostingListItem[]>([]);
	readonly chargesLoading = signal(false);
	readonly chargesError = signal<string | null>(null);

	// ── Folio detail ──
	readonly selectedFolioId = signal<string | null>(null);
	readonly folioCharges = signal<ChargePostingListItem[]>([]);
	readonly folioChargesLoading = signal(false);

	/** Open folios available as charge / payment targets. */
	readonly openFolios = computed(() =>
		this.folios().filter((f) => f.folio_status === "open"),
	);

	/** KPI summary computed from all billing data. */
	readonly summary = computed(() => {
		const pays = this.payments();
		const invs = this.invoices();
		const fols = this.folios();
		const completedPayments = pays.filter((p) => p.status === "completed");
		const totalReceived = completedPayments.reduce((sum, p) => sum + p.amount, 0);
		const currency = pays[0]?.currency ?? invs[0]?.currency ?? "USD";
		const outstandingBalance = fols
			.filter((f) => f.folio_status === "open")
			.reduce((sum, f) => sum + f.balance, 0);
		const overdueCount = invs.filter((i) => i.status === "overdue").length;
		const openFolios = fols.filter((f) => f.folio_status === "open").length;
		return { totalReceived, outstandingBalance, overdueCount, openFolios, currency };
	});

	/** Unique guests derived from loaded folios (for pickers). */
	readonly availableGuests = computed(() => {
		const seen = new Set<string>();
		const guests: { id: string; name: string }[] = [];
		for (const f of this.folios()) {
			if (f.guest_id && !seen.has(f.guest_id)) {
				seen.add(f.guest_id);
				guests.push({ id: f.guest_id, name: f.guest_name ?? "Unknown" });
			}
		}
		return guests;
	});

	/** Reservations available for a given guest. */
	reservationsForGuest(guestId: string): { id: string; label: string }[] {
		if (!guestId) return [];
		const seen = new Set<string>();
		const reservations: { id: string; label: string }[] = [];
		for (const f of this.folios()) {
			if (f.guest_id === guestId && f.reservation_id && !seen.has(f.reservation_id)) {
				seen.add(f.reservation_id);
				reservations.push({
					id: f.reservation_id,
					label: f.confirmation_number ?? f.reservation_id.slice(0, 8),
				});
			}
		}
		return reservations;
	}

	// ── Loading methods ──

	/** Tracks which tabs have been loaded at least once (reset on tenant/property change). */
	private readonly loaded = new Set<string>();

	/**
	 * Load data for the active view first, then incrementally load the
	 * remaining tabs one-by-one so we don't flood the network.
	 */
	async loadForView(activeView: string): Promise<void> {
		this.loaded.clear();

		// 1. Load the active tab immediately
		await this.loadTab(activeView);

		// 2. Queue the remaining tabs sequentially
		const allTabs = ["payments", "invoices", "folios", "charges"];
		const remaining = allTabs.filter((t) => t !== activeView);
		for (const tab of remaining) {
			await this.loadTab(tab);
		}
	}

	/**
	 * Ensure a single tab's data is loaded. Skips if already fetched in this
	 * cycle (call `loadForView` to reset the cycle).
	 */
	async ensureLoaded(tab: string): Promise<void> {
		if (this.loaded.has(tab)) return;
		await this.loadTab(tab);
	}

	private async loadTab(tab: string): Promise<void> {
		switch (tab) {
			case "payments":
				await this.loadPayments();
				break;
			case "invoices":
				await this.loadInvoices();
				break;
			case "folios":
				await this.loadFolios();
				break;
			case "charges":
				await this.loadCharges();
				break;
		}
		this.loaded.add(tab);
	}

	async loadPayments(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.paymentsLoading.set(true);
		this.paymentsError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<BillingPaymentListItem[] | BillingPaymentListResponse>(
				"/billing/payments",
				params,
			);
			this.payments.set(this.unwrapListResponse(res));
		} catch (e) {
			this.paymentsError.set(e instanceof Error ? e.message : "Failed to load payments");
		} finally {
			this.paymentsLoading.set(false);
		}
	}

	async loadInvoices(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.invoicesLoading.set(true);
		this.invoicesError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<InvoiceListResponse>("/billing/invoices", params);
			this.invoices.set(res.data ?? []);
		} catch (e) {
			this.invoicesError.set(e instanceof Error ? e.message : "Failed to load invoices");
		} finally {
			this.invoicesLoading.set(false);
		}
	}

	async loadFolios(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.foliosLoading.set(true);
		this.foliosError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<FolioListItem[] | FolioListResponse>(
				"/billing/folios",
				params,
			);
			this.folios.set(this.unwrapListResponse(res));
		} catch (e) {
			this.foliosError.set(e instanceof Error ? e.message : "Failed to load folios");
		} finally {
			this.foliosLoading.set(false);
		}
	}

	async loadCharges(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.chargesLoading.set(true);
		this.chargesError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<ChargePostingListItem[] | ChargePostingListResponse>(
				"/billing/charges",
				params,
			);
			this.charges.set(this.unwrapListResponse(res));
		} catch (e) {
			this.chargesError.set(e instanceof Error ? e.message : "Failed to load charges");
		} finally {
			this.chargesLoading.set(false);
		}
	}

	async selectFolio(folio: FolioListItem): Promise<void> {
		if (this.selectedFolioId() === folio.id) {
			this.selectedFolioId.set(null);
			return;
		}
		this.selectedFolioId.set(folio.id);
		this.folioChargesLoading.set(true);
		try {
			const tenantId = this.auth.tenantId();
			const params: Record<string, string> = {
				tenant_id: tenantId ?? "",
				folio_id: folio.id,
				limit: "200",
			};
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<ChargePostingListItem[] | ChargePostingListResponse>(
				"/billing/charges",
				params,
			);
			this.folioCharges.set(this.unwrapListResponse(res));
		} catch {
			this.folioCharges.set([]);
		} finally {
			this.folioChargesLoading.set(false);
		}
	}
}
