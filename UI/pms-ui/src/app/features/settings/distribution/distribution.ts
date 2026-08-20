import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
	ALLOTMENT_LEGAL_TRANSITIONS,
	type AllotmentListItem,
	type AllotmentStatus,
	AllotmentStatusEnum,
	AllotmentTypeEnum,
	type BookingSourceListItem,
	type ChannelMappingListItem,
	type MarketSegmentListItem,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Where a booking came from, and which commercial bucket it belongs to.
 *
 * Both were read-only until 2026-08-13, and market segments were already
 * load-bearing: `/v1/reports/market-segment-production` groups by a dimension
 * nothing could populate. COV-14 puts these in settings rather than their own
 * area, which is right — they are tables someone edits a few times a year.
 * See ui-gaps/14-channel-distribution.md.
 */
/**
 * `GET /v1/metasearch-configs` replies with rows of
 * `MetasearchConfigurationsSchema`, whose date fields are `z.coerce.date()` —
 * over the wire they arrive as ISO strings, so the view type narrows to what a
 * screen actually reads rather than re-declaring the shape. Allowed by
 * UI/AGENTS.md as a view model; the fields themselves are the schema's.
 */
type MetasearchConfigRow = {
	config_id: string;
	property_id: string;
	platform: string;
	platform_account_id?: string;
	is_active?: boolean;
	bid_strategy?: string;
	max_cpc?: number;
	default_cpc?: number;
	target_cpa?: number;
	budget_daily?: number;
	budget_monthly?: number;
	currency?: string;
};

// `BookingSourceListItem`, `MarketSegmentListItem`, `AllotmentListItem` and
// `ChannelMappingListItem` come from @tartware/schemas. This screen used to
// re-declare the first two locally, which UI/AGENTS.md forbids for exactly the
// reason it caused here: the local copies carried 17 and 13 fields against the
// read models' 31 and 38, so half of what the API returns was invisible.

/**
 * `source_type` and `segment_type` come back lowercase — core-service's
 * booking-config mappers fold them (`distribution.ts:45,270`) while the columns
 * store upper (`DIRECT`, `CORPORATE`). The option lists below are uppercase and
 * are correct for writing, but an edit form populated with the raw response
 * value matches no `<option>`: the select renders empty and saving silently
 * rewrites the record's type. Normalise on the way in.
 * See ui-gaps/17-command-reachability.md.
 */
const upper = (value: string | null | undefined): string => (value ?? "").toUpperCase();

const SOURCE_TYPES = [
	"OTA",
	"GDS",
	"DIRECT",
	"METASEARCH",
	"WHOLESALER",
	"AGENT",
	"CORPORATE",
	"WALK_IN",
	"PHONE",
	"EMAIL",
	"OTHER",
] as const;

const COMMISSION_TYPES = ["PERCENTAGE", "FIXED", "TIERED", "NONE"] as const;

const SEGMENT_TYPES = [
	"CORPORATE",
	"LEISURE",
	"GROUP",
	"GOVERNMENT",
	"WHOLESALE",
	"NEGOTIATED",
	"PACKAGE",
	"QUALIFIED",
	"OTHER",
] as const;

