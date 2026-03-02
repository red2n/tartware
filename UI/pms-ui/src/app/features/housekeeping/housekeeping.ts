import { DatePipe, NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router, RouterLink } from "@angular/router";

import type { HousekeepingTaskListItem, RoomItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { housekeepingStatusClass, roomStatusClass } from "../../shared/badge-utils";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { ToastService } from "../../shared/toast/toast.service";

type HkFilter = "ALL" | "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED" | "DO_NOT_DISTURB";
type ViewTab = "rooms" | "tasks";
type SortField = "room_number" | "floor" | "room_type_name" | "status" | "housekeeping_status";
type SortDir = "asc" | "desc";

@Component({
	selector: "app-housekeeping",
	standalone: true,
	imports: [
		DatePipe,
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatMenuModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		RouterLink,
		PaginationComponent,
	],
	templateUrl: "./housekeeping.html",
	styleUrl: "./housekeeping.scss",
})
export class HousekeepingComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly toastService = inject(ToastService);

	// ── View state ──
	readonly activeView = signal<ViewTab>("rooms");
	readonly activeFilter = signal<HkFilter>("ALL");
	readonly searchQuery = signal("");
	readonly currentPage = signal(1);
	readonly pageSize = 30;
	readonly sortField = signal<SortField>("room_number");
	readonly sortDir = signal<SortDir>("asc");

	// ── Room data ──
	readonly rooms = signal<RoomItem[]>([]);
	readonly loadingRooms = signal(false);
	readonly roomError = signal<string | null>(null);

	// ── Task data ──
	readonly tasks = signal<HousekeepingTaskListItem[]>([]);
	readonly loadingTasks = signal(false);
	readonly taskError = signal<string | null>(null);

	// ── Action state ──
	readonly updatingRoomId = signal<string | null>(null);

	// ── Filter definitions ──
	readonly statusFilters: { key: HkFilter; label: string; icon: string }[] = [
		{ key: "ALL", label: "All", icon: "hotel" },
		{ key: "DIRTY", label: "Dirty", icon: "warning" },
		{ key: "IN_PROGRESS", label: "In Progress", icon: "cleaning_services" },
		{ key: "CLEAN", label: "Clean", icon: "check_circle" },
		{ key: "INSPECTED", label: "Inspected", icon: "verified" },
		{ key: "DO_NOT_DISTURB", label: "DND", icon: "do_not_disturb" },
	];

	readonly hkActions: { value: string; label: string; icon: string }[] = [
		{ value: "CLEAN", label: "Mark Clean", icon: "check_circle" },
		{ value: "DIRTY", label: "Mark Dirty", icon: "warning" },
		{ value: "IN_PROGRESS", label: "In Progress", icon: "cleaning_services" },
		{ value: "INSPECTED", label: "Inspected", icon: "verified" },
		{ value: "DO_NOT_DISTURB", label: "Do Not Disturb", icon: "do_not_disturb" },
	];

	readonly occupancyActions: { value: string; label: string; icon: string }[] = [
		{ value: "AVAILABLE", label: "Available", icon: "check_circle" },
		{ value: "OCCUPIED", label: "Occupied", icon: "person" },
		{ value: "DIRTY", label: "Vacant Dirty", icon: "warning" },
		{ value: "OUT_OF_ORDER", label: "Out of Order", icon: "build" },
		{ value: "OUT_OF_SERVICE", label: "Out of Service", icon: "block" },
	];

	/**
	 * Effective HK status: if the room occupancy status is "dirty" (Vacant Dirty / post-checkout),
	 * treat it as needing cleaning regardless of the housekeeping_status field.
	 * This aligns with PMS industry semantics: VD rooms need housekeeping attention.
	 */
	effectiveHkStatus(room: RoomItem): string {
		const hk = room.housekeeping_status.toUpperCase();
		const roomStatus = room.status.toUpperCase();
		// If room is Vacant Dirty but HK says clean, the room still needs cleaning
		if (roomStatus === "DIRTY" && hk === "CLEAN") return "DIRTY";
		return hk;
	}

	// ── KPI summary computed from room data ──
	readonly summary = computed(() => {
		const all = this.rooms();
		const total = all.length;
		const dirty = all.filter((r) => this.effectiveHkStatus(r) === "DIRTY").length;
		const inProgress = all.filter((r) => this.effectiveHkStatus(r) === "IN_PROGRESS").length;
		const clean = all.filter((r) => this.effectiveHkStatus(r) === "CLEAN").length;
		const inspected = all.filter((r) => this.effectiveHkStatus(r) === "INSPECTED").length;
		const dnd = all.filter((r) => this.effectiveHkStatus(r) === "DO_NOT_DISTURB").length;
		const readyPct = total > 0 ? Math.round(((clean + inspected) / total) * 100) : 0;
		return { total, dirty, inProgress, clean, inspected, dnd, readyPct };
	});

	readonly filterCounts = computed(() => {
		const s = this.summary();
		return {
			ALL: s.total,
			DIRTY: s.dirty,
			IN_PROGRESS: s.inProgress,
			CLEAN: s.clean,
			INSPECTED: s.inspected,
			DO_NOT_DISTURB: s.dnd,
		};
	});

	readonly filteredRooms = computed(() => {
		let list = this.rooms();
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase().trim();

		if (filter !== "ALL") {
			list = list.filter((r) => this.effectiveHkStatus(r) === filter);
		}

		if (query) {
			list = list.filter(
				(r) =>
					r.room_number.toLowerCase().includes(query) ||
					(r.room_name?.toLowerCase().includes(query) ?? false) ||
					(r.room_type_name?.toLowerCase().includes(query) ?? false) ||
					(r.floor?.toLowerCase().includes(query) ?? false),
			);
		}

		// Sort
		const field = this.sortField();
		const dir = this.sortDir() === "asc" ? 1 : -1;
		return [...list].sort((a, b) => {
			const av = (a[field] ?? "").toString().toLowerCase();
			const bv = (b[field] ?? "").toString().toLowerCase();
			return av < bv ? -dir : av > bv ? dir : 0;
		});
	});

	readonly paginatedRooms = computed(() => {
		const start = (this.currentPage() - 1) * this.pageSize;
		return this.filteredRooms().slice(start, start + this.pageSize);
	});

	readonly filteredTasks = computed(() => {
		const query = this.searchQuery().toLowerCase().trim();
		if (!query) return this.tasks();
		return this.tasks().filter(
			(t) =>
				t.room_number.toLowerCase().includes(query) ||
				t.task_type.toLowerCase().includes(query) ||
				(t.status_display?.toLowerCase().includes(query) ?? false),
		);
	});

	readonly paginatedTasks = computed(() => {
		const start = (this.currentPage() - 1) * this.pageSize;
		return this.filteredTasks().slice(start, start + this.pageSize);
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadRooms();
			this.loadTasks();
		});

		effect(
			() => {
				const total =
					this.activeView() === "rooms" ? this.filteredRooms().length : this.filteredTasks().length;
				const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
	}

	// ── View / filter ──

	setView(view: ViewTab): void {
		this.activeView.set(view);
		this.currentPage.set(1);
		this.searchQuery.set("");
	}

	setFilter(filter: HkFilter): void {
		this.activeFilter.set(filter);
		this.currentPage.set(1);
	}

	onSearch(value: string): void {
		this.searchQuery.set(value);
		this.currentPage.set(1);
	}

	// ── Sort ──

	onSort(field: SortField): void {
		if (this.sortField() === field) {
			this.sortDir.set(this.sortDir() === "asc" ? "desc" : "asc");
		} else {
			this.sortField.set(field);
			this.sortDir.set("asc");
		}
	}

	sortIcon(field: SortField): string {
		if (this.sortField() !== field) return "unfold_more";
		return this.sortDir() === "asc" ? "arrow_upward" : "arrow_downward";
	}

	ariaSort(field: SortField): string {
		if (this.sortField() !== field) return "none";
		return this.sortDir() === "asc" ? "ascending" : "descending";
	}

	// ── Style helpers ──

	statusClass = roomStatusClass;
	hkClass = housekeepingStatusClass;

	taskTypeLabel(type: string): string {
		return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	priorityClass(priority: string | undefined): string {
		switch (priority?.toUpperCase()) {
			case "URGENT":
				return "badge-danger";
			case "HIGH":
				return "badge-warning";
			case "MEDIUM":
				return "badge-accent";
			default:
				return "badge-muted";
		}
	}

	// ── Row interactions ──

	viewRoom(roomId: string): void {
		this.router.navigate(["/rooms", roomId]);
	}

	/** Available HK actions — exclude the current effective status */
	roomActions(room: RoomItem): { value: string; label: string; icon: string }[] {
		return this.hkActions.filter((a) => a.value !== this.effectiveHkStatus(room));
	}

	/**
	 * Valid occupancy transitions per PMS industry standard (AHLA/HTNG):
	 *
	 *   AVAILABLE (VC)    → OCCUPIED, OUT_OF_ORDER, OUT_OF_SERVICE
	 *   OCCUPIED           → DIRTY (checkout only — cannot skip to AVAILABLE)
	 *   DIRTY (VD)         → OUT_OF_ORDER, OUT_OF_SERVICE
	 *                        (AVAILABLE only after HK marks CLEAN/INSPECTED)
	 *   OUT_OF_ORDER       → DIRTY, or AVAILABLE if HK is CLEAN/INSPECTED
	 *   OUT_OF_SERVICE     → DIRTY, or AVAILABLE if HK is CLEAN/INSPECTED
	 */
	private readonly validOccupancyTransitions: Record<string, string[]> = {
		AVAILABLE: ["OCCUPIED", "OUT_OF_ORDER", "OUT_OF_SERVICE"],
		OCCUPIED: ["DIRTY"],
		DIRTY: ["AVAILABLE", "OUT_OF_ORDER", "OUT_OF_SERVICE"],
		OUT_OF_ORDER: ["AVAILABLE", "DIRTY"],
		OUT_OF_SERVICE: ["AVAILABLE", "DIRTY"],
	};

	roomOccupancyActions(room: RoomItem): { value: string; label: string; icon: string }[] {
		const currentStatus = room.status.toUpperCase();
		const hk = this.effectiveHkStatus(room);
		const isClean = hk === "CLEAN" || hk === "INSPECTED";
		const allowed = this.validOccupancyTransitions[currentStatus] ?? [];

		return this.occupancyActions.filter((a) => {
			if (!allowed.includes(a.value)) return false;
			// AVAILABLE requires room to be clean/inspected first
			if (a.value === "AVAILABLE" && !isClean) return false;
			return true;
		});
	}

	// ── Data loading ──

	async loadRooms(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loadingRooms.set(true);
		this.roomError.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const rooms = await this.api.get<RoomItem[]>("/rooms", params);
			this.rooms.set(rooms);
		} catch (e) {
			this.roomError.set(e instanceof Error ? e.message : "Failed to load rooms");
		} finally {
			this.loadingRooms.set(false);
		}
	}

	async loadTasks(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loadingTasks.set(true);
		this.taskError.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const tasks = await this.api.get<HousekeepingTaskListItem[]>("/housekeeping/tasks", params);
			this.tasks.set(tasks);
		} catch (e) {
			this.taskError.set(e instanceof Error ? e.message : "Failed to load tasks");
		} finally {
			this.loadingTasks.set(false);
		}
	}

	refresh(): void {
		this.loadRooms();
		this.loadTasks();
	}

	async updateRoomHousekeeping(room: RoomItem, newStatus: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.updatingRoomId.set(room.room_id);

		try {
			await this.api.put(`/rooms/${room.room_id}`, {
				tenant_id: tenantId,
				housekeeping_status: newStatus,
			});
			const label = this.hkActions.find((a) => a.value === newStatus)?.label ?? newStatus;
			this.toastService.success(`Room ${room.room_number} → ${label}`);
			await this.loadRooms();
		} catch (e) {
			this.toastService.error(e instanceof Error ? e.message : "Failed to update room");
		} finally {
			this.updatingRoomId.set(null);
		}
	}

	async updateRoomOccupancy(room: RoomItem, newStatus: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.updatingRoomId.set(room.room_id);

		try {
			await this.api.put(`/rooms/${room.room_id}`, {
				tenant_id: tenantId,
				status: newStatus,
			});
			const label = this.occupancyActions.find((a) => a.value === newStatus)?.label ?? newStatus;
			this.toastService.success(`Room ${room.room_number} → ${label}`);
			await this.loadRooms();
		} catch (e) {
			this.toastService.error(e instanceof Error ? e.message : "Failed to update occupancy");
		} finally {
			this.updatingRoomId.set(null);
		}
	}
}
