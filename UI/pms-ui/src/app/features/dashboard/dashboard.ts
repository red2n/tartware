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
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { formatCurrency as fmtCurrency, formatTime as fmtTime } from "../../shared/format-utils";

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

	readonly stats = signal<DashboardStats | null>(null);
	readonly activity = signal<ActivityItem[]>([]);
	readonly tasks = signal<TaskItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

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

	formatCurrency(amount: number, currency: string): string {
		return fmtCurrency(amount, currency, { min: 0, max: 0 });
	}

	formatTime = fmtTime;

	navigateToReservations(): void {
		this.router.navigate(["/reservations"]);
	}
}
