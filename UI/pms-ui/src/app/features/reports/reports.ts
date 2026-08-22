import { Component, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { map } from "rxjs";

import { ApiService, ModuleNotEnabledError } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { CalloutComponent } from "../../shared/components/callout/callout";
import { IconComponent } from "../../shared/components/icon/icon";
import { ModuleLockedComponent } from "../../shared/components/module-locked/module-locked";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";
import { REPORTS, type ReportDef } from "./report-defs";

type ReportRow = Record<string, unknown>;

@Component({
	selector: "app-reports",
	standalone: true,
	imports: [
		CalloutComponent,
		FormsModule,
		IconComponent,
		ModuleLockedComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./reports.html",
	styleUrl: "./reports.scss",
})
export class ReportsComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	private readonly route = inject(ActivatedRoute);

	/**
	 * Which report is open comes from the URL, so the sub-sidebar link is the
	 * only thing that selects one. An unknown key falls back to the first report
	 * rather than rendering an empty screen.
	 */
	readonly activeKey = toSignal(
		this.route.paramMap.pipe(map((p) => p.get("reportKey") ?? REPORTS[0].key)),
		{ initialValue: REPORTS[0].key },
	);
	readonly active = computed(() => REPORTS.find((r) => r.key === this.activeKey()) ?? REPORTS[0]);

	readonly businessDate = signal(this.todayString());
	readonly startDate = signal(this.monthStart());
	readonly endDate = signal(this.todayString());

	readonly rows = signal<ReportRow[]>([]);
	readonly raw = signal<unknown>(null);
	readonly dataReady = signal(false);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	/**
	 * Kept apart from `error` because a switched-off module is not a failure —
	 * it gets the "here is how to turn this on" callout, not the red one.
	 */
	readonly moduleLocked = signal<ModuleNotEnabledError | null>(null);

	readonly columns = computed<string[]>(() => {
		const items = this.rows();
		if (items.length === 0) return [];
		const first = items[0];
		return Object.keys(first);
	});

	/**
	 * Skeleton geometry. Column count follows the previous run's table so a
	 * refresh reserves the same width; first load falls back to six.
	 */
	readonly skeletonRows = Array.from({ length: 8 });
	readonly skeletonCols = computed(() =>
		Array.from({ length: Math.min(Math.max(this.columns().length || 6, 3), 8) }),
	);

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.activeKey();
			void this.loadReport();
		});
	}

	/** True when the active report is driven by a single business date. */
	readonly needsBusinessDate = computed(() => this.active().query === "business-date");

	/** True when the active report is driven by a start/end date range. */
	readonly needsRange = computed(() => this.active().query.startsWith("range"));

	/**
	 * Builds the querystring for a report, sending only the keys its route
	 * declares. `start_date`/`end_date` are required by every ranged route, so
	 * they are always sent rather than conditionally omitted.
	 */
	private buildParams(
		def: ReportDef,
		tenantId: string,
		propertyId: string,
	): Record<string, string> {
		const params: Record<string, string> = {
			tenant_id: tenantId,
			property_id: propertyId,
		};

		switch (def.query) {
			case "range-paged":
				params["start_date"] = this.startDate();
				params["end_date"] = this.endDate();
				params["limit"] = "500";
				break;
			case "range":
				params["start_date"] = this.startDate();
				params["end_date"] = this.endDate();
				break;
			case "business-date":
				params["business_date"] = this.businessDate();
				break;
			case "paged":
				params["limit"] = "500";
				break;
		}

		return params;
	}

	async loadReport(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const def = this.active();
		this.loading.set(true);
		this.dataReady.set(false);
		this.error.set(null);
		this.moduleLocked.set(null);
		try {
			const res = await this.api.get<unknown>(
				def.path,
				this.buildParams(def, tenantId, propertyId),
			);
			this.raw.set(res);
			this.rows.set(this.extractRows(res));
		} catch (e) {
			this.rows.set([]);
			this.raw.set(null);
			if (e instanceof ModuleNotEnabledError) {
				this.moduleLocked.set(e);
			} else {
				this.error.set(
					e instanceof Error
						? e.message
						: `Report endpoint ${def.path} is not currently available.`,
				);
			}
		} finally {
			this.loading.set(false);
			this.dataReady.set(true);
		}
	}

	exportCsv(): void {
		const rows = this.rows();
		if (rows.length === 0) {
			this.toast.error(this.i18n.t("No rows to export"));
			return;
		}
		const cols = this.columns();
		const header = cols.join(",");
		const lines = rows.map((row) => cols.map((c) => this.csvCell(row[c])).join(","));
		const csv = [header, ...lines].join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${this.active().key}-${this.todayString()}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		this.toast.success(this.i18n.t("Report exported"));
	}

	formatCell(value: unknown): string {
		if (value === null || value === undefined) return "—";
		if (typeof value === "number") {
			return Number.isInteger(value) ? value.toString() : value.toFixed(2);
		}
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	}

	formatHeader(key: string): string {
		return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	private extractRows(payload: unknown): ReportRow[] {
		if (!payload) return [];
		if (Array.isArray(payload)) return payload as ReportRow[];
		if (typeof payload === "object") {
			const obj = payload as Record<string, unknown>;
			if (Array.isArray(obj["data"])) return obj["data"] as ReportRow[];
			if (Array.isArray(obj["rows"])) return obj["rows"] as ReportRow[];
			if (Array.isArray(obj["items"])) return obj["items"] as ReportRow[];
			if (Array.isArray(obj["results"])) return obj["results"] as ReportRow[];
			// scalar/summary payload — wrap as single row for table render
			return [obj as ReportRow];
		}
		return [];
	}

	private csvCell(value: unknown): string {
		if (value === null || value === undefined) return "";
		const str = typeof value === "object" ? JSON.stringify(value) : String(value);
		if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
		return str;
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
