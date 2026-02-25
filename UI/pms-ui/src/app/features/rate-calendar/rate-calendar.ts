import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { formatCurrency, formatShortDate } from "../../shared/format-utils";

/** Minimal rate plan reference. */
type RatePlan = {
	id: string;
	rate_code: string;
	rate_name: string;
	base_rate: number;
	currency: string;
	room_type_id: string;
};

/** Minimal room-type reference. */
type RoomType = {
	room_type_id: string;
	type_name: string;
	type_code: string;
};

/** A single day cell from the API. */
type CalendarEntry = {
	id: string;
	rate_id: string;
	room_type_id: string;
	stay_date: string;
	rate_amount: number;
	currency: string;
	status: string;
	closed_to_arrival: boolean;
	closed_to_departure: boolean;
	min_length_of_stay?: number;
};

/** Internal model for a grid cell. */
type GridCell = {
	date: string;
	rateId: string;
	roomTypeId: string;
	amount: number | null;
	baseRate: number;
	currency: string;
	status: string;
	cta: boolean;
	ctd: boolean;
	minLos?: number;
	dirty: boolean;
};

@Component({
	selector: "app-rate-calendar",
	standalone: true,
	imports: [NgClass, FormsModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
	templateUrl: "./rate-calendar.html",
	styleUrl: "./rate-calendar.scss",
})
export class RateCalendarComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);

	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly success = signal<string | null>(null);

	readonly roomTypes = signal<RoomType[]>([]);
	readonly ratePlans = signal<RatePlan[]>([]);
	readonly calendarEntries = signal<CalendarEntry[]>([]);

	readonly selectedRoomType = signal<string>("");

	/** Start date for the calendar view (YYYY-MM-DD). */
	startDate = this.toDateStr(new Date());
	/** Number of days to show (7 = week, 14 = two weeks, 30 = month). */
	readonly viewDays = signal(14);

	/** Grid cell state keyed by "rateId|date". */
	readonly gridCells = signal<Map<string, GridCell>>(new Map());

	/** Date strings in the visible range. */
	readonly dateColumns = computed(() => {
		const dates: string[] = [];
		const start = new Date(this.startDate + "T00:00:00");
		const days = this.viewDays();
		for (let i = 0; i < days; i++) {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			dates.push(this.toDateStr(d));
		}
		return dates;
	});

	/** Rate plans filtered by selected room type. */
	readonly filteredRates = computed(() => {
		const rtId = this.selectedRoomType();
		if (!rtId) return this.ratePlans();
		return this.ratePlans().filter((r) => r.room_type_id === rtId);
	});

	/** Whether any cells have been modified. */
	readonly hasDirty = computed(() => {
		for (const cell of this.gridCells().values()) {
			if (cell.dirty) return true;
		}
		return false;
	});

	constructor() {
		effect(() => {
			const tenantId = this.auth.tenantId();
			const propertyId = this.ctx.propertyId();
			if (tenantId && propertyId) {
				this.loadReferenceData();
			}
		});
	}

	// ── Data loading ──

	async loadReferenceData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		const params: Record<string, string> = { tenant_id: tenantId };
		const propertyId = this.ctx.propertyId();
		if (propertyId) params["property_id"] = propertyId;

		this.loading.set(true);
		this.error.set(null);
		try {
			const [roomTypes, rates] = await Promise.all([
				this.api.get<RoomType[]>("/room-types", params),
				this.api.get<RatePlan[]>("/rates", { ...params, status: "ACTIVE", limit: "200" }),
			]);
			this.roomTypes.set(Array.isArray(roomTypes) ? roomTypes : []);
			this.ratePlans.set(Array.isArray(rates) ? rates : []);
			await this.loadCalendarData();
		} catch {
			this.error.set("Failed to load reference data");
		} finally {
			this.loading.set(false);
		}
	}

	async loadCalendarData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const dates = this.dateColumns();
		const startDate = dates[0];
		const endDate = dates[dates.length - 1];

		const params: Record<string, string> = {
			tenant_id: tenantId,
			property_id: propertyId,
			start_date: startDate,
			end_date: endDate,
		};
		const rtId = this.selectedRoomType();
		if (rtId) {
			params["room_type_id"] = rtId;
		}

		try {
			const entries = await this.api.get<CalendarEntry[]>("/rate-calendar", params);
			this.calendarEntries.set(Array.isArray(entries) ? entries : []);
			this.rebuildGrid();
		} catch {
			this.error.set("Failed to load rate calendar");
		}
	}

	/** Build the grid cells map from the loaded data. */
	private rebuildGrid(): void {
		const cells = new Map<string, GridCell>();
		const dates = this.dateColumns();
		const rates = this.filteredRates();
		const entries = this.calendarEntries();

		// Index entries by "rateId|date"
		const entryMap = new Map<string, CalendarEntry>();
		for (const e of entries) {
			entryMap.set(`${e.rate_id}|${e.stay_date.slice(0, 10)}`, e);
		}

		for (const rate of rates) {
			for (const date of dates) {
				const key = `${rate.id}|${date}`;
				const entry = entryMap.get(key);
				cells.set(key, {
					date,
					rateId: rate.id,
					roomTypeId: rate.room_type_id,
					amount: entry ? entry.rate_amount : null,
					baseRate: rate.base_rate,
					currency: entry?.currency ?? rate.currency,
					status: entry?.status ?? "OPEN",
					cta: entry?.closed_to_arrival ?? false,
					ctd: entry?.closed_to_departure ?? false,
					minLos: entry?.min_length_of_stay,
					dirty: false,
				});
			}
		}

		this.gridCells.set(cells);
	}

	// ── Grid interaction ──

	getCell(rateId: string, date: string): GridCell | undefined {
		return this.gridCells().get(`${rateId}|${date}`);
	}

	/** Display value for a cell. */
	cellDisplay(rateId: string, date: string): string {
		const cell = this.getCell(rateId, date);
		if (!cell) return "—";
		if (cell.status === "CLOSED" || cell.status === "STOP_SELL") return "—";
		const amount = cell.amount ?? cell.baseRate;
		return formatCurrency(amount, cell.currency, { min: 0, max: 0 });
	}

	/** CSS class for a cell based on its state. */
	cellClass(rateId: string, date: string): string {
		const cell = this.getCell(rateId, date);
		if (!cell) return "";
		const classes: string[] = [];
		if (cell.dirty) classes.push("cell-dirty");
		if (cell.status === "CLOSED" || cell.status === "STOP_SELL") classes.push("cell-closed");
		else if (cell.amount !== null && cell.amount > cell.baseRate) classes.push("cell-premium");
		else if (cell.amount !== null && cell.amount < cell.baseRate) classes.push("cell-discount");
		if (cell.cta) classes.push("cell-cta");
		return classes.join(" ");
	}

	/** Cell tooltip showing restrictions. */
	cellTooltip(rateId: string, date: string): string {
		const cell = this.getCell(rateId, date);
		if (!cell) return "";
		const parts: string[] = [];
		if (cell.amount !== null) {
			const diff = cell.amount - cell.baseRate;
			if (diff > 0) parts.push(`+${formatCurrency(diff, cell.currency)} vs base`);
			else if (diff < 0) parts.push(`${formatCurrency(diff, cell.currency)} vs base`);
			else parts.push("At base rate");
		} else {
			parts.push(`Base: ${formatCurrency(cell.baseRate, cell.currency)}`);
		}
		if (cell.cta) parts.push("CTA: Closed to Arrival");
		if (cell.ctd) parts.push("CTD: Closed to Departure");
		if (cell.minLos) parts.push(`Min LOS: ${cell.minLos}`);
		if (cell.status !== "OPEN") parts.push(`Status: ${cell.status}`);
		return parts.join("\n");
	}

	/** Open inline editor for a cell. */
	editingKey = signal<string | null>(null);
	editingAmount = "";

	startEdit(rateId: string, date: string): void {
		const cell = this.getCell(rateId, date);
		if (!cell) return;
		this.editingKey.set(`${rateId}|${date}`);
		this.editingAmount = String(cell.amount ?? cell.baseRate);
	}

	commitEdit(): void {
		const key = this.editingKey();
		if (!key) return;
		const amount = Number.parseFloat(this.editingAmount);
		if (Number.isNaN(amount) || amount < 0) {
			this.editingKey.set(null);
			return;
		}
		const cells = new Map(this.gridCells());
		const cell = cells.get(key);
		if (cell) {
			cells.set(key, { ...cell, amount, dirty: true });
			this.gridCells.set(cells);
		}
		this.editingKey.set(null);
	}

	cancelEdit(): void {
		this.editingKey.set(null);
	}

	toggleCellStatus(rateId: string, date: string): void {
		const key = `${rateId}|${date}`;
		const cells = new Map(this.gridCells());
		const cell = cells.get(key);
		if (!cell) return;
		const nextStatus = cell.status === "OPEN" ? "CLOSED" : "OPEN";
		cells.set(key, { ...cell, status: nextStatus, dirty: true });
		this.gridCells.set(cells);
	}

	// ── Save ──

	async saveChanges(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const dirtyCells = [...this.gridCells().values()].filter((c) => c.dirty);
		if (dirtyCells.length === 0) return;

		// Group by rate_id + room_type_id
		const groups = new Map<string, GridCell[]>();
		for (const cell of dirtyCells) {
			const key = `${cell.rateId}|${cell.roomTypeId}`;
			const group = groups.get(key) ?? [];
			group.push(cell);
			groups.set(key, group);
		}

		this.saving.set(true);
		this.error.set(null);
		this.success.set(null);

		try {
			for (const [, groupCells] of groups) {
				const first = groupCells[0];
				await this.api.put("/rate-calendar", {
					tenant_id: tenantId,
					property_id: propertyId,
					room_type_id: first.roomTypeId,
					rate_id: first.rateId,
					currency: first.currency,
					source: "MANUAL",
					days: groupCells.map((c) => ({
						stay_date: c.date,
						rate_amount: c.amount ?? c.baseRate,
						status: c.status,
						closed_to_arrival: c.cta,
						closed_to_departure: c.ctd,
						min_length_of_stay: c.minLos,
					})),
				});
			}

			this.success.set(`Saved ${dirtyCells.length} day(s) successfully.`);
			await this.loadCalendarData();
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to save changes");
		} finally {
			this.saving.set(false);
		}
	}

	// ── Navigation ──

	prevPeriod(): void {
		const d = new Date(this.startDate + "T00:00:00");
		d.setDate(d.getDate() - this.viewDays());
		this.startDate = this.toDateStr(d);
		this.loadCalendarData();
	}

	nextPeriod(): void {
		const d = new Date(this.startDate + "T00:00:00");
		d.setDate(d.getDate() + this.viewDays());
		this.startDate = this.toDateStr(d);
		this.loadCalendarData();
	}

	goToToday(): void {
		this.startDate = this.toDateStr(new Date());
		this.loadCalendarData();
	}

	onViewDaysChange(days: number): void {
		this.viewDays.set(days);
		this.loadCalendarData();
	}

	onRoomTypeChange(roomTypeId: string): void {
		this.selectedRoomType.set(roomTypeId);
		this.loadCalendarData();
	}

	onStartDateChange(): void {
		this.loadCalendarData();
	}

	// ── Helpers ──

	formatDate(dateStr: string): string {
		return formatShortDate(dateStr);
	}

	dayOfWeek(dateStr: string): string {
		const d = new Date(dateStr + "T00:00:00");
		return d.toLocaleDateString("en-US", { weekday: "short" });
	}

	dayNum(dateStr: string): string {
		return dateStr.slice(8);
	}

	isWeekend(dateStr: string): boolean {
		const d = new Date(dateStr + "T00:00:00");
		const day = d.getDay();
		return day === 0 || day === 6;
	}

	isToday(dateStr: string): boolean {
		return dateStr === this.toDateStr(new Date());
	}

	ratePlanLabel(rate: RatePlan): string {
		return `${rate.rate_code} — ${rate.rate_name}`;
	}

	roomTypeName(roomTypeId: string): string {
		return this.roomTypes().find((rt) => rt.room_type_id === roomTypeId)?.type_name ?? "";
	}

	fmtCurrency(amount: number, currency: string): string {
		return formatCurrency(amount, currency);
	}

	private toDateStr(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
