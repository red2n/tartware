import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { RoomTypeGridItem } from "@tartware/schemas";
import { TooltipModule } from "primeng/tooltip";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../../core/search/global-search.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { AppDialogService } from "../../../shared/dialog/app-dialog.service";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { filterBySearch } from "../../../shared/search-utils";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-room-types",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		TooltipModule,
		PaginationComponent,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./room-types.html",
	styleUrl: "./room-types.scss",
})
export class RoomTypesComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	readonly settings = inject(SettingsService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialog = inject(AppDialogService);
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);

	readonly roomTypes = signal<RoomTypeGridItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

	readonly filteredRoomTypes = computed(() => {
		let list = this.roomTypes();
		const query = this.globalSearch.query().toLowerCase().trim();

		if (query) {
			list = filterBySearch(list, query, (rt) => [
				rt.type_name,
				rt.type_code,
				rt.description,
				rt.category,
			]);
		}

		return list;
	});

	readonly paginatedRoomTypes = computed(() => {
		const sorted = sortBy(
			this.filteredRoomTypes(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	constructor() {
		effect(
			() => {
				this.globalSearch.query();
				this.currentPage.set(1);
			},
			{ allowSignalWrites: true },
		);

		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadRoomTypes();
		});

		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredRoomTypes().length / this.pageSize));
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
	}

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon = (column: string) => getSortIcon(this.sortState(), column);
	ariaSort = (column: string) => getAriaSort(this.sortState(), column);

	async loadRoomTypes(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) {
			this.dataReady.set(true);
			return;
		}

		this.dataReady.set(false);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const roomTypes = await this.api.get<RoomTypeGridItem[]>("/room-types/grid", params);
			this.roomTypes.set(roomTypes);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load room types");
		} finally {
			this.dataReady.set(true);
		}
	}

	openCreateDialog(): void {
		import("./create-room-type-dialog/create-room-type-dialog").then(
			({ CreateRoomTypeDialogComponent }) => {
				const ref = this.dialog.open(CreateRoomTypeDialogComponent);
				ref?.onClose.subscribe((created: boolean) => {
					if (created) {
						this.toast.success(this.i18n.t("Room type created successfully."));
						this.loadRoomTypes();
					}
				});
			},
		);
	}

	openEditDialog(roomType: RoomTypeGridItem): void {
		import("./create-room-type-dialog/create-room-type-dialog").then(
			({ CreateRoomTypeDialogComponent }) => {
				const ref = this.dialog.open(CreateRoomTypeDialogComponent, {
					data: roomType,
				});
				ref?.onClose.subscribe((saved: boolean) => {
					if (saved) {
						this.toast.success(this.i18n.t("Room type updated successfully."));
						this.loadRoomTypes();
					}
				});
			},
		);
	}

	async deleteRoomType(rt: RoomTypeGridItem, event: Event): Promise<void> {
		event.stopPropagation();
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		if (!confirm(`Delete room type "${rt.type_name}"?`)) return;

		try {
			await this.api.delete(`/room-types/${rt.room_type_id}`, {
				tenant_id: tenantId,
			});
			this.toast.success(this.i18n.t("Room type deleted."));
			this.loadRoomTypes();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to delete room type"));
		}
	}

	currencyLabel(amount: number, currency?: string): string {
		// Intl applies the currency's own ISO 4217 exponent, so a JPY rate reads
		// ¥12,000 rather than "JPY 12000.00" and a KWD rate keeps three decimals.
		return this.settings.formatCurrency(amount, currency);
	}
}
