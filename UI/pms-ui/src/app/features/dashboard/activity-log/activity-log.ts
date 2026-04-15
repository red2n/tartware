import { Component, computed, effect, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { ActivityItem, PaginatedActivity } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";

const PAGE_SIZE = 20;

@Component({
	selector: "app-activity-log",
	standalone: true,
	imports: [
		MatIconModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./activity-log.html",
	styleUrl: "./activity-log.scss",
})
export class ActivityLogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);

	readonly items = signal<ActivityItem[]>([]);
	readonly total = signal(0);
	readonly page = signal(0);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	/** Flipped false→true to re-trigger @defer skeleton on each load/refresh. */
	readonly ready = signal(false);

	readonly pageSize = PAGE_SIZE;
	readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
	readonly hasPrev = computed(() => this.page() > 0);
	readonly hasNext = computed(() => this.page() < this.totalPages() - 1);
	readonly pageLabel = computed(() => `Page ${this.page() + 1} of ${this.totalPages()}`);

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.page(); // reload when page changes too
			this.load();
		});
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);
		this.ready.set(false);

		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				limit: String(PAGE_SIZE),
				offset: String(this.page() * PAGE_SIZE),
			};
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const result = await this.api.get<PaginatedActivity>("/dashboard/activity", params);
			this.items.set(result.items);
			this.total.set(result.total);
		} catch {
			this.error.set("Failed to load activity log");
		} finally {
			this.loading.set(false);
			this.ready.set(true);
		}
	}

	prevPage(): void {
		if (this.hasPrev()) this.page.update((p) => p - 1);
	}

	nextPage(): void {
		if (this.hasNext()) this.page.update((p) => p + 1);
	}

	goBack(): void {
		this.router.navigate(["/dashboard"]);
	}

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

	relativeTime(date: Date | string): string {
		const d = new Date(date);
		const now = new Date();
		const diffMs = d.getTime() - now.getTime();
		const absDiffMs = Math.abs(diffMs);
		const diffMins = Math.floor(absDiffMs / 60_000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		const past = diffMs < 0;
		if (diffMins < 1) return "just now";
		if (diffMins < 60) return past ? `${diffMins}m ago` : `in ${diffMins}m`;
		if (diffHours < 24) return past ? `${diffHours}h ago` : `in ${diffHours}h`;
		if (diffDays === 1) return past ? "yesterday" : "tomorrow";
		if (diffDays < 7) return past ? `${diffDays}d ago` : `in ${diffDays}d`;
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	formatDate(date: Date | string): string {
		return new Date(date).toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
}
