import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";

/**
 * Query contract of a report's backend route, mirroring its Fastify schema.
 * Sending anything else is at best ignored and at worst a 400, so each report
 * declares exactly what its endpoint accepts.
 *
 *  - `range-paged`   start_date + end_date (required) and limit  — DateRangeReportQuery
 *  - `range`         start_date + end_date (required), no paging — finance DateRangeQuery
 *  - `business-date` business_date only
 *  - `paged`         limit only
 */
type ReportQuery = "range-paged" | "range" | "business-date" | "paged";

interface ReportDef {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly path: string;
	readonly query: ReportQuery;
	readonly icon: string;
}

const REPORTS: readonly ReportDef[] = [
	{
		key: "arrivals",
		label: "Arrivals",
		description: "Expected arrivals for the date range.",
		path: "/reports/arrivals",
		query: "range-paged",
		icon: "flight_land",
	},
	{
		key: "departures",
		label: "Departures",
		description: "Expected departures for the date range.",
		path: "/reports/departures",
		query: "range-paged",
		icon: "flight_takeoff",
	},
	{
		key: "in-house",
		label: "In-House",
		description: "Currently in-house guests.",
		path: "/reports/in-house",
		query: "paged",
		icon: "hotel",
	},
	{
		key: "no-show",
		label: "No-Show",
		description: "No-show reservations for the date range.",
		path: "/reports/no-shows",
		query: "range-paged",
		icon: "person_off",
	},
	{
		key: "occupancy",
		label: "Occupancy",
		description: "Occupancy statistics for the date range.",
		path: "/reports/occupancy",
		query: "range-paged",
		icon: "meeting_room",
	},
	{
		key: "revenue-summary",
		label: "Revenue Summary",
		description: "Gross and net revenue broken down by department.",
		path: "/billing/reports/departmental-revenue",
		query: "range",
		icon: "payments",
	},
	{
		key: "str-metrics",
		label: "STR Metrics",
		description: "ADR, RevPAR, TRevPAR and occupancy for the date range.",
		path: "/reports/revenue-kpis",
		query: "range-paged",
		icon: "leaderboard",
	},
	{
		key: "manager-flash",
		label: "Manager Flash",
		description: "Key daily metrics snapshot for management.",
		path: "/reports/flash",
		query: "business-date",
		icon: "flash_on",
	},
	{
		key: "forecast",
		label: "Forecast",
		description: "Demand forecast for the date range.",
		path: "/reports/demand-forecast",
		query: "range-paged",
		icon: "insights",
	},
	{
		key: "housekeeping-status",
		label: "Housekeeping",
		description: "Housekeeping productivity for the business date.",
		path: "/reports/housekeeping-productivity",
		query: "business-date",
		icon: "cleaning_services",
	},
];

type ReportRow = Record<string, unknown>;

@Component({
	selector: "app-reports",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
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
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly reports = REPORTS;
	readonly activeKey = signal<string>(REPORTS[0].key);
	readonly active = computed(() => REPORTS.find((r) => r.key === this.activeKey()) ?? REPORTS[0]);

	readonly businessDate = signal(this.todayString());
	readonly startDate = signal(this.monthStart());
	readonly endDate = signal(this.todayString());

	readonly rows = signal<ReportRow[]>([]);
	readonly raw = signal<unknown>(null);
	readonly dataReady = signal(false);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

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

	setActive(key: string): void {
		this.activeKey.set(key);
	}

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
		try {
			const res = await this.api.get<unknown>(def.path, this.buildParams(def, tenantId, propertyId));
			this.raw.set(res);
			this.rows.set(this.extractRows(res));
		} catch (e) {
			this.rows.set([]);
			this.raw.set(null);
			this.error.set(
				e instanceof Error ? e.message : `Report endpoint ${def.path} is not currently available.`,
			);
		} finally {
			this.loading.set(false);
			this.dataReady.set(true);
		}
	}

	exportCsv(): void {
		const rows = this.rows();
		if (rows.length === 0) {
			this.toast.error("No rows to export");
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
		this.toast.success("Report exported");
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
