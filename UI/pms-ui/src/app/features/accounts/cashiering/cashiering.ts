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
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { formatCurrency, formatShortDate } from "../../../shared/format-utils";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../../shared/sort-utils";

type SessionStatusFilter = "ALL" | "OPEN" | "CLOSED" | "RECONCILED" | "PENDING_APPROVAL";

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

	// ── State ──
	readonly sessions = signal<CashierSessionListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<SessionStatusFilter>("ALL");
	readonly page = signal(1);
	readonly sort = createSortState();
	readonly pageSize = 25;

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
		const query = this.searchQuery().toLowerCase().trim();
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
	onSearch(v: string): void {
		this.searchQuery.set(v);
		this.page.set(1);
	}
	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
		this.page.set(1);
	}

	sortIcon(col: string): string {
		const s = this.sort();
		if (s.column !== col) return "unfold_more";
		return s.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}
	ariaSort(col: string): string | null {
		const s = this.sort();
		if (s.column !== col) return null;
		return s.direction === "asc" ? "ascending" : "descending";
	}

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

	formatDate = formatShortDate;
	formatCurrency = formatCurrency;

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
			const res = await this.api.get<CashierSessionListResponse>(
				"/billing/cashier-sessions",
				params,
			);
			this.sessions.set(res.data ?? []);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load cashier sessions");
		} finally {
			this.loading.set(false);
		}
	}
}