@Component({
	selector: "app-distribution-settings",
	standalone: true,
	imports: [FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./distribution.html",
})
export class DistributionSettingsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly sourceTypes = SOURCE_TYPES;
	readonly commissionTypes = COMMISSION_TYPES;
	readonly segmentTypes = SEGMENT_TYPES;

	readonly allotmentTypes = AllotmentTypeEnum.options;
	readonly allotmentStatuses = AllotmentStatusEnum.options;

	readonly tab = signal<"sources" | "segments" | "allotments" | "mappings" | "metasearch">(
		"sources",
	);

	readonly tabs = [
		{ key: "sources", label: "Booking sources" },
		{ key: "segments", label: "Market segments" },
		{ key: "allotments", label: "Allotments" },
		{ key: "mappings", label: "Channel mappings" },
		{ key: "metasearch", label: "Metasearch" },
	] as const;
	readonly sources = signal<BookingSourceListItem[]>([]);
	readonly segments = signal<MarketSegmentListItem[]>([]);
	readonly allotments = signal<AllotmentListItem[]>([]);
	readonly mappings = signal<ChannelMappingListItem[]>([]);
	readonly metasearch = signal<MetasearchConfigRow[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);

	readonly sourceEditorOpen = signal(false);
	readonly editingSource = signal<BookingSourceListItem | null>(null);
	readonly sourceForm = signal({
		source_code: "",
		source_name: "",
		source_type: "OTA" as string,
		category: "",
		channel_name: "",
		channel_website: "",
		commission_type: "PERCENTAGE" as string,
		commission_percentage: null as number | null,
		commission_fixed_amount: null as number | null,
		ranking: null as number | null,
		is_active: true,
		is_bookable: true,
		is_preferred: false,
	});

	readonly segmentEditorOpen = signal(false);
	readonly editingSegment = signal<MarketSegmentListItem | null>(null);
	readonly segmentForm = signal({
		segment_code: "",
		segment_name: "",
		segment_type: "CORPORATE" as string,
		parent_segment_id: "",
		rate_multiplier: 1 as number | null,
		is_active: true,
		is_bookable: true,
	});

	readonly retireTarget = signal<{ kind: "source" | "segment"; id: string; label: string } | null>(
		null,
	);

	/** Root segments can parent others; a sub-segment cannot, so the picker excludes them. */
	readonly parentCandidates = computed(() =>
		this.segments().filter(
			(s) => s.segment_level === 1 && s.segment_id !== this.editingSegment()?.segment_id,
		),
	);

	readonly canSubmitSource = computed(() => {
		const f = this.sourceForm();
		if (f.source_name.trim().length === 0) return false;
		if (!this.editingSource() && !/^[A-Za-z0-9_-]{2,50}$/.test(f.source_code.trim())) return false;
		if (f.commission_type === "PERCENTAGE" && f.commission_percentage == null) return false;
		if (f.commission_type === "FIXED" && f.commission_fixed_amount == null) return false;
		return true;
	});

	readonly canSubmitSegment = computed(() => {
		const f = this.segmentForm();
		if (f.segment_name.trim().length === 0) return false;
		if (!this.editingSegment() && !/^[A-Za-z0-9_-]{2,50}$/.test(f.segment_code.trim()))
			return false;
		return true;
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	/**
	 * Enum value → readable label: `PICKUP_IN_PROGRESS` becomes "Pickup In
	 * Progress".
	 *
	 * The lowercase step is the whole trick. Without it an already-uppercase
	 * constant passes through untouched and the screen shouts `DEFINITE` — which
	 * went unnoticed here because sources and segments render the server's
	 * `*_display` fields instead. The allotment and metasearch sections are the
	 * first to label a raw enum. Same slip ui-gaps/13 records on the event
	 * booking detail.
	 */
	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value
			.toLowerCase()
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	commissionSummary(source: BookingSourceListItem): string {
		if (source.commission_type === "PERCENTAGE" && source.commission_percentage != null) {
			return `${source.commission_percentage}%`;
		}
		if (source.commission_type === "FIXED" && source.commission_fixed_amount != null) {
			return String(source.commission_fixed_amount);
		}
		return this.labelFor(source.commission_type);
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const unwrap = <T>(res: { data: T[] } | T[] | null | undefined): T[] =>
				Array.isArray(res) ? res : (res?.data ?? []);

			// One round trip per surface, in parallel: five small reference reads.
			// Each is allowed to fail on its own — a channel manager that is down
			// should not blank the booking sources beside it.
			const [sourceRes, segmentRes, allotmentRes, mappingRes, metasearchRes] = await Promise.all([
				this.api.get<{ data: BookingSourceListItem[] } | BookingSourceListItem[]>(
					"/booking-sources",
					params,
				),
				this.api.get<{ data: MarketSegmentListItem[] } | MarketSegmentListItem[]>(
					"/market-segments",
					params,
				),
				this.api
					.get<{ data: AllotmentListItem[] } | AllotmentListItem[]>("/allotments", params)
					.catch(() => [] as AllotmentListItem[]),
				this.api
					.get<{ data: ChannelMappingListItem[] } | ChannelMappingListItem[]>(
						"/channel-mappings",
						params,
					)
					.catch(() => [] as ChannelMappingListItem[]),
				this.api
					.get<{ data: MetasearchConfigRow[] } | MetasearchConfigRow[]>(
						"/metasearch-configs",
						params,
					)
					.catch(() => [] as MetasearchConfigRow[]),
			]);
			this.sources.set(unwrap(sourceRes));
			this.segments.set(unwrap(segmentRes));
			this.allotments.set(unwrap(allotmentRes));
			this.mappings.set(unwrap(mappingRes));
			this.metasearch.set(unwrap(metasearchRes));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load distribution settings");
		} finally {
			this.loading.set(false);
		}
	}

	// ── Booking sources ─────────────────────────────────────

	openCreateSource(): void {
		this.editingSource.set(null);
		this.sourceForm.set({
			source_code: "",
			source_name: "",
			source_type: "OTA",
			category: "",
			channel_name: "",
			channel_website: "",
			commission_type: "PERCENTAGE",
			commission_percentage: null,
			commission_fixed_amount: null,
			ranking: null,
			is_active: true,
			is_bookable: true,
			is_preferred: false,
		});
		this.sourceEditorOpen.set(true);
	}

	openEditSource(source: BookingSourceListItem): void {
		this.editingSource.set(source);
		this.sourceForm.set({
			source_code: source.source_code,
			source_name: source.source_name,
			source_type: upper(source.source_type),
			category: source.category ?? "",
			channel_name: source.channel_name ?? "",
			channel_website: source.channel_website ?? "",
			commission_type: source.commission_type,
			commission_percentage: source.commission_percentage,
			commission_fixed_amount: source.commission_fixed_amount,
			ranking: source.ranking,
			is_active: source.is_active,
			is_bookable: source.is_bookable,
			is_preferred: source.is_preferred,
		});
		this.sourceEditorOpen.set(true);
	}

	cancelSourceEditor(): void {
		this.sourceEditorOpen.set(false);
		this.editingSource.set(null);
	}

	async submitSource(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmitSource() || this.submitting()) return;
		const f = this.sourceForm();
		const existing = this.editingSource();
		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			source_name: f.source_name.trim(),
			source_type: f.source_type,
			commission_type: f.commission_type,
			is_active: f.is_active,
			is_bookable: f.is_bookable,
			is_preferred: f.is_preferred,
			...(f.category.trim() ? { category: f.category.trim() } : {}),
			...(f.channel_name.trim() ? { channel_name: f.channel_name.trim() } : {}),
			...(f.channel_website.trim() ? { channel_website: f.channel_website.trim() } : {}),
			...(f.commission_percentage != null
				? { commission_percentage: f.commission_percentage }
				: {}),
			...(f.commission_fixed_amount != null
				? { commission_fixed_amount: f.commission_fixed_amount }
				: {}),
			...(f.ranking != null ? { ranking: f.ranking } : {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/booking-sources/${existing.source_id}`, body);
				this.toast.success("Booking source updated.");
			} else {
				const propertyId = this.ctx.propertyId();
				await this.api.post("/booking-sources", {
					...body,
					source_code: f.source_code.trim(),
					...(propertyId ? { property_id: propertyId } : {}),
				});
				this.toast.success("Booking source created.");
			}
			this.cancelSourceEditor();
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save booking source");
		} finally {
			this.submitting.set(false);
		}
	}

	// ── Market segments ─────────────────────────────────────

	openCreateSegment(): void {
		this.editingSegment.set(null);
		this.segmentForm.set({
			segment_code: "",
			segment_name: "",
			segment_type: "CORPORATE",
			parent_segment_id: "",
			rate_multiplier: 1,
			is_active: true,
			is_bookable: true,
		});
		this.segmentEditorOpen.set(true);
	}

	openEditSegment(segment: MarketSegmentListItem): void {
		this.editingSegment.set(segment);
		this.segmentForm.set({
			segment_code: segment.segment_code,
			segment_name: segment.segment_name,
			segment_type: upper(segment.segment_type),
			parent_segment_id: segment.parent_segment_id ?? "",
			rate_multiplier: segment.rate_multiplier,
			is_active: segment.is_active,
			is_bookable: segment.is_bookable,
		});
		this.segmentEditorOpen.set(true);
	}

	cancelSegmentEditor(): void {
		this.segmentEditorOpen.set(false);
		this.editingSegment.set(null);
	}

	async submitSegment(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmitSegment() || this.submitting()) return;
		const f = this.segmentForm();
		const existing = this.editingSegment();
		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			segment_name: f.segment_name.trim(),
			segment_type: f.segment_type,
			is_active: f.is_active,
			is_bookable: f.is_bookable,
			...(f.rate_multiplier != null ? { rate_multiplier: f.rate_multiplier } : {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/market-segments/${existing.segment_id}`, body);
				this.toast.success("Market segment updated.");
			} else {
				const propertyId = this.ctx.propertyId();
				await this.api.post("/market-segments", {
					...body,
					segment_code: f.segment_code.trim(),
					// Parenting is set at creation: the level is derived from it, so
					// re-parenting later would silently leave the level stale.
					...(f.parent_segment_id ? { parent_segment_id: f.parent_segment_id } : {}),
					...(propertyId ? { property_id: propertyId } : {}),
				});
				this.toast.success("Market segment created.");
			}
			this.cancelSegmentEditor();
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save market segment");
		} finally {
			this.submitting.set(false);
		}
	}

	// ── Retire ──────────────────────────────────────────────

	openRetire(kind: "source" | "segment", id: string, label: string): void {
		this.retireTarget.set({ kind, id, label });
	}

	cancelRetire(): void {
		this.retireTarget.set(null);
	}

	async confirmRetire(): Promise<void> {
		const target = this.retireTarget();
		const tenantId = this.auth.tenantId();
		if (!target || !tenantId || this.submitting()) return;
		const path = target.kind === "source" ? "booking-sources" : "market-segments";
		this.submitting.set(true);
		try {
			await this.api.delete(`/${path}/${target.id}?tenant_id=${tenantId}`);
			this.toast.success(`${target.label} retired.`);
			this.retireTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to retire");
		} finally {
			this.submitting.set(false);
		}
	}

	// ── Allotments ──────────────────────────────────────────
	//
	// Contracted room blocks. Plain HTTP, not the availability guard — see the
	// 2026-08-19 decision in ui-gaps/16-booking-reference-data.md, which also
	// explains why they sit here beside booking sources rather than inside the
	// group screen: an allotment points at a source and a segment, never at a
	// group booking.

	readonly allotmentEditorOpen = signal(false);
	readonly editingAllotment = signal<AllotmentListItem | null>(null);
	readonly allotmentForm = signal({
		allotment_code: "",
		allotment_name: "",
		allotment_type: "GROUP" as string,
		start_date: "",
		end_date: "",
		cutoff_date: "",
		total_rooms_blocked: null as number | null,
		rooms_per_night: null as number | null,
		rooms_picked_up: null as number | null,
		contracted_rate: null as number | null,
		account_name: "",
		contact_name: "",
		contact_email: "",
		booking_source_id: "",
		market_segment_id: "",
		attrition_clause: false,
		attrition_percentage: null as number | null,
		commission_percentage: null as number | null,
	});

	/** Only the moves the service will accept, from the shared map. */
	readonly allotmentNextStatuses = computed<readonly AllotmentStatus[]>(() => {
		const current = this.editingAllotment()?.allotment_status;
		return current ? (ALLOTMENT_LEGAL_TRANSITIONS[current] ?? []) : [];
	});

	readonly canSubmitAllotment = computed(() => {
		const f = this.allotmentForm();
		if (f.allotment_name.trim().length === 0) return false;
		if (!this.editingAllotment() && !/^[A-Za-z0-9_-]{2,50}$/.test(f.allotment_code.trim()))
			return false;
		if (!this.editingAllotment() && (!f.start_date || !f.end_date)) return false;
		if (!this.editingAllotment() && f.end_date < f.start_date) return false;
		if (f.total_rooms_blocked != null && f.total_rooms_blocked <= 0) return false;
		return true;
	});

	openCreateAllotment(): void {
		this.editingAllotment.set(null);
		this.allotmentForm.set({
			allotment_code: "",
			allotment_name: "",
			allotment_type: "GROUP",
			start_date: "",
			end_date: "",
			cutoff_date: "",
			total_rooms_blocked: null,
			rooms_per_night: null,
			rooms_picked_up: null,
			contracted_rate: null,
			account_name: "",
			contact_name: "",
			contact_email: "",
			booking_source_id: "",
			market_segment_id: "",
			attrition_clause: false,
			attrition_percentage: null,
			commission_percentage: null,
		});
		this.allotmentEditorOpen.set(true);
	}

	openEditAllotment(allotment: AllotmentListItem): void {
		this.editingAllotment.set(allotment);
		this.allotmentForm.set({
			allotment_code: allotment.allotment_code,
			allotment_name: allotment.allotment_name,
			allotment_type: allotment.allotment_type,
			start_date: allotment.start_date.slice(0, 10),
			end_date: allotment.end_date.slice(0, 10),
			cutoff_date: allotment.cutoff_date?.slice(0, 10) ?? "",
			total_rooms_blocked: allotment.total_rooms_blocked,
			rooms_per_night: allotment.rooms_per_night,
			rooms_picked_up: allotment.rooms_picked_up,
			contracted_rate: allotment.contracted_rate,
			account_name: allotment.account_name ?? "",
			contact_name: allotment.contact_name ?? "",
			contact_email: allotment.contact_email ?? "",
			booking_source_id: "",
			market_segment_id: "",
			attrition_clause: allotment.attrition_clause,
			attrition_percentage: allotment.attrition_percentage,
			commission_percentage: null,
		});
		this.allotmentEditorOpen.set(true);
	}

	cancelAllotmentEditor(): void {
		this.allotmentEditorOpen.set(false);
		this.editingAllotment.set(null);
	}

	patchAllotmentForm(patch: Partial<ReturnType<typeof this.allotmentForm>>): void {
		this.allotmentForm.set({ ...this.allotmentForm(), ...patch });
	}

	async submitAllotment(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId || !this.canSubmitAllotment() || this.submitting()) return;

		const f = this.allotmentForm();
		const editing = this.editingAllotment();
		// Every field on the update schema is optional and the service COALESCEs,
		// so an empty string means "leave it alone" rather than "blank it".
		const shared = {
			tenant_id: tenantId,
			allotment_name: f.allotment_name.trim(),
			allotment_type: f.allotment_type,
			...(f.cutoff_date ? { cutoff_date: f.cutoff_date } : {}),
			...(f.total_rooms_blocked != null ? { total_rooms_blocked: f.total_rooms_blocked } : {}),
			...(f.rooms_per_night != null ? { rooms_per_night: f.rooms_per_night } : {}),
			...(f.contracted_rate != null ? { contracted_rate: f.contracted_rate } : {}),
			...(f.account_name.trim() ? { account_name: f.account_name.trim() } : {}),
			...(f.contact_name.trim() ? { contact_name: f.contact_name.trim() } : {}),
			...(f.contact_email.trim() ? { contact_email: f.contact_email.trim() } : {}),
			...(f.booking_source_id ? { booking_source_id: f.booking_source_id } : {}),
			...(f.market_segment_id ? { market_segment_id: f.market_segment_id } : {}),
			attrition_clause: f.attrition_clause,
			...(f.attrition_percentage != null ? { attrition_percentage: f.attrition_percentage } : {}),
			...(f.commission_percentage != null
				? { commission_percentage: f.commission_percentage }
				: {}),
		};

		this.submitting.set(true);
		try {
			if (editing) {
				await this.api.put(`/allotments/${editing.allotment_id}`, {
					...shared,
					...(f.rooms_picked_up != null ? { rooms_picked_up: f.rooms_picked_up } : {}),
				});
				this.toast.success("Allotment updated.");
			} else {
				await this.api.post("/allotments", {
					...shared,
					property_id: propertyId,
					allotment_code: f.allotment_code.trim(),
					start_date: f.start_date,
					end_date: f.end_date,
					total_rooms_blocked: f.total_rooms_blocked ?? 1,
				});
				this.toast.success("Allotment created.");
			}
			this.allotmentEditorOpen.set(false);
			this.editingAllotment.set(null);
			await this.load();
		} catch (e) {
			// A 409 is a code that is already taken.
			this.toast.error(e instanceof Error ? e.message : "Failed to save the allotment");
		} finally {
			this.submitting.set(false);
		}
	}

	async moveAllotment(allotment: AllotmentListItem, next: AllotmentStatus): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || this.submitting()) return;
		this.submitting.set(true);
		try {
			await this.api.post(`/allotments/${allotment.allotment_id}/status`, {
				tenant_id: tenantId,
				allotment_status: next,
				...(next === "CANCELLED"
					? { cancellation_reason: "Cancelled from distribution settings" }
					: {}),
			});
			this.toast.success(`${allotment.allotment_code} moved to ${this.labelFor(next)}.`);
			this.allotmentEditorOpen.set(false);
			this.editingAllotment.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to move the allotment");
		} finally {
			this.submitting.set(false);
		}
	}

	/** Rooms still to sell against the block, once pickup is taken off. */
	allotmentRemaining(allotment: AllotmentListItem): number {
		return Math.max(allotment.total_rooms_blocked - allotment.rooms_picked_up, 0);
	}

	// ── Channel mappings ────────────────────────────────────
	//
	// `channel_mappings` is the one table behind both `/v1/channel-mappings` and
	// `/v1/ota-connections`; the latter is a projection of the same rows, which is
	// why there is no separate "connections admin" here. Edits go through
	// `integration.mapping.update` rather than HTTP because a mapping change fans
	// out to OTA sync — COV-18's test. See ui-gaps/14-channel-distribution.md.
	//
	// Dispatch answers 202 with no body, so the list is re-read a few times rather
	// than patched in place.

	readonly mappingEditorOpen = signal(false);
	readonly editingMapping = signal<ChannelMappingListItem | null>(null);
	readonly mappingForm = signal({
		external_id: "",
		external_code: "",
		is_active: true,
	});

	openEditMapping(mapping: ChannelMappingListItem): void {
		this.editingMapping.set(mapping);
		this.mappingForm.set({
			external_id: mapping.external_id,
			external_code: mapping.external_code ?? "",
			is_active: mapping.is_active,
		});
		this.mappingEditorOpen.set(true);
	}

	cancelMappingEditor(): void {
		this.mappingEditorOpen.set(false);
		this.editingMapping.set(null);
	}

	patchMappingForm(patch: Partial<ReturnType<typeof this.mappingForm>>): void {
		this.mappingForm.set({ ...this.mappingForm(), ...patch });
	}

	async submitMapping(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const mapping = this.editingMapping();
		if (!tenantId || !mapping || this.submitting()) return;
		const f = this.mappingForm();
		if (f.external_id.trim().length === 0) return;

		this.submitting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/channels/mapping-update`, {
				mapping_id: mapping.id,
				external_id: f.external_id.trim(),
				...(f.external_code.trim() ? { external_code: f.external_code.trim() } : {}),
				is_active: f.is_active,
			});
			this.toast.success("Mapping update submitted. Refreshing…");
			this.mappingEditorOpen.set(false);
			this.editingMapping.set(null);
			await settleCommandReadModel(() => this.load());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update the mapping");
		} finally {
			this.submitting.set(false);
		}
	}

	/** A mapping is only as good as its last sync; that is what the row leads with. */
	syncBadgeClass(status: string | null | undefined): string {
		switch ((status ?? "").toLowerCase()) {
			case "success":
			case "synced":
				return "badge badge-accent";
			case "pending":
			case "in_progress":
				return "badge badge-warning";
			case "failed":
			case "error":
				return "badge badge-attention";
			default:
				return "badge badge-muted";
		}
	}

	// ── Metasearch ──────────────────────────────────────────
	//
	// `metasearch.config.create` and `.update` had handlers, catalog rows and
	// payload validators and no gateway wrapper, so neither could be dispatched —
	// two of the 95 unreachable commands in ui-gaps/17. Wrapped 2026-08-19 at
	// `/v1/tenants/:tenantId/channels/metasearch-config[-update]`, which is what
	// this section calls.

	readonly metasearchPlatforms = [
		"GOOGLE_HOTEL_ADS",
		"TRIPADVISOR",
		"TRIVAGO",
		"KAYAK",
		"SKYSCANNER",
		"BING_HOTEL_ADS",
	] as const;

	readonly bidStrategies = ["CPC", "CPA", "COMMISSION", "HYBRID"] as const;

	readonly metasearchEditorOpen = signal(false);
	readonly editingMetasearch = signal<MetasearchConfigRow | null>(null);
	readonly metasearchForm = signal({
		platform: "GOOGLE_HOTEL_ADS" as string,
		platform_account_id: "",
		bid_strategy: "CPC" as string,
		max_cpc: null as number | null,
		default_cpc: null as number | null,
		target_cpa: null as number | null,
		budget_daily: null as number | null,
		budget_monthly: null as number | null,
		is_active: true,
	});

	openCreateMetasearch(): void {
		this.editingMetasearch.set(null);
		this.metasearchForm.set({
			platform: "GOOGLE_HOTEL_ADS",
			platform_account_id: "",
			bid_strategy: "CPC",
			max_cpc: null,
			default_cpc: null,
			target_cpa: null,
			budget_daily: null,
			budget_monthly: null,
			is_active: true,
		});
		this.metasearchEditorOpen.set(true);
	}

	openEditMetasearch(config: MetasearchConfigRow): void {
		this.editingMetasearch.set(config);
		this.metasearchForm.set({
			platform: config.platform,
			platform_account_id: config.platform_account_id ?? "",
			bid_strategy: config.bid_strategy ?? "CPC",
			max_cpc: config.max_cpc ?? null,
			default_cpc: config.default_cpc ?? null,
			target_cpa: config.target_cpa ?? null,
			budget_daily: config.budget_daily ?? null,
			budget_monthly: config.budget_monthly ?? null,
			is_active: config.is_active ?? true,
		});
		this.metasearchEditorOpen.set(true);
	}

	cancelMetasearchEditor(): void {
		this.metasearchEditorOpen.set(false);
		this.editingMetasearch.set(null);
	}

	patchMetasearchForm(patch: Partial<ReturnType<typeof this.metasearchForm>>): void {
		this.metasearchForm.set({ ...this.metasearchForm(), ...patch });
	}

	readonly canSubmitMetasearch = computed(() => {
		const f = this.metasearchForm();
		// A CPC strategy with no bid, or a CPA one with no target, configures
		// nothing — the platform needs a number to bid with.
		if (f.bid_strategy === "CPC" && f.default_cpc == null && f.max_cpc == null) return false;
		if (f.bid_strategy === "CPA" && f.target_cpa == null) return false;
		return true;
	});

	async submitMetasearch(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId || !this.canSubmitMetasearch() || this.submitting()) return;

		const f = this.metasearchForm();
		const editing = this.editingMetasearch();
		const bids = {
			bid_strategy: f.bid_strategy,
			...(f.max_cpc != null ? { max_cpc: f.max_cpc } : {}),
			...(f.default_cpc != null ? { default_cpc: f.default_cpc } : {}),
			...(f.target_cpa != null ? { target_cpa: f.target_cpa } : {}),
			...(f.budget_daily != null ? { budget_daily: f.budget_daily } : {}),
			...(f.budget_monthly != null ? { budget_monthly: f.budget_monthly } : {}),
			is_active: f.is_active,
		};

		this.submitting.set(true);
		try {
			if (editing) {
				await this.api.post(`/tenants/${tenantId}/channels/metasearch-config-update`, {
					config_id: editing.config_id,
					...bids,
				});
				this.toast.success("Bid configuration update submitted. Refreshing…");
			} else {
				await this.api.post(`/tenants/${tenantId}/channels/metasearch-config`, {
					property_id: propertyId,
					platform: f.platform,
					...(f.platform_account_id.trim()
						? { platform_account_id: f.platform_account_id.trim() }
						: {}),
					...bids,
				});
				this.toast.success("Metasearch configuration submitted. Refreshing…");
			}
			this.metasearchEditorOpen.set(false);
			this.editingMetasearch.set(null);
			await settleCommandReadModel(() => this.load());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save the configuration");
		} finally {
			this.submitting.set(false);
		}
	}

	/** What this platform is actually bidding, in one line. */
	bidSummary(config: MetasearchConfigRow): string {
		const parts: string[] = [];
		if (config.default_cpc != null) parts.push(`${config.default_cpc} default CPC`);
		if (config.max_cpc != null) parts.push(`${config.max_cpc} max`);
		if (config.target_cpa != null) parts.push(`${config.target_cpa} target CPA`);
		if (config.budget_daily != null) parts.push(`${config.budget_daily}/day`);
		return parts.length ? parts.join(" · ") : "—";
	}
}
