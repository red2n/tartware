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

interface ReportDef {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly path: string;
	readonly needsDate: boolean;
	readonly needsRange: boolean;
	readonly icon: string;
}

const REPORTS: readonly ReportDef[] = [
	{
		key: "arrivals",
		label: "Arrivals",
		description: "Expected arrivals for the business date.",
		path: "/reports/arrivals",
		needsDate: true,
		needsRange: false,
		icon: "flight_land",
	},
	{
		key: "departures",
		label: "Departures",
		description: "Expected departures for the business date.",
		path: "/reports/departures",
		needsDate: true,
		needsRange: false,
		icon: "flight_takeoff",
	},
	{
		key: "in-house",
		label: "In-House",
		description: "Currently in-house guests.",
		path: "/reports/in-house",
		needsDate: false,
		needsRange: false,
		icon: "hotel",
	},
	{
		key: "no-shows",
		label: "No-Shows",
		description: "No-show reservations for the business date.",
		path: "/reports/no-shows",
		needsDate: true,
		needsRange: false,
		icon: "person_off",
	},
	{
		key: "occupancy",
		label: "Occupancy",
		description: "Occupancy statistics for the date range.",
		path: "/reports/occupancy",
		needsDate: false,
		needsRange: true,
		icon: "meeting_room",
	},
	{
		key: "revenue-kpis",
		label: "Revenue KPIs",
		description: "Revenue KPIs (ADR, RevPAR, TRevPAR, occupancy %) for the date range.",
		path: "/reports/revenue-kpis",
		needsDate: false,
		needsRange: true,
		icon: "payments",
	},
	{
		key: "performance",
		label: "Performance Report",
		description: "Detailed daily revenue, ADR, and RevPAR performance metrics.",
		path: "/reports/performance",
		needsDate: false,
		needsRange: true,
		icon: "trending_up",
	},
	{
		key: "manager-flash",
		label: "Manager Flash",
		description: "Key daily metrics snapshot for management.",
		path: "/reports/flash",
		needsDate: true,
		needsRange: false,
		icon: "flash_on",
	},
	{
		key: "demand-forecast",
		label: "Demand Forecast",
		description: "Forward-looking occupancy and revenue forecast projections.",
		path: "/reports/demand-forecast",
		needsDate: false,
		needsRange: true,
		icon: "insights",
	},
	{
		key: "revenue-forecast",
		label: "Revenue Forecast",
		description: "Scenario-based revenue projections with confidence intervals.",
		path: "/reports/revenue-forecast",
		needsDate: false,
		needsRange: true,
		icon: "query_stats",
	},
	{
		key: "pace",
		label: "Booking Pace",
		description: "Booking pace and pickup trends vs. historical data.",
		path: "/reports/pace",
		needsDate: false,
		needsRange: true,
		icon: "speed",
	},
	{
		key: "vip-arrivals",
		label: "VIP Arrivals",
		description: "Expected VIP guests for the business date range.",
		path: "/reports/vip-arrivals",
		needsDate: true,
		needsRange: true,
		icon: "star",
	},
	{
		key: "guest-statistics",
		label: "Guest Statistics",
		description: "Demographics, nationality, and loyalty tier breakdown.",
		path: "/reports/guest-statistics",
		needsDate: false,
		needsRange: false,
		icon: "analytics",
	},
	{
		key: "market-production",
		label: "Market Segment Production",
		description: "Room nights and revenue breakdown by market segment.",
		path: "/reports/market-segment-production",
		needsDate: false,
		needsRange: true,
		icon: "pie_chart",
	},
	{
		key: "hk-productivity",
		label: "HK Productivity",
		description: "Housekeeping task completion and attendant performance.",
		path: "/reports/housekeeping-productivity",
		needsDate: true,
		needsRange: false,
		icon: "cleaning_services",
	},
	{
		key: "maintenance-sla",
		label: "Maintenance SLA",
		description: "Maintenance request resolution times and priority breakdown.",
		path: "/reports/maintenance-sla",
		needsDate: false,
		needsRange: true,
		icon: "build",
	},
	{
		key: "audit-trail",
		label: "Audit Trail",
		description: "System-wide command execution history log.",
		path: "/reports/audit-trail",
		needsDate: false,
		needsRange: true,
		icon: "history",
	},
	{
		key: "night-audit-summary",
		label: "Night Audit Summary",
		description: "Night audit posting totals, adjustments, and balance.",
		path: "/reports/night-audit-summary",
		needsDate: true,
		needsRange: false,
		icon: "receipt_long",
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

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.activeKey();
			void this.loadReport();
		});
	}

	setActive(key: string): void {
		this.activeKey.set(key);
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
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "500",
			};
			if (def.needsDate && this.businessDate()) {
				params["business_date"] = this.businessDate();
				params["date"] = this.businessDate();
			}
			if (def.needsRange) {
				if (this.startDate()) params["start_date"] = this.startDate();
				if (this.endDate()) params["end_date"] = this.endDate();
			}
			const res = await this.api.get<unknown>(def.path, params);
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
