import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
	type BanquetOrderDetail,
	type BanquetOrderListItem,
	BEO_EDITABLE_STATUSES,
	BEO_PUBLISHABLE_STATUSES,
	eventEndsNextDay,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * BEO editor — item 3 of ui-gaps/13-sales-catering.md.
 *
 * The BEO is the document every department works from on the day: the kitchen
 * cooks from it, the setup crew dresses the room from it, the captain runs
 * service from it. So this screen is built around the thing that makes a BEO a
 * BEO rather than a form — **it stops being editable once it is published**, and
 * every later change is a numbered revision the departments can see they do not
 * have.
 *
 * The rules for that come from `@tartware/schemas`
 * ({@link BEO_EDITABLE_STATUSES}, {@link BEO_PUBLISHABLE_STATUSES}) rather than
 * being restated here, so the screen cannot offer an action the service will
 * refuse — the same reasoning the event booking detail uses for its lifecycle.
 */

const ROOM_SETUPS = [
	"THEATER",
	"CLASSROOM",
	"BANQUET",
	"RECEPTION",
	"U_SHAPE",
	"HOLLOW_SQUARE",
	"BOARDROOM",
	"CABARET",
	"COCKTAIL",
	"CUSTOM",
] as const;

const MENU_TYPES = ["BUFFET", "PLATED", "STATIONS", "COCKTAIL", "FAMILY_STYLE"] as const;
const SERVICE_STYLES = ["BUTLER", "BUFFET", "PLATED", "PASSED"] as const;
const BAR_TYPES = ["OPEN_BAR", "CASH_BAR", "HOST_BAR", "LIMITED_BAR", "NO_BAR"] as const;
const WATER_SERVICE = ["BOTTLED", "PITCHERS", "GLASSES"] as const;
const BILLING_TYPES = ["PER_PERSON", "FLAT_FEE", "CONSUMPTION"] as const;

/**
 * One line on a course, equipment or beverage list.
 *
 * The underlying columns are JSONB arrays whose documented shape is
 * `{name, description, quantity, price, …}`. The screen edits the three fields
 * an operator actually fills in and passes the rest through untouched, so
 * opening a BEO in this editor never silently drops detail entered elsewhere.
 */
type LineItem = {
	name: string;
	quantity: number | null;
	description: string;
	/** Whatever else the stored object carried, preserved on save. */
	rest: Record<string, unknown>;
};

/** The JSONB list columns this screen edits, in the order the kitchen reads them. */
const LIST_FIELDS = [
	{ key: "appetizers", label: "Appetizers" },
	{ key: "salads", label: "Salads" },
	{ key: "entrees", label: "Entrées" },
	{ key: "sides", label: "Sides" },
	{ key: "desserts", label: "Desserts" },
	{ key: "stations", label: "Stations" },
	{ key: "beverages", label: "Beverages" },
	{ key: "menu_items", label: "Other menu items" },
] as const;

const EQUIPMENT_FIELDS = [
	{ key: "equipment_list", label: "Equipment" },
	{ key: "av_equipment", label: "Audio visual" },
] as const;

type ListFieldKey = (typeof LIST_FIELDS)[number]["key"] | (typeof EQUIPMENT_FIELDS)[number]["key"];

