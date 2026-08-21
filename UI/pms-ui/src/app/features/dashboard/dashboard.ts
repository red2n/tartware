import { DecimalPipe, NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type {
	ActivityItem,
	DashboardStats,
	HousekeepingTaskListItem,
	HousekeepingTaskStatus,
	PaginatedActivity,
	RateItem,
	RoomGridItem,
	TaskItem,
} from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { SettingsService } from "../../core/settings/settings.service";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { StatCardComponent } from "../../shared/components/stat-card/stat-card";
import { relativeTime } from "../../shared/format-utils";

@Component({
	selector: "app-dashboard",
	standalone: true,
	imports: [
		DecimalPipe,
		NgClass,
		IconComponent,
		ProgressSpinnerModule,
		RouterLink,
		TooltipModule,
		PageHeaderComponent,
		StatCardComponent,
		TranslatePipe,
	],
	templateUrl: "./dashboard.html",
	styleUrl: "./dashboard.scss",
})
export class DashboardComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
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
			const parent = resId ? parentMap.get(resId) : undefined;
			if (parent) {
				parent.children.push(item);
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
	/** Star rating as glyphs — decorative; the pill carries an sr-only numeric label. */
	readonly starRatingStars = computed(() => "★".repeat(this.starRating()));

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

	/** Text alternative for the sparkline — the chart itself is unreadable to AT. */
	readonly sparklineSummary = computed(() => {
		const buckets = this.stats()?.reservation_sparkline;
		if (!buckets?.length) return "";
		const total = buckets.reduce((a, b) => a + b, 0);
		const peak = Math.max(...buckets);
		return `${total} reservations over the last ${buckets.length} weeks, peak ${peak} in a single week`;
	});

	/** Room inventory summary computed from rooms grid data. */
	readonly roomSummary = computed(() => {
		const all = this.rooms();
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

	/** Share of rooms in a ready (clean/inspected) state — drives the housekeeping bar. */
	readonly roomsReadyPct = computed(() => {
		const rm = this.roomSummary();
		return rm && rm.total > 0 ? (rm.clean / rm.total) * 100 : 0;
	});

	/** Rate summary computed from rates data. */
	readonly rateSummary = computed(() => {
		const all = this.rates();
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

	/**
	 * Housekeeping summary computed from tasks data.
	 *
	 * `status` and `priority` are compared upper-cased because housekeeping-service
	 * lowercases both in its row mapper while the column stores them upper — the
	 * same drift `features/housekeeping/housekeeping.ts` already works around at
	 * `canComplete`/`canReopen`. Comparing raw made **every tile below read zero**
	 * regardless of the data.
	 *
	 * The vocabulary is the Postgres enum `housekeeping_status` — CLEAN, DIRTY,
	 * INSPECTED, IN_PROGRESS, DO_NOT_DISTURB. There is no CHECK constraint because
	 * the type itself constrains it, which is why the drift was invisible. The
	 * PENDING / ASSIGNED / COMPLETED values this summary used to count are not
	 * storable at all, so those tiles could only ever read zero.
	 *
	 * DIRTY is "waiting to be cleaned" and DO_NOT_DISTURB is waiting on the guest;
	 * both are outstanding work, so both count as pending.
	 */
	readonly hkSummary = computed(() => {
		const all = this.hkTasks();
		const status = (t: { status?: string | null }): string => (t.status ?? "").toUpperCase();
		const priority = (t: { priority?: string | null }): string => (t.priority ?? "").toUpperCase();
		const is = (t: { status?: string | null }, ...want: HousekeepingTaskStatus[]): boolean =>
			(want as string[]).includes(status(t));
		const pending = all.filter((t) => is(t, "DIRTY", "DO_NOT_DISTURB")).length;
		const inProgress = all.filter((t) => is(t, "IN_PROGRESS")).length;
		const completed = all.filter((t) => is(t, "CLEAN", "INSPECTED")).length;
		const urgent = all.filter((t) => ["URGENT", "HIGH"].includes(priority(t))).length;
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
		if (!tenantId) {
			this.statsReady.set(true);
			this.roomsReady.set(true);
			this.ratesReady.set(true);
			this.activityReady.set(true);
			this.tasksReady.set(true);
			return;
		}

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

	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
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

	/** Exposed for the template — see shared/format-utils. */
	readonly relativeTime = relativeTime;

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
}
