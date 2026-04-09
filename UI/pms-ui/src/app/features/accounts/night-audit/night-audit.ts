import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
	BucketCheckItem,
	BucketCheckResponse,
	BusinessDateStatusResponse,
	DepartmentalRevenueItem,
	DepartmentalRevenueResponse,
	NightAuditRunDetailResponse,
	NightAuditRunListItem,
	PreAuditCheckItem,
	PreAuditResponse,
	TaxSummaryItem,
	TaxSummaryResponse,
	TrialBalanceResponse,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

/** Tabs for the main content area. */
type AuditTab = "status" | "trial-balance" | "pre-audit" | "bucket-check" | "reports" | "history";

@Component({
	selector: "app-night-audit",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./night-audit.html",
	styleUrl: "./night-audit.scss",
})
export class NightAuditComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	// ── Settings-driven signals ───────────────────────────────────────────────
	/** Scheduled night audit time (e.g. "02:00"). */
	readonly auditTime = computed(() =>
		this.settings.formatTime(this.settings.getString("audit.night_audit_time", "02:00")),
	);
	/** Whether the night audit runs automatically at the scheduled time. */
	readonly autoRunEnabled = computed(() =>
		this.settings.getBool("audit.auto_run_enabled", false),
	);
	/** Whether check-ins are blocked during the audit process. */
	readonly blockCheckinDuringAudit = computed(() =>
		this.settings.getBool("audit.block_checkin_during_audit", false),
	);

	// ── Tab state ──
	readonly activeTab = signal<AuditTab>("status");

	// ── Business Date Status (BC-1) ──
	readonly businessDateStatus = signal<BusinessDateStatusResponse | null>(null);
	readonly statusLoading = signal(false);

	// ── Night Audit Execution (BC-2) ──
	readonly executing = signal(false);
	readonly confirmingExecute = signal(false);
	readonly advanceDate = signal(true);

	// ── Manual Date Roll ──
	readonly dateRolling = signal(false);
	readonly confirmingDateRoll = signal(false);
	readonly dateRollReason = signal("");

	// ── Trial Balance ──
	readonly trialBalance = signal<TrialBalanceResponse | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly businessDate = signal(this.todayString());
	readonly sort = createSortState();

	// ── History (BC-3) ──
	readonly auditHistory = signal<NightAuditRunListItem[]>([]);
	readonly historyLoading = signal(false);
	readonly historySort = createSortState();

	// ── Run Detail (BC-4) ──
	readonly selectedRun = signal<NightAuditRunDetailResponse | null>(null);
	readonly runDetailLoading = signal(false);
	readonly expandedRunId = signal<string | null>(null);

	// ── Pre-Audit Checklist ──
	readonly preAuditChecks = signal<PreAuditCheckItem[]>([]);
	readonly preAuditLoading = signal(false);

	// ── Bucket Check ──
	readonly bucketCheckItems = signal<BucketCheckItem[]>([]);
	readonly bucketCheckBalanced = signal(false);
	readonly bucketCheckLoading = signal(false);

	// ── Departmental Revenue ──
	readonly deptRevenueItems = signal<DepartmentalRevenueItem[]>([]);
	readonly deptTotalGross = signal(0);
	readonly deptTotalNet = signal(0);
	readonly deptRevenueLoading = signal(false);

	// ── Tax Summary ──
	readonly taxSummaryItems = signal<TaxSummaryItem[]>([]);
	readonly totalTaxCollected = signal(0);
	readonly taxSummaryLoading = signal(false);

	// ── Computed ──
	readonly lineItems = computed(() => this.trialBalance()?.line_items ?? []);

	readonly sortedLineItems = computed(() =>
		sortBy(this.lineItems(), this.sort().column, this.sort().direction),
	);

	readonly sortedHistory = computed(() =>
		sortBy(this.auditHistory(), this.historySort().column, this.historySort().direction),
	);

	readonly summary = computed(() => {
		const tb = this.trialBalance();
		if (!tb) return null;
		return {
			totalDebits: tb.total_debits,
			totalCredits: tb.total_credits,
			totalPayments: tb.total_payments,
			variance: tb.variance,
			isBalanced: tb.is_balanced,
			businessDate: tb.business_date,
		};
	});

	readonly statusDisplay = computed(() => {
		const s = this.businessDateStatus();
		if (!s) return null;
		return {
			businessDate: s.business_date,
			dateStatus: s.date_status,
			dateStatusDisplay: s.date_status_display,
			propertyName: s.property_name,
			nightAuditStatus: s.night_audit_status,
			nightAuditStatusDisplay: s.night_audit_status_display,
			isLocked: s.is_locked,
			allowPostings: s.allow_postings,
			allowCheckIns: s.allow_check_ins,
			allowCheckOuts: s.allow_check_outs,
			arrivalsCount: s.arrivals_count,
			departuresCount: s.departures_count,
			stayoversCount: s.stayovers_count,
			totalRevenue: s.total_revenue,
			isReconciled: s.is_reconciled,
		};
	});

	/** Whether the current business date is in a state where night audit can run */
	readonly canExecuteAudit = computed(() => {
		const s = this.businessDateStatus();
		if (!s) return false;
		return s.date_status === "OPEN" && !s.is_locked;
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadBusinessDateStatus();
			this.loadTrialBalance();
			this.loadHistory();
			this.loadPreAuditChecklist();
			this.loadBucketCheck();
			this.loadDeptRevenue();
			this.loadTaxSummary();
		});
	}

	// ── Tab Navigation ──
	setTab(tab: AuditTab): void {
		this.activeTab.set(tab);
	}

	// ── Actions ──
	onDateChange(date: string): void {
		this.businessDate.set(date);
		this.loadTrialBalance();
	}

	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
	}

	onHistorySort(col: string): void {
		this.historySort.set(toggleSort(this.historySort(), col));
	}

	sortIcon = (col: string) => getSortIcon(this.sort(), col);
	historySortIcon = (col: string) => getSortIcon(this.historySort(), col);
	ariaSort = (col: string) => getAriaSort(this.sort(), col);

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	statusBadgeClass(status: string): string {
		switch (status) {
			case "OPEN":
				return "badge badge-success";
			case "CLOSED":
				return "badge badge-muted";
			case "IN_AUDIT":
				return "badge badge-warning";
			case "COMPLETED":
				return "badge badge-success";
			case "FAILED":
				return "badge badge-danger";
			case "IN_PROGRESS":
				return "badge badge-warning";
			default:
				return "badge";
		}
	}

	stepStatusIcon(status: string): string {
		switch (status) {
			case "COMPLETED":
				return "check_circle";
			case "FAILED":
				return "error";
			case "SKIPPED":
				return "skip_next";
			case "IN_PROGRESS":
				return "hourglass_top";
			default:
				return "radio_button_unchecked";
		}
	}

	stepStatusColor(status: string): string {
		switch (status) {
			case "COMPLETED":
				return "step-success";
			case "FAILED":
				return "step-danger";
			case "SKIPPED":
				return "step-muted";
			case "IN_PROGRESS":
				return "step-warning";
			default:
				return "";
		}
	}

	formatDuration(seconds: number | undefined): string {
		if (seconds == null) return "—";
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	formatDurationMs(ms: number | undefined): string {
		if (ms == null) return "—";
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	// ── BC-2: Execute Night Audit ──
	showExecuteConfirm(): void {
		this.confirmingExecute.set(true);
	}

	cancelExecute(): void {
		this.confirmingExecute.set(false);
	}

	async executeNightAudit(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.executing.set(true);
		this.confirmingExecute.set(false);

		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.night_audit.execute`, {
				property_id: propertyId,
				advance_date: this.advanceDate(),
			});
			this.toast.success("Night audit initiated. Processing in background...");
			await this.pollAuditCompletion();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to execute night audit");
		} finally {
			this.executing.set(false);
		}
	}

	// ── Manual Date Roll ──
	showDateRollConfirm(): void {
		this.confirmingDateRoll.set(true);
	}

	cancelDateRoll(): void {
		this.confirmingDateRoll.set(false);
		this.dateRollReason.set("");
	}

	async manualDateRoll(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dateRolling.set(true);
		this.confirmingDateRoll.set(false);

		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.date_roll.manual`, {
				property_id: propertyId,
				reason: this.dateRollReason() || "Manual date advance from UI",
			});
			this.toast.success("Business date advanced successfully.");
			this.dateRollReason.set("");
			await this.loadBusinessDateStatus();
			await this.loadTrialBalance();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to advance date");
		} finally {
			this.dateRolling.set(false);
		}
	}

	// ── BC-4: Toggle Run Detail ──
	async toggleRunDetail(runId: string): Promise<void> {
		if (this.expandedRunId() === runId) {
			this.expandedRunId.set(null);
			this.selectedRun.set(null);
			return;
		}
		this.expandedRunId.set(runId);
		await this.loadRunDetail(runId);
	}

	// ── Data loading ──
	async loadBusinessDateStatus(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.statusLoading.set(true);
		try {
			const res = await this.api.get<{ data: BusinessDateStatusResponse }>("/night-audit/status", {
				tenant_id: tenantId,
				property_id: propertyId,
			});
			this.businessDateStatus.set(res.data);
		} catch {
			this.businessDateStatus.set(null);
		} finally {
			this.statusLoading.set(false);
		}
	}

	async loadTrialBalance(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		this.error.set(null);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				business_date: this.businessDate(),
			};
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<TrialBalanceResponse>(
				"/billing/reports/trial-balance",
				params,
			);
			this.trialBalance.set(res);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load trial balance");
		} finally {
			this.loading.set(false);
		}
	}

	async loadHistory(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.historyLoading.set(true);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				limit: "50",
			};
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const res = await this.api.get<{ data: NightAuditRunListItem[] }>(
				"/night-audit/history",
				params,
			);
			this.auditHistory.set(res.data);
		} catch {
			this.auditHistory.set([]);
		} finally {
			this.historyLoading.set(false);
		}
	}

	async loadRunDetail(runId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.runDetailLoading.set(true);
		try {
			const res = await this.api.get<{ data: NightAuditRunDetailResponse }>(
				`/night-audit/runs/${runId}`,
				{ tenant_id: tenantId },
			);
			this.selectedRun.set(res.data);
		} catch {
			this.selectedRun.set(null);
		} finally {
			this.runDetailLoading.set(false);
		}
	}

	private async pollAuditCompletion(): Promise<void> {
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 1500));
			await this.loadBusinessDateStatus();
			await this.loadHistory();
			const status = this.businessDateStatus();
			if (status?.date_status === "CLOSED" || status?.night_audit_status === "COMPLETED") {
				this.toast.success("Night audit completed successfully.");
				await this.loadTrialBalance();
				return;
			}
			if (status?.night_audit_status === "FAILED") {
				this.toast.error("Night audit failed. Check history for details.");
				return;
			}
		}
	}

	private todayString(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	// ── Pre-Audit Checklist ──
	async loadPreAuditChecklist(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.preAuditLoading.set(true);
		try {
			const res = await this.api.get<PreAuditResponse>("/billing/pre-audit-checklist", {
				tenant_id: tenantId,
				property_id: propertyId,
				business_date: this.businessDate(),
			});
			this.preAuditChecks.set(res.checks ?? []);
		} catch {
			this.preAuditChecks.set([]);
		} finally {
			this.preAuditLoading.set(false);
		}
	}

	readonly preAuditPassCount = computed(() => this.preAuditChecks().filter((c) => c.passed).length);
	readonly preAuditFailCount = computed(() => this.preAuditChecks().filter((c) => !c.passed).length);

	// ── Bucket Check ──
	async loadBucketCheck(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.bucketCheckLoading.set(true);
		try {
			const res = await this.api.get<BucketCheckResponse>("/billing/bucket-check", {
				tenant_id: tenantId,
				property_id: propertyId,
				business_date: this.businessDate(),
			});
			this.bucketCheckItems.set(res.items ?? []);
			this.bucketCheckBalanced.set(res.is_balanced ?? false);
		} catch {
			this.bucketCheckItems.set([]);
			this.bucketCheckBalanced.set(false);
		} finally {
			this.bucketCheckLoading.set(false);
		}
	}

	// ── Departmental Revenue ──
	async loadDeptRevenue(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.deptRevenueLoading.set(true);
		try {
			const res = await this.api.get<DepartmentalRevenueResponse>("/billing/reports/departmental-revenue", {
				tenant_id: tenantId,
				property_id: propertyId,
				business_date: this.businessDate(),
			});
			this.deptRevenueItems.set(res.items ?? []);
			this.deptTotalGross.set(res.total_gross ?? 0);
			this.deptTotalNet.set(res.total_net ?? 0);
		} catch {
			this.deptRevenueItems.set([]);
			this.deptTotalGross.set(0);
			this.deptTotalNet.set(0);
		} finally {
			this.deptRevenueLoading.set(false);
		}
	}

	// ── Tax Summary ──
	async loadTaxSummary(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.taxSummaryLoading.set(true);
		try {
			const res = await this.api.get<TaxSummaryResponse>("/billing/reports/tax-summary", {
				tenant_id: tenantId,
				property_id: propertyId,
				business_date: this.businessDate(),
			});
			this.taxSummaryItems.set(res.items ?? []);
			this.totalTaxCollected.set(res.total_tax_collected ?? 0);
		} catch {
			this.taxSummaryItems.set([]);
			this.totalTaxCollected.set(0);
		} finally {
			this.taxSummaryLoading.set(false);
		}
	}
}
