import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
	type BanquetOrderDaySheetResponse,
	type BanquetOrderDetail,
	BEO_EXECUTABLE_STATUSES,
	BEO_EXECUTION_FLAG,
	BEO_EXECUTION_PREREQUISITE,
	type BeoExecutionStep,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Banquet day sheet — item 5 of ui-gaps/13-sales-catering.md, and the last of
 * that spec's UI list.
 *
 * The other four screens are where sales works. This is where the operation
 * works: one date, every function on it, in the order the rooms are touched,
 * carrying what each department needs — the timeline, the covers, the menu, the
 * dietary counts, the setup and the instructions. It is meant to be printed at
 * the morning meeting and carried around all day, so the layout is a document
 * rather than a table, and `@media print` is a first-class case rather than an
 * afterthought.
 *
 * It is also where the day gets recorded back: the four execution steps slice 3
 * left without a route (setup complete, event start, event end, teardown
 * complete) are the buttons on each card, offered one at a time in the order the
 * service will accept them.
 */

/** A JSONB course list rendered as plain lines — the same shape the editor writes. */
type SheetLine = {
	name: string;
	quantity: number | null;
	description: string;
};

/** The JSONB blocks the kitchen and the setup crew read, in that order. */
const FOOD_BLOCKS = [
	{ key: "appetizers", label: "Appetizers" },
	{ key: "salads", label: "Salads" },
	{ key: "entrees", label: "Entrées" },
	{ key: "sides", label: "Sides" },
	{ key: "desserts", label: "Desserts" },
	{ key: "stations", label: "Stations" },
	{ key: "menu_items", label: "Other menu items" },
] as const;

const SERVICE_BLOCKS = [
	{ key: "beverages", label: "Beverages" },
	{ key: "equipment_list", label: "Equipment" },
	{ key: "av_equipment", label: "Audio visual" },
] as const;

/** Dietary counts, with the label the kitchen plates against. */
const DIETARY_FIELDS = [
	{ key: "vegetarian_count", label: "Vegetarian" },
	{ key: "vegan_count", label: "Vegan" },
	{ key: "gluten_free_count", label: "Gluten free" },
	{ key: "dairy_free_count", label: "Dairy free" },
	{ key: "nut_free_count", label: "Nut free" },
	{ key: "kosher_count", label: "Kosher" },
	{ key: "halal_count", label: "Halal" },
] as const;

/** The steps in the order a day happens; the sheet offers the first one that is due. */
const EXECUTION_STEPS: readonly { step: BeoExecutionStep; label: string; icon: string }[] = [
	{ step: "SETUP_COMPLETE", label: "Setup complete", icon: "checklist" },
	{ step: "EVENT_START", label: "Event started", icon: "play_arrow" },
	{ step: "EVENT_END", label: "Event ended", icon: "stop" },
	{ step: "TEARDOWN_COMPLETE", label: "Teardown complete", icon: "cleaning_services" },
];

