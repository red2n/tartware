import { DecimalPipe, NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type {
	ActivityItem,
	DashboardStats,
	HousekeepingTaskListItem,
	PaginatedActivity,
	RateItem,
	RoomGridItem,
	TaskItem,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { SettingsService } from "../../core/settings/settings.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";

@Component({
	selector: "app-dashboard",
	standalone: true,
	imports: [
		DecimalPipe,
		NgClass,
		MatIconModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./dashboard.html",
	styleUrl: "./dashboard.scss",
})
export class DashboardComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	readonly settings = inject(SettingsService);

	readonly stats = signal<DashboardStats | null>(null);
	readonly activity = signal<ActivityItem[]>([]);
	readonly tasks = signal<TaskItem[]>([]);
	readonly rooms = signal<RoomGridItem[]>([]);
	readonly rates = signal<RateItem[]>([]);
	readonly hkTasks = signal<HousekeepingTaskListItem[]>([]);
	readonly error = signal<string | null>(null);
	readonly refreshingActivity = signal(false);

	/** Activity items grouped into a tree: reservation parents with their children indented. */
	readonly groupedActivity = computed(() => {
		const items = this.activity();
		if (items.length === 0) return [] as (ActivityItem & { children?: ActivityItem[] })[];

		// Collect reservation parent items (type === 'reservation') by their base id
		const parentMap = new Map<string, ActivityItem & { children: ActivityItem[] }>();
		const result: (ActivityItem & { children?: ActivityItem[] })[] = [];

		// First pass: identify reservation parents
		for (const item of items) {
			if (item.type === "reservation") {
				const parent = { ...item, children: [] as ActivityItem[] };
				parentMap.set(item.id, parent);
				result.push(parent);
			}
		}

		// Second pass: attach children or push as top-level
		for (const item of items) {
			if (item.type === "reservation") continue;
			const resId = item.reservation_id;
			if (resId && parentMap.has(resId)) {
				parentMap.get(resId)!.children.push(item);
			} else {
				result.push(item);
			}
		}

		return result;
	});
	/** True once KPI stats have arrived — triggers @defer for the overview bar and sparkline. */
	readonly statsReady = signal(false);
	/** True once room/HK data has arrived — triggers @defer for Room Availability and Housekeeping cards. */
	readonly roomsReady = signal(false);
	/** True once rates have arrived — triggers @defer for the Rate Plans card. */
	readonly ratesReady = signal(false);
	/** Flipped false→true to re-trigger @defer skeleton on each load/refresh. */
	readonly activityReady = signal(false);
	/** Flipped false→true to re-trigger @defer skeleton on each tasks load. */
	readonly tasksReady = signal(false);

	// ── Settings-driven feature flags ────────────────────────────────────────
	/** Show AI-generated revenue forecast card on the dashboard. */
	readonly revenueForecastEnabled = computed(() =>
		this.settings.getBool("advanced.enable_revenue_forecast", false),
	);
	/** Show mobile check-in feature chip. */
	readonly mobileCheckinEnabled = computed(() =>
		this.settings.getBool("advanced.enable_mobile_checkin", true),
	);
	/** Show dynamic-pricing feature chip. */
	readonly dynamicPricingEnabled = computed(() =>
		this.settings.getBool("advanced.enable_dynamic_pricing", false),
	);
	/** Property check-in time formatted per ui.time_format (e.g. "3:00 PM" or "15:00"). */
	readonly checkInTime = computed(() =>
		this.settings.formatTime(this.settings.getString("property.check_in_time", "15:00")),
	);
	/** Property check-out time formatted per ui.time_format (e.g. "11:00 AM" or "11:00"). */
	readonly checkOutTime = computed(() =>
		this.settings.formatTime(this.settings.getString("property.check_out_time", "11:00")),
	);
	/** Property timezone (e.g. "America/New_York"). */
	readonly timezone = computed(() => this.settings.getString("property.timezone", ""));
	/** Property star rating (e.g. "4", "5"). */
	readonly starRating = computed(() => this.settings.getNumber("property.star_rating", 0));

	/** SVG sparkline path from reservation_sparkline weekly buckets. */
	readonly sparkline = computed(() => {
		const s = this.stats();
		if (!s?.reservation_sparkline?.length) return null;

		const buckets = s.reservation_sparkline;
		const weeks = buckets.length;
		const w = 120;
		const h = 28;
		const max = Math.max(...buckets, 1);
		const step = w / (weeks - 1);

		const points = buckets.map((v, i) => {
			const x = Math.round(i * step * 100) / 100;
			const y = Math.round((1 - v / max) * h * 100) / 100;
			return `${x},${y}`;
		});

		const line = `M${points.join(" L")}`;
		const area = `${line} L${w},${h} L0,${h} Z`;

		return { line, area, width: w, height: h };
	});

	/** Room inventory summary computed from rooms grid data. */
	readonly roomSummary = computed(() => {
		const all = this.rooms();
		if (all.length === 0) return null;
		const total = all.length;
		const occupied = all.filter((r) => r.status === "OCCUPIED").length;
		const available = all.filter((r) => r.status === "AVAILABLE" || r.status === "VACANT").length;
		const blocked = all.filter((r) => r.is_blocked).length;
		const ooo = all.filter((r) => r.is_out_of_order).length;
		const dirty = all.filter((r) => r.housekeeping_status === "DIRTY").length;
		const clean = all.filter(
			(r) => r.housekeeping_status === "CLEAN" || r.housekeeping_status === "INSPECTED",
		).length;
		const inProgress = all.filter((r) => r.housekeeping_status === "IN_PROGRESS").length;
		const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
		return { total, occupied, available, blocked, ooo, dirty, clean, inProgress, occupancyPct };
	});

	/** Rate summary computed from rates data. */
	readonly rateSummary = computed(() => {
		const all = this.rates();
		if (all.length === 0) return null;
		const active = all.filter((r) => r.status === "ACTIVE");
		const baseRates = active.map((r) => r.base_rate).filter((r) => r > 0);
		const minRate = baseRates.length > 0 ? Math.min(...baseRates) : 0;
		const maxRate = baseRates.length > 0 ? Math.max(...baseRates) : 0;
		const avgRate =
			baseRates.length > 0 ? baseRates.reduce((a, b) => a + b, 0) / baseRates.length : 0;
		const mealPlanCount = active.filter(
			(r) => r.meal_plan && r.meal_plan !== "NONE" && r.meal_plan !== "RO",
		).length;
		const strategies = new Set(active.map((r) => r.strategy));
		return {
			total: all.length,
			active: active.length,
			minRate,
			maxRate,
			avgRate,
			mealPlanCount,
			strategies: [...strategies],
		};
	});

	/** Housekeeping summary computed from tasks data. */
	readonly hkSummary = computed(() => {
		const all = this.hkTasks();
		if (all.length === 0) return null;
		const pending = all.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED").length;
		const inProgress = all.filter((t) => t.status === "IN_PROGRESS").length;
		const completed = all.filter(
			(t) => t.status === "COMPLETED" || t.status === "INSPECTED",
		).length;
		const urgent = all.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;
		return { total: all.length, pending, inProgress, completed, urgent };
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadDashboard();
		});
	}

	async loadDashboard(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.error.set(null);
		const params: Record<string, string> = { tenant_id: tenantId };
		const propertyId = this.ctx.propertyId();
		if (propertyId) params["property_id"] = propertyId;

		// Reset all ready signals so each section's @defer re-shows its skeleton
		this.statsReady.set(false);
		this.roomsReady.set(false);
		this.ratesReady.set(false);

		// Fire all fetches concurrently — each section appears as its own data arrives
		void this.loadStats(params);
		void this.loadRooms(params);
		void this.loadRates(params);
		void this.loadActivity();
		void this.loadTasks();
	}

	private async loadStats(params: Record<string, string>): Promise<void> {
		try {
			const stats = await this.api.get<DashboardStats>("/dashboard/stats", params);
			this.stats.set(stats);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load dashboard stats");
		} finally {
			this.statsReady.set(true);
		}
	}

	private async loadRooms(params: Record<string, string>): Promise<void> {
		try {
			const [rooms, hkTasks] = await Promise.all([
				this.api.get<RoomGridItem[]>("/rooms/grid", params).catch(() => [] as RoomGridItem[]),
				this.api
					.get<HousekeepingTaskListItem[]>("/housekeeping/tasks", params)
					.catch(() => [] as HousekeepingTaskListItem[]),
			]);
			this.rooms.set(rooms);
			this.hkTasks.set(hkTasks);
		} finally {
			this.roomsReady.set(true);
		}
	}

	private async loadRates(params: Record<string, string>): Promise<void> {
		try {
			const rates = await this.api
				.get<RateItem[]>("/rates", { ...params, limit: "200" })
				.catch(() => [] as RateItem[]);
			this.rates.set(rates);
		} finally {
			this.ratesReady.set(true);
		}
	}

	private async loadTasks(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.tasksReady.set(false);
		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const result = await this.api
				.get<TaskItem[]>("/dashboard/tasks", params)
				.catch(() => [] as TaskItem[]);
			this.tasks.set(result);
		} finally {
			this.tasksReady.set(true);
		}
	}

	private async loadActivity(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.activityReady.set(false);
		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const result = await this.api
				.get<PaginatedActivity>("/dashboard/activity", { ...params, limit: "5" })
				.catch(() => ({ items: [], total: 0 }) as PaginatedActivity);
			this.activity.set(result.items);
		} finally {
			this.activityReady.set(true);
		}
	}

	trendIcon(trend: string): string {
		switch (trend) {
			case "up":
				return "trending_up";
			case "down":
				return "trending_down";
			default:
				return "trending_flat";
		}
	}

	trendClass(trend: string): string {
		switch (trend) {
			case "up":
				return "trend-up";
			case "down":
				return "trend-down";
			default:
				return "trend-neutral";
		}
	}

	priorityClass(priority: string): string {
		switch (priority) {
			case "urgent":
				return "badge-danger";
			case "high":
				return "badge-warning";
			case "medium":
				return "badge-accent";
			default:
				return "badge-muted";
		}
	}

	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	navigateToReservations(): void {
		this.router.navigate(["/reservations"]);
	}

	navigateToRooms(): void {
		this.router.navigate(["/rooms"]);
	}

	navigateToRates(): void {
		this.router.navigate(["/rates"]);
	}

	navigateToHousekeeping(): void {
		this.router.navigate(["/housekeeping"]);
	}

	navigateToBilling(): void {
		this.router.navigate(["/billing"]);
	}

	/** Manually refresh only the Recent Activity feed. */
	async refreshActivity(): Promise<void> {
		if (this.refreshingActivity()) return;
		this.refreshingActivity.set(true);
		try {
			await this.loadActivity();
		} finally {
			this.refreshingActivity.set(false);
		}
	}

	/** Format a date as a relative time string (e.g. "3h ago", "tomorrow", "Apr 14"). */
	relativeTime(date: Date | string): string {
		const d = new Date(date);
		const now = new Date();
		const diffMs = d.getTime() - now.getTime();
		const absDiffMs = Math.abs(diffMs);
		const diffMins = Math.floor(absDiffMs / 60_000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);
		const isPast = diffMs < 0;

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return isPast ? `${diffMins}m ago` : `in ${diffMins}m`;
		if (diffHours < 24) return isPast ? `${diffHours}h ago` : `in ${diffHours}h`;
		if (diffDays === 1) return isPast ? "yesterday" : "tomorrow";
		if (diffDays < 7) return isPast ? `${diffDays}d ago` : `in ${diffDays}d`;
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	/** Navigate to the full activity log page. */
	navigateToActivityLog(): void {
		this.router.navigate(["/dashboard/activity"]);
	}

	/** Map an activity type key to a human-readable label. */
	activityTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			reservation: "Reservation",
			checkin: "Check-in",
			checkout: "Check-out",
			payment: "Payment",
			maintenance: "Maintenance",
			housekeeping: "Housekeeping",
			cancellation: "Cancellation",
			noshow: "No-show",
			folio: "Folio",
		};
		return labels[type] ?? type.replace(/_/g, " ");
	}

	/** Legend entries shown above the timeline. */
	readonly activityLegend = [
		{ type: "checkin", label: "Check-in" },
		{ type: "checkout", label: "Check-out" },
		{ type: "reservation", label: "Reservation" },
		{ type: "cancellation", label: "Cancellation" },
		{ type: "noshow", label: "No-show" },
		{ type: "payment", label: "Payment" },
		{ type: "folio", label: "Folio" },
		{ type: "housekeeping", label: "Housekeeping" },
	];
}
