import { NgClass } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import type { PackageComponentListItem, PackageListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { ToastService } from "../../../shared/toast/toast.service";

type DetailRow = { label: string; value: string; badge?: string; badgeClass?: string };
type InclusionKey = "includes_breakfast" | "includes_lunch" | "includes_dinner" | "includes_parking" | "includes_wifi" | "includes_airport_transfer";

@Component({
	selector: "app-package-detail",
	standalone: true,
	imports: [
		NgClass,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		RouterLink,
	],
	templateUrl: "./package-detail.html",
	styleUrl: "./package-detail.scss",
})
export class PackageDetailComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialog = inject(MatDialog);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly pkg = signal<PackageListItem | null>(null);
	readonly components = signal<PackageComponentListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly updating = signal(false);

	// ── Computed detail rows ──

	readonly infoRows = computed<DetailRow[]>(() => {
		const p = this.pkg();
		if (!p) return [];
		return [
			{ label: "Code", value: p.package_code },
			{ label: "Type", value: p.package_type_display, badge: p.package_type_display, badgeClass: "badge-muted" },
			{ label: "Description", value: p.short_description ?? "—" },
			{ label: "Validity", value: `${this.formatDate(p.valid_from)} — ${this.formatDate(p.valid_to)}` },
		];
	});

	readonly pricingRows = computed<DetailRow[]>(() => {
		const p = this.pkg();
		if (!p) return [];
		const rows: DetailRow[] = [
			{ label: "Base price", value: this.formatCurrency(p.base_price, p.currency_code) },
			{ label: "Pricing model", value: p.pricing_model_display },
			{ label: "Currency", value: p.currency_code },
		];
		if (p.discount_percentage) {
			rows.push({ label: "Discount", value: `${p.discount_percentage}%`, badge: `-${p.discount_percentage}%`, badgeClass: "badge-success" });
		}
		rows.push({ label: "Refundable", value: p.refundable ? "Yes" : "No" });
		if (p.free_cancellation_days != null) {
			rows.push({ label: "Free cancellation", value: `${p.free_cancellation_days} days before arrival` });
		}
		return rows;
	});

	readonly bookingRows = computed<DetailRow[]>(() => {
		const p = this.pkg();
		if (!p) return [];
		return [
			{ label: "Min nights", value: String(p.min_nights) },
			{ label: "Max nights", value: p.max_nights != null ? String(p.max_nights) : "No limit" },
			{ label: "Min guests", value: String(p.min_guests) },
			{ label: "Max guests", value: p.max_guests != null ? String(p.max_guests) : "No limit" },
		];
	});

	readonly inclusionList = computed<{ key: InclusionKey; icon: string; label: string; included: boolean }[]>(() => {
		const p = this.pkg();
		if (!p) return [];
		return [
			{ key: "includes_breakfast" as const, icon: "free_breakfast", label: "Breakfast", included: p.includes_breakfast },
			{ key: "includes_lunch" as const, icon: "lunch_dining", label: "Lunch", included: p.includes_lunch },
			{ key: "includes_dinner" as const, icon: "dinner_dining", label: "Dinner", included: p.includes_dinner },
			{ key: "includes_parking" as const, icon: "local_parking", label: "Parking", included: p.includes_parking },
			{ key: "includes_wifi" as const, icon: "wifi", label: "WiFi", included: p.includes_wifi },
			{ key: "includes_airport_transfer" as const, icon: "airport_shuttle", label: "Airport transfer", included: p.includes_airport_transfer },
		];
	});

	readonly performanceRows = computed<DetailRow[]>(() => {
		const p = this.pkg();
		if (!p) return [];
		const rows: DetailRow[] = [
			{ label: "Total bookings", value: String(p.total_bookings) },
			{ label: "Sold", value: String(p.sold_count) },
		];
		if (p.total_inventory != null) {
			rows.push({ label: "Inventory", value: `${p.available_inventory ?? 0} available / ${p.total_inventory} total` });
		} else {
			rows.push({ label: "Inventory", value: "Unlimited" });
		}
		if (p.total_revenue != null) {
			rows.push({ label: "Total revenue", value: this.formatCurrency(p.total_revenue, p.currency_code) });
		}
		if (p.average_rating != null) {
			rows.push({ label: "Avg. rating", value: `${p.average_rating.toFixed(1)} / 5` });
		}
		return rows;
	});

	readonly statusBadge = computed(() => {
		const p = this.pkg();
		if (!p) return { label: "", cls: "" };
		if (!p.is_active) return { label: "Inactive", cls: "badge-muted" };
		if (!p.is_currently_valid) return { label: "Expired", cls: "badge-warning" };
		return { label: "Active", cls: "badge-success" };
	});

	ngOnInit(): void {
		this.loadDetail();
	}

	async loadDetail(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const packageId = this.route.snapshot.paramMap.get("packageId");
		if (!tenantId || !packageId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const [pkgRes, compRes] = await Promise.all([
				this.api.get<PackageListItem>(`/packages/${packageId}`, { tenant_id: tenantId }),
				this.api.get<{ data: PackageComponentListItem[] }>(`/packages/${packageId}/components`, { tenant_id: tenantId }),
			]);
			this.pkg.set(pkgRes);
			this.components.set(compRes.data);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load package");
		} finally {
			this.loading.set(false);
		}
	}

	goBack(): void {
		this.router.navigate(["/packages"]);
	}

	// ── Display helpers ──

	formatCurrency(amount: number, currency?: string): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency ?? "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	}

	formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	componentTypeIcon(type: string): string {
		const map: Record<string, string> = {
			service: "room_service",
			amenity: "spa",
			meal: "restaurant",
			activity: "directions_run",
			transport: "directions_car",
			equipment: "build",
			entertainment: "celebration",
			beverage: "local_bar",
		};
		return map[type] ?? "category";
	}

	pricingLabel(comp: PackageComponentListItem): string {
		if (comp.is_included) return "Included";
		return this.formatCurrency(comp.unit_price, this.pkg()?.currency_code) + (comp.quantity > 1 ? ` × ${comp.quantity}` : "");
	}

	componentBadgeClass(comp: PackageComponentListItem): string {
		if (comp.is_included) return "badge-success";
		if (comp.is_mandatory) return "badge-warning";
		return "badge-muted";
	}

	componentBadgeLabel(comp: PackageComponentListItem): string {
		if (comp.is_included) return "Included";
		if (comp.is_mandatory) return "Mandatory";
		if (comp.is_optional) return "Optional";
		return "";
	}

	// ── Update methods ──

	async openAddComponent(): Promise<void> {
		const p = this.pkg();
		if (!p) return;

		const { AddComponentDialogComponent } = await import(
			"../add-component-dialog/add-component-dialog"
		);

		const ref = this.dialog.open(AddComponentDialogComponent, {
			width: "560px",
			data: { packageId: p.package_id },
		});

		ref.afterClosed().subscribe((created) => {
			if (created) {
				this.loadDetail();
			}
		});
	}

	async toggleActive(): Promise<void> {
		const p = this.pkg();
		if (!p) return;
		await this.patchPackage({ is_active: !p.is_active });
	}

	async toggleInclusion(key: InclusionKey, value: boolean): Promise<void> {
		await this.patchPackage({ [key]: value });
	}

	private async patchPackage(fields: Record<string, unknown>): Promise<void> {
		const p = this.pkg();
		const tenantId = this.auth.tenantId();
		if (!p || !tenantId) return;

		this.updating.set(true);

		try {
			await this.api.patch(`/packages/${p.package_id}`, {
				tenant_id: tenantId,
				...fields,
			});
			this.toast.success("Package updated");
			await this.loadDetail();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update package");
		} finally {
			this.updating.set(false);
		}
	}
}
