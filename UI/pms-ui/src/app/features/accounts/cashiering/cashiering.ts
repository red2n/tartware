import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { CashierSessionListItem, CashierSessionListResponse } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../../core/search/global-search.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { ToastService } from "../../../shared/toast/toast.service";

type SessionStatusFilter = "ALL" | "OPEN" | "CLOSED" | "RECONCILED" | "PENDING_APPROVAL";
type CashierSessionDetail = CashierSessionListItem & {
	till_id?: string | null;
	register_id?: string | null;
	session_duration_minutes?: number | null;
	opening_float_counted?: string | null;
	opening_float_variance?: string | null;
	base_currency?: string | null;
	cash_transactions?: number | null;
	card_transactions?: number | null;
	other_transactions?: number | null;
	refund_transactions?: number | null;
	void_transactions?: number | null;
	total_cash_received?: string | null;
	total_card_received?: string | null;
	total_voids?: string | null;
	closing_cash_declared?: string | null;
	expected_cash_balance?: string | null;
	cash_variance_percent?: string | null;
	total_variance?: string | null;
	variance_reason?: string | null;
	has_material_variance?: boolean | null;
	updated_at?: string | null;
};

@Component({
	selector: "app-cashiering",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./cashiering.html",
	styleUrl: "./cashiering.scss",
})
export class CashieringComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	// ── State ──
	readonly sessions = signal<CashierSessionListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeFilter = signal<SessionStatusFilter>("ALL");
	readonly page = signal(1);
	readonly sort = createSortState();
	readonly pageSize = 25;
	readonly selectedSessionId = signal<string | null>(null);
	readonly selectedSessionDetail = signal<CashierSessionDetail | null>(null);
	readonly loadingSessionDetail = signal(false);
	readonly sessionDetailError = signal<string | null>(null);
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.page.set(1);
	});

	// ── Open Session Form ──
	readonly showOpenForm = signal(false);
	readonly openingSession = signal(false);
	readonly openForm = signal({
		cashier_name: "",
		terminal_id: "",
		shift_type: "full_day" as "morning" | "afternoon" | "night" | "full_day",
		opening_float: 0,
	});

	// ── Close Session ──
	readonly closingSessionId = signal<string | null>(null);
	readonly closingSession = signal(false);
	readonly closeForm = signal({
		closing_cash_declared: 0,
		closing_cash_counted: 0,
		notes: "",
	});

	readonly statusFilters: { key: SessionStatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "OPEN", label: "Open" },
		{ key: "CLOSED", label: "Closed" },
		{ key: "RECONCILED", label: "Reconciled" },
		{ key: "PENDING_APPROVAL", label: "Pending" },
	];

	readonly filtered = computed(() => {
		let list = this.sessions();
		const status = this.activeFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((s) => s.session_status === status);
		if (query) {
			list = list.filter(
				(s) =>
					s.session_number.toLowerCase().includes(query) ||
					(s.cashier_name?.toLowerCase().includes(query) ?? false) ||
					(s.terminal_name?.toLowerCase().includes(query) ?? false) ||
					(s.session_name?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginated = computed(() => {
		const sorted = sortBy(this.filtered(), this.sort().column, this.sort().direction);
		const start = (this.page() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.sessions();
		return {
			ALL: all.length,
			OPEN: all.filter((s) => s.session_status === "OPEN").length,
			CLOSED: all.filter((s) => s.session_status === "CLOSED").length,
			RECONCILED: all.filter((s) => s.session_status === "RECONCILED").length,
			PENDING_APPROVAL: all.filter((s) => s.session_status === "PENDING_APPROVAL").length,
		};
	});

	readonly summary = computed(() => {
		const all = this.sessions();
		const openCount = all.filter((s) => s.session_status === "OPEN").length;
		const totalRevenue = all.reduce((sum, s) => sum + Number.parseFloat(s.net_revenue ?? "0"), 0);
		const withVariance = all.filter((s) => s.has_variance).length;
		return { total: all.length, openCount, totalRevenue, withVariance };
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadSessions();
		});
	}

	// ── Actions ──
	setFilter(f: SessionStatusFilter): void {
		this.activeFilter.set(f);
		this.page.set(1);
	}
	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
		this.page.set(1);
	}

	sortIcon = (col: string) => getSortIcon(this.sort(), col);
	ariaSort = (col: string) => getAriaSort(this.sort(), col);

	statusClass(status: string): string {
		switch (status) {
			case "OPEN":
				return "badge-success";
			case "CLOSED":
				return "badge-muted";
			case "RECONCILED":
				return "badge-accent";
			case "PENDING_APPROVAL":
				return "badge-warning";
			case "SUSPENDED":
				return "badge-danger";
			default:
				return "";
		}
	}

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	async toggleSessionDetails(sessionId: string): Promise<void> {
		if (this.selectedSessionId() === sessionId) {
			this.selectedSessionId.set(null);
			this.selectedSessionDetail.set(null);
			this.sessionDetailError.set(null);
			return;
		}

		this.selectedSessionId.set(sessionId);
		this.selectedSessionDetail.set(null);
		this.sessionDetailError.set(null);
		await this.loadSessionDetail(sessionId);
	}

	// ── Open Session ──
	toggleOpenForm(): void {
		this.showOpenForm.set(!this.showOpenForm());
	}

	updateOpenForm(partial: Partial<typeof this.openForm extends () => infer T ? T : never>): void {
		this.openForm.set({ ...this.openForm(), ...partial });
	}

	async openSession(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.openingSession.set(true);
		try {
			const form = this.openForm();
			await this.api.post(`/tenants/${tenantId}/billing/cashier-sessions/open`, {
				property_id: propertyId,
				cashier_id: this.auth.user()?.id,
				cashier_name: form.cashier_name,
				terminal_id: form.terminal_id || undefined,
				shift_type: form.shift_type,
				opening_float: form.opening_float,
			});
			this.toast.success("Cashier session open submitted. Refreshing sessions...");
			this.showOpenForm.set(false);
			this.openForm.set({
				cashier_name: "",
				terminal_id: "",
				shift_type: "full_day",
				opening_float: 0,
			});
			await settleCommandReadModel(() => this.loadSessions());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to open session");
		} finally {
			this.openingSession.set(false);
		}
	}

	// ── Close Session ──
	showCloseForm(sessionId: string): void {
		this.closingSessionId.set(sessionId);
		this.closeForm.set({ closing_cash_declared: 0, closing_cash_counted: 0, notes: "" });
	}

	cancelClose(): void {
		this.closingSessionId.set(null);
	}

	updateCloseForm(partial: Partial<typeof this.closeForm extends () => infer T ? T : never>): void {
		this.closeForm.set({ ...this.closeForm(), ...partial });
	}

	async closeSession(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const sessionId = this.closingSessionId();
		if (!tenantId || !sessionId) return;

		this.closingSession.set(true);
		try {
			const form = this.closeForm();
			await this.api.post(`/tenants/${tenantId}/billing/cashier-sessions/close`, {
				session_id: sessionId,
				closing_cash_declared: form.closing_cash_declared,
				closing_cash_counted: form.closing_cash_counted,
				notes: form.notes || undefined,
			});
			this.toast.success("Cashier session close submitted. Refreshing sessions...");
			this.closingSessionId.set(null);
			await settleCommandReadModel(() => this.loadSessions());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to close session");
		} finally {
			this.closingSession.set(false);
		}
	}

	// ── Handover Session ──
	readonly handoveringSessionId = signal<string | null>(null);
	readonly handoveringSession = signal(false);
	readonly handoverForm = signal({
		closing_cash_declared: 0,
		closing_cash_counted: 0,
		handover_notes: "",
		incoming_cashier_name: "",
		incoming_terminal_id: "",
		incoming_shift_type: "full_day" as "morning" | "afternoon" | "night" | "full_day",
		incoming_opening_float: 0,
	});

	showHandoverForm(sessionId: string): void {
		this.handoveringSessionId.set(sessionId);
		this.handoverForm.set({
			closing_cash_declared: 0,
			closing_cash_counted: 0,
			handover_notes: "",
			incoming_cashier_name: "",
			incoming_terminal_id: "",
			incoming_shift_type: "full_day",
			incoming_opening_float: 0,
		});
	}

	cancelHandover(): void {
		this.handoveringSessionId.set(null);
	}

	updateHandoverForm(
		partial: Partial<typeof this.handoverForm extends () => infer T ? T : never>,
	): void {
		this.handoverForm.set({ ...this.handoverForm(), ...partial });
	}

	async handoverSession(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const sessionId = this.handoveringSessionId();
		if (!tenantId || !sessionId || !propertyId) return;

		this.handoveringSession.set(true);
		try {
			const form = this.handoverForm();
			await this.api.post(`/tenants/${tenantId}/billing/cashier-sessions/handover`, {
				outgoing_session_id: sessionId,
				closing_cash_declared: form.closing_cash_declared,
				closing_cash_counted: form.closing_cash_counted,
				handover_notes: form.handover_notes || undefined,
				incoming_cashier_id: this.auth.user()?.id,
				incoming_cashier_name: form.incoming_cashier_name,
				incoming_terminal_id: form.incoming_terminal_id || undefined,
				incoming_shift_type: form.incoming_shift_type,
				incoming_opening_float: form.incoming_opening_float,
				property_id: propertyId,
			});
			this.toast.success("Shift handover submitted. Refreshing sessions...");
			this.handoveringSessionId.set(null);
			await settleCommandReadModel(() => this.loadSessions());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to handover session");
		} finally {
			this.handoveringSession.set(false);
		}
	}

	private async loadSessionDetail(sessionId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loadingSessionDetail.set(true);
		this.sessionDetailError.set(null);
		try {
			const detail = await this.api.get<CashierSessionDetail>(
				`/billing/cashier-sessions/${sessionId}`,
				{ tenant_id: tenantId },
			);
			if (this.selectedSessionId() === sessionId) {
				this.selectedSessionDetail.set(detail);
			}
		} catch (e) {
			if (this.selectedSessionId() === sessionId) {
				this.selectedSessionDetail.set(null);
				this.sessionDetailError.set(
					e instanceof Error ? e.message : "Failed to load cashier session detail",
				);
			}
		} finally {
			this.loadingSessionDetail.set(false);
		}
	}

	// ── Data loading ──
	async loadSessions(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		this.error.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<CashierSessionListItem[] | CashierSessionListResponse>(
				"/billing/cashier-sessions",
				params,
			);
			this.sessions.set(Array.isArray(res) ? res : (res.data ?? []));
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load cashier sessions");
		} finally {
			this.loading.set(false);
		}
	}
}