type EditForm = {
	// Timeline
	event_date: string;
	setup_start_time: string;
	event_start_time: string;
	event_end_time: string;
	teardown_end_time: string;
	room_release_time: string;
	meal_service_start_time: string;
	meal_service_duration_minutes: number | null;

	// Room and setup
	room_setup: string;
	tables_count: number | null;
	chairs_count: number | null;
	table_configuration: string;

	// Attendance
	guaranteed_count: number | null;
	expected_count: number | null;
	actual_count: number | null;
	over_set_percentage: number | null;
	children_count: number | null;

	// Menu and service
	menu_type: string;
	service_style: string;
	courses_count: number | null;

	// Bar
	bar_type: string;
	bar_start_time: string;
	bar_end_time: string;
	bar_setup_location: string;
	water_service: string;
	coffee_tea_service: boolean;

	// Dietary
	vegetarian_count: number | null;
	vegan_count: number | null;
	gluten_free_count: number | null;
	dairy_free_count: number | null;
	nut_free_count: number | null;
	kosher_count: number | null;
	halal_count: number | null;
	allergy_warnings: string;

	// Décor
	linen_color: string;
	linen_type: string;
	napkin_color: string;
	napkin_fold: string;
	table_skirting: boolean;
	centerpieces: string;
	decor_description: string;
	candles: boolean;
	floral_arrangements: string;

	// Equipment and staging
	stage_required: boolean;
	stage_dimensions: string;
	podium_required: boolean;
	dance_floor_required: boolean;
	special_lighting: boolean;
	lighting_notes: string;

	// Staffing
	servers_count: number | null;
	bartenders_count: number | null;
	chefs_count: number | null;
	captains_count: number | null;
	coat_check_attendants: number | null;
	valet_attendants: number | null;
	security_guards: number | null;
	staff_arrival_time: string;
	staff_meal_time: string;
	staff_break_schedule: string;
	overtime_authorized: boolean;

	// Money
	food_subtotal: number | null;
	beverage_subtotal: number | null;
	equipment_rental_total: number | null;
	labor_charges: number | null;
	service_charge_percent: number | null;
	gratuity_percent: number | null;
	tax_percent: number | null;
	total_estimated: number | null;
	billing_type: string;
	price_per_person: number | null;
	children_price: number | null;

	// Instructions
	kitchen_instructions: string;
	service_instructions: string;
	setup_instructions: string;
	cleanup_instructions: string;
	audio_visual_instructions: string;

	// Notes
	internal_notes: string;
	client_notes: string;

	// JSONB lists
	lists: Record<ListFieldKey, LineItem[]>;
};

