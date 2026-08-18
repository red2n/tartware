import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
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
type BookingSource = {
	source_id: string;
	source_code: string;
	source_name: string;
	source_type: string;
	source_type_display: string;
	category: string | null;
	is_active: boolean;
	is_bookable: boolean;
	channel_name: string | null;
	channel_website: string | null;
	commission_type: string;
	commission_percentage: number | null;
	commission_fixed_amount: number | null;
	total_bookings: number;
	total_revenue: number | null;
	ranking: number | null;
	is_preferred: boolean;
};

type MarketSegment = {
	segment_id: string;
	segment_code: string;
	segment_name: string;
	segment_type: string;
	segment_type_display: string;
	is_active: boolean;
	is_bookable: boolean;
	parent_segment_id?: string;
	segment_level: number;
	average_daily_rate: number | null;
	total_bookings: number;
	total_revenue: number | null;
	rate_multiplier: number;
};

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

	readonly tab = signal<"sources" | "segments">("sources");
	readonly sources = signal<BookingSource[]>([]);
	readonly segments = signal<MarketSegment[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);

	readonly sourceEditorOpen = signal(false);
	readonly editingSource = signal<BookingSource | null>(null);
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
	readonly editingSegment = signal<MarketSegment | null>(null);
	readonly segmentForm = signal({
		segment_code: "",
		segment_name: "",
		segment_type: "CORPORATE" as string,
		parent_segment_id: "",
		rate_multiplier: 1 as number | null,
		is_active: true,
		is_bookable: true,
	});

	readonly retireTarget = signal<
		{ kind: "source" | "segment"; id: string; label: string } | null
	>(null);

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

	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	commissionSummary(source: BookingSource): string {
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

			const [sourceRes, segmentRes] = await Promise.all([
				this.api.get<{ data: BookingSource[] } | BookingSource[]>("/booking-sources", params),
				this.api.get<{ data: MarketSegment[] } | MarketSegment[]>("/market-segments", params),
			]);
			this.sources.set(Array.isArray(sourceRes) ? sourceRes : (sourceRes?.data ?? []));
			this.segments.set(Array.isArray(segmentRes) ? segmentRes : (segmentRes?.data ?? []));
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

	openEditSource(source: BookingSource): void {
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
			...(f.commission_percentage != null ? { commission_percentage: f.commission_percentage } : {}),
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

	openEditSegment(segment: MarketSegment): void {
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
}
