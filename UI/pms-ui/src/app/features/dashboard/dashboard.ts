import { NgClass } from "@angular/common";
import { Component, effect, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { ActivityItem, DashboardStats, TaskItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { formatCurrency as fmtCurrency, formatTime as fmtTime } from "../../shared/format-utils";

@Component({
	selector: "app-dashboard",
	standalone: true,
	imports: [NgClass, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
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