@Component({
	selector: "app-beo-editor",
	standalone: true,
	imports: [
		DatePipe,
		FormsModule,
		IconComponent,
		PageHeaderComponent,
		RouterLink,
		SubmitOnEnterDirective,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./beo-editor.html",
	styleUrl: "./beo-editor.scss",
})
export class BeoEditorComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly roomSetups = ROOM_SETUPS;
	readonly menuTypes = MENU_TYPES;
	readonly serviceStyles = SERVICE_STYLES;
	readonly barTypes = BAR_TYPES;
	readonly waterService = WATER_SERVICE;
	readonly billingTypes = BILLING_TYPES;
	readonly listFields = LIST_FIELDS;
	readonly equipmentFields = EQUIPMENT_FIELDS;

	readonly beo = signal<BanquetOrderDetail | null>(null);
	/** Every version of this document, oldest first. */
	readonly versions = signal<BanquetOrderListItem[]>([]);
	readonly loading = signal(true);
	readonly submitting = signal(false);
	readonly notFound = signal(false);

	readonly editing = signal(false);
	readonly form = signal<EditForm | null>(null);

	/** Which confirm card is open, if any. */
	readonly pendingAction = signal<"publish" | "revise" | null>(null);
	readonly revisionReason = signal("");
	readonly notifyClient = signal(false);

	readonly skeletonRows = Array.from({ length: 6 });

	// ── What the document allows right now ──

	/** Editable only while a draft, per the shared rule the service enforces. */
	readonly canEdit = computed(() => {
		const b = this.beo();
		if (!b) return false;
		if (b.is_superseded) return false;
		return BEO_EDITABLE_STATUSES.includes(b.beo_status);
	});

	readonly canPublish = computed(() => {
		const b = this.beo();
		if (!b) return false;
		if (b.is_superseded) return false;
		return BEO_PUBLISHABLE_STATUSES.includes(b.beo_status);
	});

	/** A cancelled or already-revised version cannot be the base of a revision. */
	readonly canRevise = computed(() => {
		const b = this.beo();
		if (!b) return false;
		return !b.is_superseded && b.beo_status !== "CANCELLED";
	});

	/** The version that replaced this one, when this one has been revised. */
	readonly successor = computed<BanquetOrderListItem | null>(() => {
		const b = this.beo();
		if (!b?.is_superseded) return null;
		return (
			this.versions().find(
				(v) => v.beo_number === b.beo_number && (v.beo_version ?? 1) > (b.beo_version ?? 1),
			) ?? null
		);
	});

	/** Head count the kitchen cooks to: the guarantee plus the over-set. */
	readonly overSetCover = computed(() => {
		const b = this.beo();
		if (!b) return null;
		const pct = Number(b.over_set_percentage ?? 0);
		if (!Number.isFinite(pct) || pct <= 0) return null;
		return Math.ceil(b.guaranteed_count * (1 + pct / 100));
	});

	/** Special diets are only reconcilable against a real head count. */
	readonly dietaryTotal = computed(() => {
		const b = this.beo();
		if (!b) return 0;
		return (
			(b.vegetarian_count ?? 0) +
			(b.vegan_count ?? 0) +
			(b.gluten_free_count ?? 0) +
			(b.dairy_free_count ?? 0) +
			(b.nut_free_count ?? 0) +
			(b.kosher_count ?? 0) +
			(b.halal_count ?? 0)
		);
	});

	/**
	 * True when the special diets alone outnumber the guarantee.
	 *
	 * Not an error — the counts overlap by nature (a vegan meal is also dairy
	 * free) — but past the guarantee it usually means someone double-counted, and
	 * the kitchen would rather be asked before it orders.
	 */
	readonly dietaryOverGuarantee = computed(() => {
		const b = this.beo();
		if (!b) return false;
		return this.dietaryTotal() > b.guaranteed_count;
	});

	constructor() {
		const id = this.route.snapshot.paramMap.get("beoId");
		if (id) void this.load(id);
		else this.notFound.set(true);
	}

	// ── Display helpers ──

	/** `IN_PROGRESS` becomes "In Progress" — lowercase first, or it shouts. */
	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value
			.toLowerCase()
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	shortTime(time: string | null | undefined): string {
		return (time ?? "").slice(0, 5);
	}

	/**
	 * Trims a `DECIMAL` that arrived as text: `5.00` reads as `5`.
	 *
	 * The money and percentage columns are cast `::TEXT` by the query, so they
	 * keep the column's scale — a 5% over-set otherwise renders "5.00% over-set",
	 * which reads like a precision nobody entered.
	 */
	trimDecimal(value: string | null | undefined): string {
		if (value == null || value === "") return "—";
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return value;
		return String(parsed);
	}

	statusClass(status: string): string {
		switch (status) {
			case "APPROVED":
			case "IN_PROGRESS":
				return "badge badge-accent";
			case "PENDING_APPROVAL":
				return "badge badge-warning";
			case "COMPLETED":
				return "badge badge-muted";
			case "CANCELLED":
				return "badge badge-danger";
			default:
				return "badge badge-muted";
		}
	}

	/** JSONB arrays arrive as `unknown`; read them defensively. */
	private toLineItems(value: unknown): LineItem[] {
		if (!Array.isArray(value)) return [];
		return value.map((entry) => {
			if (typeof entry === "string") {
				return { name: entry, quantity: null, description: "", rest: {} };
			}
			if (entry && typeof entry === "object") {
				const { name, quantity, description, ...rest } = entry as Record<string, unknown> & {
					name?: unknown;
				};
				return {
					name: typeof name === "string" ? name : "",
					quantity: typeof quantity === "number" ? quantity : null,
					description: typeof description === "string" ? description : "",
					rest,
				};
			}
			return { name: String(entry), quantity: null, description: "", rest: {} };
		});
	}

	/** Back to JSONB, keeping any keys the screen does not edit. */
	private fromLineItems(items: LineItem[]): Record<string, unknown>[] {
		return items
			.filter((item) => item.name.trim().length > 0)
			.map((item) => ({
				...item.rest,
				name: item.name.trim(),
				...(item.quantity != null ? { quantity: item.quantity } : {}),
				...(item.description.trim() ? { description: item.description.trim() } : {}),
			}));
	}

	/** Read view: the stored list for one JSONB column. */
	itemsFor(key: ListFieldKey): LineItem[] {
		const b = this.beo();
		if (!b) return [];
		return this.toLineItems((b as unknown as Record<string, unknown>)[key]);
	}

	formItemsFor(key: ListFieldKey): LineItem[] {
		return this.form()?.lists[key] ?? [];
	}

	// ── Loading ──

	async load(beoId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			// The BEO by-id route replies `{ data }` where the event booking route
			// replies the bare object, so unwrap either shape rather than assuming.
			const res = await this.api.get<{ data: BanquetOrderDetail } | BanquetOrderDetail>(
				`/banquet-orders/${beoId}`,
				{ tenant_id: tenantId },
			);
			const detail = "data" in res ? res.data : res;
			this.beo.set(detail);
			this.notFound.set(false);
			await this.loadVersions(detail.event_booking_id);
		} catch (e) {
			this.notFound.set(true);
			this.toast.error(e instanceof Error ? e.message : "Failed to load the BEO");
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Every version raised against the same booking.
	 *
	 * Revisions share `event_booking_id`, so one filtered read gives the whole
	 * revision history without walking `previous_beo_id` one request at a time.
	 */
	private async loadVersions(eventBookingId: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const res = await this.api.get<{ data: BanquetOrderListItem[] } | BanquetOrderListItem[]>(
				"/banquet-orders",
				{
					tenant_id: tenantId,
					event_booking_id: eventBookingId,
					limit: "200",
				},
			);
			this.versions.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch {
			// The history is context, not the document — a failure here must not
			// take down the screen the operator came for.
			this.versions.set([]);
		}
	}

	/** Only the versions of the document being viewed, oldest first. */
	readonly history = computed<BanquetOrderListItem[]>(() => {
		const number = this.beo()?.beo_number;
		if (!number) return [];
		return this.versions()
			.filter((v) => v.beo_number === number)
			.sort((a, b) => (a.beo_version ?? 1) - (b.beo_version ?? 1));
	});

	async reload(): Promise<void> {
		const id = this.beo()?.beo_id;
		if (id) await this.load(id);
	}

	openVersion(beoId: string): void {
		if (beoId === this.beo()?.beo_id) return;
		void this.router.navigate(["/events/beos", beoId]).then(() => this.load(beoId));
	}

	backToBooking(): void {
		const id = this.beo()?.event_booking_id;
		if (id) void this.router.navigate(["/events/bookings", id]);
		else void this.router.navigate(["/events/calendar"]);
	}

	// ── Editing ──

	openEdit(): void {
		const b = this.beo();
		if (!b) return;
		const lists = {} as Record<ListFieldKey, LineItem[]>;
		for (const field of [...LIST_FIELDS, ...EQUIPMENT_FIELDS]) {
			lists[field.key] = this.toLineItems((b as unknown as Record<string, unknown>)[field.key]);
		}

		this.form.set({
			event_date: b.event_date.slice(0, 10),
			setup_start_time: this.shortTime(b.setup_start_time),
			event_start_time: this.shortTime(b.event_start_time),
			event_end_time: this.shortTime(b.event_end_time),
			teardown_end_time: this.shortTime(b.teardown_end_time),
			room_release_time: this.shortTime(b.room_release_time),
			meal_service_start_time: this.shortTime(b.meal_service_start_time),
			meal_service_duration_minutes: b.meal_service_duration_minutes ?? null,

			room_setup: b.room_setup,
			tables_count: b.tables_count ?? null,
			chairs_count: b.chairs_count ?? null,
			table_configuration: b.table_configuration ?? "",

			guaranteed_count: b.guaranteed_count,
			expected_count: b.expected_count ?? null,
			actual_count: b.actual_count ?? null,
			over_set_percentage: this.toNumber(b.over_set_percentage),
			children_count: b.children_count ?? null,

			menu_type: b.menu_type ?? "",
			service_style: b.service_style ?? "",
			courses_count: b.courses_count ?? null,

			bar_type: b.bar_type ?? "",
			bar_start_time: this.shortTime(b.bar_start_time),
			bar_end_time: this.shortTime(b.bar_end_time),
			bar_setup_location: b.bar_setup_location ?? "",
			water_service: b.water_service ?? "",
			coffee_tea_service: b.coffee_tea_service ?? false,

			vegetarian_count: b.vegetarian_count ?? null,
			vegan_count: b.vegan_count ?? null,
			gluten_free_count: b.gluten_free_count ?? null,
			dairy_free_count: b.dairy_free_count ?? null,
			nut_free_count: b.nut_free_count ?? null,
			kosher_count: b.kosher_count ?? null,
			halal_count: b.halal_count ?? null,
			allergy_warnings: b.allergy_warnings ?? "",

			linen_color: b.linen_color ?? "",
			linen_type: b.linen_type ?? "",
			napkin_color: b.napkin_color ?? "",
			napkin_fold: b.napkin_fold ?? "",
			table_skirting: b.table_skirting ?? false,
			centerpieces: b.centerpieces ?? "",
			decor_description: b.decor_description ?? "",
			candles: b.candles ?? false,
			floral_arrangements: b.floral_arrangements ?? "",

			stage_required: b.stage_required ?? false,
			stage_dimensions: b.stage_dimensions ?? "",
			podium_required: b.podium_required ?? false,
			dance_floor_required: b.dance_floor_required ?? false,
			special_lighting: b.special_lighting ?? false,
			lighting_notes: b.lighting_notes ?? "",

			servers_count: b.servers_count ?? null,
			bartenders_count: b.bartenders_count ?? null,
			chefs_count: b.chefs_count ?? null,
			captains_count: b.captains_count ?? null,
			coat_check_attendants: b.coat_check_attendants ?? null,
			valet_attendants: b.valet_attendants ?? null,
			security_guards: b.security_guards ?? null,
			staff_arrival_time: this.shortTime(b.staff_arrival_time),
			staff_meal_time: this.shortTime(b.staff_meal_time),
			staff_break_schedule: b.staff_break_schedule ?? "",
			overtime_authorized: b.overtime_authorized ?? false,

			food_subtotal: this.toNumber(b.food_subtotal),
			beverage_subtotal: this.toNumber(b.beverage_subtotal),
			equipment_rental_total: this.toNumber(b.equipment_rental_total),
			labor_charges: this.toNumber(b.labor_charges),
			service_charge_percent: this.toNumber(b.service_charge_percent),
			gratuity_percent: this.toNumber(b.gratuity_percent),
			tax_percent: this.toNumber(b.tax_percent),
			total_estimated: this.toNumber(b.total_estimated),
			billing_type: b.billing_type ?? "",
			price_per_person: this.toNumber(b.price_per_person),
			children_price: this.toNumber(b.children_price),

			kitchen_instructions: b.kitchen_instructions ?? "",
			service_instructions: b.service_instructions ?? "",
			setup_instructions: b.setup_instructions ?? "",
			cleanup_instructions: b.cleanup_instructions ?? "",
			audio_visual_instructions: b.audio_visual_instructions ?? "",

			internal_notes: b.internal_notes ?? "",
			client_notes: b.client_notes ?? "",

			lists,
		});
		this.editing.set(true);
	}

	/** Money and percentages arrive as strings — the query casts them `::TEXT`. */
	private toNumber(value: string | null | undefined): number | null {
		if (value == null || value === "") return null;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	cancelEdit(): void {
		this.editing.set(false);
		this.form.set(null);
	}

	patchForm(patch: Partial<EditForm>): void {
		const current = this.form();
		if (current) this.form.set({ ...current, ...patch });
	}

	// ── JSONB list editing ──

	addLine(key: ListFieldKey): void {
		const f = this.form();
		if (!f) return;
		this.form.set({
			...f,
			lists: {
				...f.lists,
				[key]: [...f.lists[key], { name: "", quantity: null, description: "", rest: {} }],
			},
		});
	}

	removeLine(key: ListFieldKey, index: number): void {
		const f = this.form();
		if (!f) return;
		this.form.set({
			...f,
			lists: { ...f.lists, [key]: f.lists[key].filter((_, i) => i !== index) },
		});
	}

	patchLine(key: ListFieldKey, index: number, patch: Partial<LineItem>): void {
		const f = this.form();
		if (!f) return;
		this.form.set({
			...f,
			lists: {
				...f.lists,
				[key]: f.lists[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
			},
		});
	}

	// ── Saving ──

	/**
	 * Mirrors the write schema's own bounds so the button is dead before the
	 * request is, rather than the operator learning from a 400.
	 */
	readonly canSave = computed(() => {
		const f = this.form();
		if (!f) return false;
		if (f.guaranteed_count == null || f.guaranteed_count <= 0) return false;
		if (!f.event_start_time || !f.event_end_time) return false;
		// Only the rule `beo_time_check` actually enforces, which is now just
		// "not zero-length". Setup, teardown and the event's own end are all bare
		// times with no date, so under the day-boundary convention an end at or
		// before the start is the next morning — comparing the strings for order
		// would refuse a perfectly ordinary late function.
		if (f.event_end_time === f.event_start_time) return false;
		return true;
	});

	/**
	 * Day-boundary markers, same rule and same reason as the event booking
	 * screens: the BEO stores one `event_date` and bare times, so the day an
	 * evening function ends is inferred and has to be said out loud.
	 */
	readonly formEndsNextDay = computed(() => {
		const f = this.form();
		return Boolean(
			f?.event_start_time &&
				f.event_end_time &&
				eventEndsNextDay(f.event_start_time, f.event_end_time),
		);
	});

	readonly formTeardownIsNextDay = computed(() => {
		const f = this.form();
		return Boolean(
			f?.event_start_time &&
				f.teardown_end_time &&
				eventEndsNextDay(f.event_start_time, f.teardown_end_time),
		);
	});

	/** The saved BEO, for the read-only summary rows. */
	readonly beoEndsNextDay = computed(() => {
		const b = this.beo();
		return Boolean(b && eventEndsNextDay(b.event_start_time, b.event_end_time));
	});

	readonly beoTeardownIsNextDay = computed(() => {
		const b = this.beo();
		if (!b?.teardown_end_time) return false;
		return eventEndsNextDay(b.event_start_time, b.teardown_end_time);
	});

	async save(): Promise<void> {
		const b = this.beo();
		const f = this.form();
		const tenantId = this.auth.tenantId();
		if (!b || !f || !tenantId || !this.canSave() || this.submitting()) return;

		this.submitting.set(true);
		try {
			const lists: Record<string, unknown> = {};
			for (const field of [...LIST_FIELDS, ...EQUIPMENT_FIELDS]) {
				lists[field.key] = this.fromLineItems(f.lists[field.key]);
			}

			await this.api.put(`/banquet-orders/${b.beo_id}`, {
				tenant_id: tenantId,
				event_date: f.event_date,
				setup_start_time: f.setup_start_time,
				event_start_time: f.event_start_time,
				event_end_time: f.event_end_time,
				room_setup: f.room_setup,
				guaranteed_count: f.guaranteed_count,
				coffee_tea_service: f.coffee_tea_service,
				table_skirting: f.table_skirting,
				candles: f.candles,
				stage_required: f.stage_required,
				podium_required: f.podium_required,
				dance_floor_required: f.dance_floor_required,
				special_lighting: f.special_lighting,
				overtime_authorized: f.overtime_authorized,
				...lists,
				...this.optionalTime("teardown_end_time", f.teardown_end_time),
				...this.optionalTime("room_release_time", f.room_release_time),
				...this.optionalTime("meal_service_start_time", f.meal_service_start_time),
				...this.optionalTime("bar_start_time", f.bar_start_time),
				...this.optionalTime("bar_end_time", f.bar_end_time),
				...this.optionalTime("staff_arrival_time", f.staff_arrival_time),
				...this.optionalTime("staff_meal_time", f.staff_meal_time),
				...this.optionalText("table_configuration", f.table_configuration),
				...this.optionalText("menu_type", f.menu_type),
				...this.optionalText("service_style", f.service_style),
				...this.optionalText("bar_type", f.bar_type),
				...this.optionalText("bar_setup_location", f.bar_setup_location),
				...this.optionalText("water_service", f.water_service),
				...this.optionalText("allergy_warnings", f.allergy_warnings),
				...this.optionalText("linen_color", f.linen_color),
				...this.optionalText("linen_type", f.linen_type),
				...this.optionalText("napkin_color", f.napkin_color),
				...this.optionalText("napkin_fold", f.napkin_fold),
				...this.optionalText("centerpieces", f.centerpieces),
				...this.optionalText("decor_description", f.decor_description),
				...this.optionalText("floral_arrangements", f.floral_arrangements),
				...this.optionalText("stage_dimensions", f.stage_dimensions),
				...this.optionalText("lighting_notes", f.lighting_notes),
				...this.optionalText("staff_break_schedule", f.staff_break_schedule),
				...this.optionalText("billing_type", f.billing_type),
				...this.optionalText("kitchen_instructions", f.kitchen_instructions),
				...this.optionalText("service_instructions", f.service_instructions),
				...this.optionalText("setup_instructions", f.setup_instructions),
				...this.optionalText("cleanup_instructions", f.cleanup_instructions),
				...this.optionalText("audio_visual_instructions", f.audio_visual_instructions),
				...this.optionalText("internal_notes", f.internal_notes),
				...this.optionalText("client_notes", f.client_notes),
				...this.optionalNumber("meal_service_duration_minutes", f.meal_service_duration_minutes),
				...this.optionalNumber("tables_count", f.tables_count),
				...this.optionalNumber("chairs_count", f.chairs_count),
				...this.optionalNumber("expected_count", f.expected_count),
				...this.optionalNumber("actual_count", f.actual_count),
				...this.optionalNumber("over_set_percentage", f.over_set_percentage),
				...this.optionalNumber("children_count", f.children_count),
				...this.optionalNumber("courses_count", f.courses_count),
				...this.optionalNumber("vegetarian_count", f.vegetarian_count),
				...this.optionalNumber("vegan_count", f.vegan_count),
				...this.optionalNumber("gluten_free_count", f.gluten_free_count),
				...this.optionalNumber("dairy_free_count", f.dairy_free_count),
				...this.optionalNumber("nut_free_count", f.nut_free_count),
				...this.optionalNumber("kosher_count", f.kosher_count),
				...this.optionalNumber("halal_count", f.halal_count),
				...this.optionalNumber("servers_count", f.servers_count),
				...this.optionalNumber("bartenders_count", f.bartenders_count),
				...this.optionalNumber("chefs_count", f.chefs_count),
				...this.optionalNumber("captains_count", f.captains_count),
				...this.optionalNumber("coat_check_attendants", f.coat_check_attendants),
				...this.optionalNumber("valet_attendants", f.valet_attendants),
				...this.optionalNumber("security_guards", f.security_guards),
				...this.optionalNumber("food_subtotal", f.food_subtotal),
				...this.optionalNumber("beverage_subtotal", f.beverage_subtotal),
				...this.optionalNumber("equipment_rental_total", f.equipment_rental_total),
				...this.optionalNumber("labor_charges", f.labor_charges),
				...this.optionalNumber("service_charge_percent", f.service_charge_percent),
				...this.optionalNumber("gratuity_percent", f.gratuity_percent),
				...this.optionalNumber("tax_percent", f.tax_percent),
				...this.optionalNumber("total_estimated", f.total_estimated),
				...this.optionalNumber("price_per_person", f.price_per_person),
				...this.optionalNumber("children_price", f.children_price),
			});
			this.toast.success("BEO updated.");
			this.editing.set(false);
			this.form.set(null);
			await this.reload();
		} catch (e) {
			// A 409 here means the BEO was published from another screen while this
			// one was open — it is frozen and the edit has to become a revision.
			this.toast.error(e instanceof Error ? e.message : "Failed to update the BEO");
		} finally {
			this.submitting.set(false);
		}
	}

	private optionalText(key: string, value: string): Record<string, string> {
		return value.trim() ? { [key]: value.trim() } : {};
	}

	private optionalTime(key: string, value: string): Record<string, string> {
		return value ? { [key]: value } : {};
	}

	private optionalNumber(key: string, value: number | null): Record<string, number> {
		return value != null ? { [key]: value } : {};
	}

	// ── Publish and revise ──

	askPublish(): void {
		this.notifyClient.set(false);
		this.pendingAction.set("publish");
	}

	askRevise(): void {
		this.revisionReason.set("");
		this.pendingAction.set("revise");
	}

	cancelAction(): void {
		this.pendingAction.set(null);
	}

	async confirmPublish(): Promise<void> {
		const b = this.beo();
		const tenantId = this.auth.tenantId();
		if (!b || !tenantId || this.submitting()) return;

		this.submitting.set(true);
		try {
			await this.api.post(`/banquet-orders/${b.beo_id}/publish`, {
				tenant_id: tenantId,
				notify_client: this.notifyClient(),
			});
			this.toast.success("BEO published — it is now frozen for the kitchen and setup.");
			this.pendingAction.set(null);
			await this.reload();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to publish the BEO");
		} finally {
			this.submitting.set(false);
		}
	}

	async confirmRevise(): Promise<void> {
		const b = this.beo();
		const tenantId = this.auth.tenantId();
		const reason = this.revisionReason().trim();
		if (!b || !tenantId || !reason || this.submitting()) return;

		this.submitting.set(true);
		try {
			const res = await this.api.post<{ data: BanquetOrderDetail } | BanquetOrderDetail>(
				`/banquet-orders/${b.beo_id}/revise`,
				{
					tenant_id: tenantId,
					revision_reason: reason,
				},
			);
			// Revise replies with the *new* version, so follow it rather than
			// leaving the operator looking at the one they just superseded.
			const created = "data" in res ? res.data : res;
			this.toast.success(`Revision v${created.beo_version} created as a draft.`);
			this.pendingAction.set(null);
			await this.router.navigate(["/events/beos", created.beo_id]);
			await this.load(created.beo_id);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to revise the BEO");
		} finally {
			this.submitting.set(false);
		}
	}
}
