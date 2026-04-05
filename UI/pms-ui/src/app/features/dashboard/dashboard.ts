import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { ActivityItem, DashboardStats, TaskItem } from "@tartware/schemas";

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
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	// ── Settings-driven feature flags ────────────────────────────────────────
	/** Show AI-generated revenue forecast card on the dashboard. */
	readonly revenueForecastEnabled = computed(() =>
		this.settings.getBool("advanced.enable_revenue_forecast", false),
	);
	/** Show mobile check-in feature chip. */
	readonly mobileCheckinEnabled = computed(() =>
		this.settings.getBool("advanced.enable_mobile_checkin", true),
	);
	/** Property check-in time formatted per ui.time_format (e.g. "3:00 PM" or "15:00"). */
	readonly checkInTime = computed(() =>
		this.settings.formatTime(this.settings.getString("property.check_in_time", "15:00")),
	);
	/** Property check-out time formatted per ui.time_format (e.g. "11:00 AM" or "11:00"). */
	readonly checkOutTime = computed(() =>
		this.settings.formatTime(this.settings.getString("property.check_out_time", "11:00")),
	);

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

		this.loading.set(true);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const [stats, activity, tasks] = await Promise.all([
				this.api.get<DashboardStats>("/dashboard/stats", params),
				this.api.get<ActivityItem[]>("/dashboard/activity", params).catch(() => []),
				this.api.get<TaskItem[]>("/dashboard/tasks", params).catch(() => []),
			]);
			this.stats.set(stats);
			this.activity.set(activity);
			this.tasks.set(tasks);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load dashboard");
		} finally {
			this.loading.set(false);
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
}
