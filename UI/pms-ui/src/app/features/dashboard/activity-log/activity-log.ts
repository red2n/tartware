import { Component, computed, effect, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import type { ActivityItem, PaginatedActivity } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { relativeTime } from "../../../shared/format-utils";

const PAGE_SIZE = 20;

@Component({
	selector: "app-activity-log",
	standalone: true,
	imports: [
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./activity-log.html",
	styleUrl: "./activity-log.scss",
})
export class ActivityLogComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
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

	/** Items grouped into a tree: reservation parents with their children indented. */
	readonly groupedItems = computed(() => {
		const items = this.items();
		if (items.length === 0) return [] as (ActivityItem & { children?: ActivityItem[] })[];

		const parentMap = new Map<string, ActivityItem & { children: ActivityItem[] }>();
		const result: (ActivityItem & { children?: ActivityItem[] })[] = [];

		for (const item of items) {
			if (item.type === "reservation") {
				const parent = { ...item, children: [] as ActivityItem[] };
				parentMap.set(item.id, parent);
				result.push(parent);
			}
		}

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

	readonly pageSize = PAGE_SIZE;
	readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
	readonly hasPrev = computed(() => this.page() > 0);
	readonly hasNext = computed(() => this.page() < this.totalPages() - 1);
	readonly pageLabel = computed(() =>
		this.i18n.t("Page {current} of {total}", {
			current: this.page() + 1,
			total: this.totalPages(),
		}),
	);

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
			this.error.set(this.i18n.t("Failed to load activity log"));
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

	/** Exposed for the template — see shared/format-utils. */
	readonly relativeTime = relativeTime;

	formatDate(date: Date | string): string {
		return new Date(date).toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
}