@Component({
	selector: "app-day-sheet",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, TranslatePipe],
	templateUrl: "./day-sheet.html",
	styleUrl: "./day-sheet.scss",
})
export class DaySheetComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly foodBlocks = FOOD_BLOCKS;
	readonly serviceBlocks = SERVICE_BLOCKS;
	readonly dietaryFields = DIETARY_FIELDS;

	readonly eventDate = signal(new Date().toISOString().slice(0, 10));
	readonly sheet = signal<BanquetOrderDaySheetResponse | null>(null);
	readonly loading = signal(true);
	readonly recordingBeoId = signal<string | null>(null);

	readonly skeletonRows = Array.from({ length: 3 });

	readonly orders = computed<BanquetOrderDetail[]>(() => this.sheet()?.data ?? []);
	readonly isEmpty = computed(() => !this.loading() && this.orders().length === 0);

	/** Unpublished BEOs are the reason a day sheet is read at a morning meeting. */
	readonly unpublishedCount = computed(() => this.sheet()?.meta.unpublished_count ?? 0);
	readonly guaranteedTotal = computed(() => this.sheet()?.meta.guaranteed_total ?? 0);

	constructor() {
		effect(() => {
			const tenantId = this.auth.tenantId();
			const propertyId = this.ctx.propertyId();
			const date = this.eventDate();
			if (tenantId && propertyId && date) void this.load();
		});
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.loading.set(true);
		try {
			const res = await this.api.get<BanquetOrderDaySheetResponse>("/banquet-orders/day-sheet", {
				tenant_id: tenantId,
				property_id: propertyId,
				event_date: this.eventDate(),
			});
			this.sheet.set(res);
		} catch (e) {
			this.sheet.set(null);
			this.toast.error(e instanceof Error ? e.message : "Failed to load the day sheet");
		} finally {
			this.loading.set(false);
		}
	}

	shiftDay(days: number): void {
		const shifted = new Date(`${this.eventDate()}T00:00:00Z`);
		shifted.setUTCDate(shifted.getUTCDate() + days);
		this.eventDate.set(shifted.toISOString().slice(0, 10));
	}

	today(): void {
		this.eventDate.set(new Date().toISOString().slice(0, 10));
	}

	print(): void {
		window.print();
	}

	openBeo(beoId: string): void {
		void this.router.navigate(["/events/beos", beoId]);
	}

	openBooking(eventBookingId: string): void {
		void this.router.navigate(["/events/bookings", eventBookingId]);
	}

	shortTime(time: string | null | undefined): string {
		return (time ?? "").slice(0, 5);
	}

	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value
			.toLowerCase()
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string): string {
		switch (status) {
			case "APPROVED":
				return "badge badge-accent";
			case "IN_PROGRESS":
				return "badge badge-accent";
			case "COMPLETED":
				return "badge badge-muted";
			case "DRAFT":
			case "PENDING_APPROVAL":
				return "badge badge-warning";
			default:
				return "badge badge-attention";
		}
	}

	/**
	 * The JSONB blocks, read defensively.
	 *
	 * These columns are `unknown` on the read model because their documented
	 * shape is a convention rather than a constraint — a BEO written by an import
	 * or an older screen may hold bare strings. The sheet renders what it can and
	 * shows nothing for what it cannot, because a kitchen sheet that throws is
	 * worse than one missing a line.
	 */
	linesFor(order: BanquetOrderDetail, key: string): SheetLine[] {
		const value = (order as unknown as Record<string, unknown>)[key];
		if (!Array.isArray(value)) return [];
		return value.map((entry) => {
			if (entry && typeof entry === "object") {
				const item = entry as Record<string, unknown>;
				return {
					name: typeof item["name"] === "string" ? item["name"] : "",
					quantity: typeof item["quantity"] === "number" ? item["quantity"] : null,
					description: typeof item["description"] === "string" ? item["description"] : "",
				};
			}
			return { name: String(entry), quantity: null, description: "" };
		});
	}

	hasFood(order: BanquetOrderDetail): boolean {
		return FOOD_BLOCKS.some((block) => this.linesFor(order, block.key).length > 0);
	}

	hasService(order: BanquetOrderDetail): boolean {
		return SERVICE_BLOCKS.some((block) => this.linesFor(order, block.key).length > 0);
	}

	dietaryFor(order: BanquetOrderDetail): { label: string; count: number }[] {
		const row = order as unknown as Record<string, unknown>;
		return DIETARY_FIELDS.map((field) => ({
			label: field.label,
			count: typeof row[field.key] === "number" ? (row[field.key] as number) : 0,
		})).filter((entry) => entry.count > 0);
	}

	/**
	 * Menu type and service style, without saying the same word twice.
	 *
	 * They are separate columns that frequently hold the same value — a plated
	 * menu served plated — and "Plated · Plated" reads as a rendering bug.
	 */
	serviceLabel(order: BanquetOrderDetail): string {
		const menu = this.labelFor(order.menu_type);
		const style = this.labelFor(order.service_style);
		if (!order.service_style || menu === style) return menu;
		if (!order.menu_type) return style;
		return `${menu} · ${style}`;
	}

	/** The staffing line, assembled only from the roles this function actually has. */
	staffingFor(order: BanquetOrderDetail): string {
		const parts: string[] = [];
		const add = (count: number | undefined, noun: string): void => {
			if (count && count > 0) parts.push(`${count} ${noun}${count === 1 ? "" : "s"}`);
		};
		add(order.servers_count, "server");
		add(order.bartenders_count, "bartender");
		add(order.chefs_count, "chef");
		add(order.captains_count, "captain");
		add(order.coat_check_attendants, "coat check");
		add(order.security_guards, "security guard");
		return parts.join(" · ");
	}

	// ── Execution ──

	/** True once the step has been recorded, read from the flag the service sets. */
	isStepDone(order: BanquetOrderDetail, step: BeoExecutionStep): boolean {
		const row = order as unknown as Record<string, unknown>;
		return Boolean(row[BEO_EXECUTION_FLAG[step]]);
	}

	/**
	 * Whether the sheet may offer this step.
	 *
	 * The prerequisite map is the service's own, so a button can never appear for
	 * a move that would 409 — the same reasoning as the lifecycle buttons on the
	 * booking detail. A BEO that is not published, or that has been revised, gets
	 * no buttons at all.
	 */
	canRecord(order: BanquetOrderDetail, step: BeoExecutionStep): boolean {
		if (!BEO_EXECUTABLE_STATUSES.includes(order.beo_status)) return false;
		if (order.is_superseded) return false;
		if (this.isStepDone(order, step)) return false;
		const prerequisite = BEO_EXECUTION_PREREQUISITE[step];
		return !prerequisite || this.isStepDone(order, prerequisite);
	}

	/** The steps, with their state, so the template stays declarative. */
	stepsFor(
		order: BanquetOrderDetail,
	): { step: BeoExecutionStep; label: string; icon: string; done: boolean; available: boolean }[] {
		return EXECUTION_STEPS.map((entry) => ({
			...entry,
			done: this.isStepDone(order, entry.step),
			available: this.canRecord(order, entry.step),
		}));
	}

	async record(order: BanquetOrderDetail, step: BeoExecutionStep): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || this.recordingBeoId()) return;

		this.recordingBeoId.set(order.beo_id);
		try {
			await this.api.post(`/banquet-orders/${order.beo_id}/execution`, {
				tenant_id: tenantId,
				step,
			});
			// The step's own label, not a re-cased enum: the toast should read like
			// the button that was pressed ("Setup complete", not "Setup Complete").
			const label = EXECUTION_STEPS.find((entry) => entry.step === step)?.label ?? step;
			this.toast.success(`${label} recorded on ${order.beo_number}.`);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record the step");
		} finally {
			this.recordingBeoId.set(null);
		}
	}
}
