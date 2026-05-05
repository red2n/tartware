import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import type { GlBatchEntryItem, GlBatchListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { ToastService } from "../../../shared/toast/toast.service";

type StatusFilter = "ALL" | "OPEN" | "REVIEW" | "POSTED" | "ERROR";

@Component({
	selector: "app-gl-batches",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./gl-batches.html",
	styleUrl: "./gl-batches.scss",
})
export class GlBatchesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly batches = signal<GlBatchListItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly statusFilter = signal<StatusFilter>("ALL");
	readonly startDate = signal(this.monthStart());
	readonly endDate = signal(this.todayString());
	readonly exporting = signal<string | null>(null);

	readonly expandedBatchId = signal<string | null>(null);
	readonly entries = signal<GlBatchEntryItem[]>([]);
	readonly entriesLoading = signal(false);
	readonly entriesError = signal<string | null>(null);

	/** Debit/credit totals + variance for the currently-expanded batch entries. */
	readonly entryTotals = computed(() => {
		const rows = this.entries();
		const totalDebit  = rows.reduce((s, r) => s + Number(r.debit_amount  ?? 0), 0);
		const totalCredit = rows.reduce((s, r) => s + Number(r.credit_amount ?? 0), 0);
		return { totalDebit, totalCredit, variance: Math.abs(totalDebit - totalCredit) };
	});

	readonly filtered = computed(() => {
		const status = this.statusFilter();
		const items = this.batches();
		if (status === "ALL") return items;
		return items.filter((b) => b.batch_status?.toUpperCase() === status);
	});

	readonly totals = computed(() => {
		const items = this.batches();
		const debits = items.reduce((sum, b) => sum + (b.debit_total ?? 0), 0);
		const credits = items.reduce((sum, b) => sum + (b.credit_total ?? 0), 0);
		const reviewable = items.filter(
			(b) => b.batch_status?.toUpperCase() === "REVIEW",
		).length;
		const posted = items.filter(
			(b) => b.batch_status?.toUpperCase() === "POSTED",
		).length;
		return {
			debits,
			credits,
			variance: debits - credits,
			reviewable,
			posted,
			currency: items[0]?.currency ?? "USD",
		};
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			void this.loadBatches();
		});
	}

	async loadBatches(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dataReady.set(false);
		this.error.set(null);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "200",
			};
			if (this.startDate()) params["start_date"] = this.startDate();
			if (this.endDate()) params["end_date"] = this.endDate();
			if (this.statusFilter() !== "ALL") {
				params["batch_status"] = this.statusFilter();
			}
			const res = await this.api.get<{ data: GlBatchListItem[] }>(
				"/billing/gl-batches",
				params,
			);
			this.batches.set(res.data ?? []);
		} catch (e) {
			this.batches.set([]);
			this.error.set(
				e instanceof Error
					? e.message
					: "GL batch list endpoint is not currently available.",
			);
		} finally {
			this.dataReady.set(true);
		}
	}

	setStatusFilter(f: StatusFilter): void {
		this.statusFilter.set(f);
		void this.loadBatches();
	}

	resetFilters(): void {
		this.statusFilter.set("ALL");
		this.startDate.set(this.monthStart());
		this.endDate.set(this.todayString());
		void this.loadBatches();
	}

	async toggleEntries(batch: GlBatchListItem): Promise<void> {
		if (this.expandedBatchId() === batch.gl_batch_id) {
			this.expandedBatchId.set(null);
			this.entries.set([]);
			return;
		}
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.expandedBatchId.set(batch.gl_batch_id);
		this.entries.set([]);
		this.entriesLoading.set(true);
		this.entriesError.set(null);
		try {
			const res = await this.api.get<{ data: GlBatchEntryItem[] }>(
				`/billing/gl-batches/${batch.gl_batch_id}/entries`,
				{ tenant_id: tenantId, limit: "1000" },
			);
			this.entries.set(res.data ?? []);
		} catch (e) {
			this.entriesError.set(
				e instanceof Error ? e.message : "Failed to load batch entries.",
			);
		} finally {
			this.entriesLoading.set(false);
		}
	}

	async exportBatch(batch: GlBatchListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.exporting.set(batch.gl_batch_id);
		try {
			await this.api.post<unknown>(`/commands/billing.gl_batch.export/execute`, {
				tenant_id: tenantId,
				payload: {
					property_id: batch.property_id,
					gl_batch_id: batch.gl_batch_id,
					business_date: batch.batch_date,
				},
			});
			this.toast.success(`Export submitted for batch ${batch.batch_number}.`);
			await settleCommandReadModel(() => this.loadBatches());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to export batch");
		} finally {
			this.exporting.set(null);
		}
	}

	canExport(batch: GlBatchListItem): boolean {
		const status = batch.batch_status?.toUpperCase();
		return status === "REVIEW" || status === "OPEN";
	}

	/**
	 * Download GL entries for the selected batch as a CSV file.
	 * Only available once entries have been loaded (drill-down opened).
	 */
	downloadCsv(batch: GlBatchListItem): void {
		const rows = this.entries();
		if (!rows.length) {
			this.toast.error("No entries loaded — open the batch first.");
			return;
		}
		const headers = [
			"entry_id",
			"entry_number",
			"transaction_date",
			"account_code",
			"account_name",
			"folio_id",
			"reservation_id",
			"confirmation_number",
			"department_code",
			"description",
			"debit_amount",
			"credit_amount",
			"currency_code",
			"source_reference",
			"entry_status",
		];
		const escape = (v: unknown): string => {
			const s = v == null ? "" : String(v);
			return s.includes(",") || s.includes('"') || s.includes("\n")
				? `"${s.replace(/"/g, '""')}"`
				: s;
		};
		const csv = [
			headers.join(","),
			...rows.map((r) =>
				[
					r.entry_id,
					r.entry_number,
					r.transaction_date,
					r.account_code,
					r.account_name ?? "",
					r.folio_id ?? "",
					r.reservation_id ?? "",
					r.confirmation_number ?? "",
					r.department_code ?? "",
					r.description,
					r.debit_amount,
					r.credit_amount,
					r.currency_code,
					r.source_reference ?? "",
					r.entry_status,
				]
					.map(escape)
					.join(","),
			),
		].join("\r\n");

		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `gl-batch-${batch.batch_number}-${batch.batch_date}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	statusBadge(status: string | undefined): string {
		switch (status?.toUpperCase()) {
			case "OPEN":
				return "badge badge-accent";
			case "REVIEW":
				return "badge badge-warning";
			case "POSTED":
				return "badge badge-success";
			case "ERROR":
				return "badge badge-danger";
			default:
				return "badge badge-muted";
		}
	}

	formatDate(d: string | undefined): string {
		return d ? this.settings.formatDate(d) : "—";
	}

	formatDateTime(d: string | undefined): string {
		return d ? this.settings.formatDate(d) : "—";
	}

	formatCurrency(amount: number | string, currency = "USD"): string {
		return this.settings.formatCurrency(Number(amount), currency);
	}

	private todayString(): string {
		return new Date().toISOString().slice(0, 10);
	}

	private monthStart(): string {
		const d = new Date();
		d.setDate(1);
		return d.toISOString().slice(0, 10);
	}
}
