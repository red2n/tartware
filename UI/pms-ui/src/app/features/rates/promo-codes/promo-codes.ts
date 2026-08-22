import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { LocaleDatePipe } from "../../../core/i18n/locale-date.pipe";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * A discount code a guest types at booking.
 *
 * `POST /v1/promo-codes/validate` shipped long before anything could create a
 * code, so redemption was live over a table only SQL could populate. See
 * ui-gaps/16-booking-reference-data.md.
 */
type PromoCode = {
	promo_id: string;
	property_id?: string;
	promo_code: string;
	promo_name: string;
	promo_description: string | null;
	promo_type: string | null;
	promo_status: string;
	promo_status_display: string;
	is_active: boolean;
	is_public: boolean;
	valid_from: string;
	valid_to: string;
	discount_type: string | null;
	discount_type_display: string | null;
	discount_percent: string | null;
	discount_amount: string | null;
	discount_currency: string | null;
	max_discount_amount: string | null;
	free_nights_count: number | null;
	has_usage_limit: boolean;
	total_usage_limit: number | null;
	usage_count: number;
	remaining_uses: number | null;
	per_user_limit: number | null;
	minimum_stay_nights: number | null;
	maximum_stay_nights: number | null;
	minimum_booking_amount: string | null;
	times_redeemed: number;
	combinable_with_other_promos: boolean;
	auto_apply: boolean;
	display_on_website: boolean;
	created_at: string;
};

const PROMO_TYPES = [
	"discount_percent",
	"discount_fixed",
	"free_night",
	"free_upgrade",
	"free_service",
	"bonus_points",
	"bundle_deal",
	"early_bird",
	"last_minute",
	"other",
] as const;

const PROMO_STATUSES = [
	"draft",
	"scheduled",
	"active",
	"paused",
	"expired",
	"depleted",
	"cancelled",
] as const;

const DISCOUNT_TYPES = ["percentage", "fixed_amount", "free_night", "upgrade", "other"] as const;

/** Statuses where the code can still be redeemed by a guest. */
const LIVE_STATUSES = new Set(["scheduled", "active"]);

@Component({
	selector: "app-promo-codes",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		LocaleDatePipe,
		PageHeaderComponent,
		SubmitOnEnterDirective,
		TranslatePipe,
	],
	templateUrl: "./promo-codes.html",
})
export class PromoCodesComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly promoTypes = PROMO_TYPES;
	readonly promoStatuses = PROMO_STATUSES;
	readonly discountTypes = DISCOUNT_TYPES;

	readonly codes = signal<PromoCode[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly statusFilter = signal("");
	readonly searchFilter = signal("");

	readonly editorOpen = signal(false);
	readonly editing = signal<PromoCode | null>(null);
	readonly form = signal({
		promo_code: "",
		promo_name: "",
		promo_description: "",
		promo_type: "discount_percent" as string,
		promo_status: "draft" as string,
		discount_type: "percentage" as string,
		discount_percent: null as number | null,
		discount_amount: null as number | null,
		discount_currency: "USD",
		max_discount_amount: null as number | null,
		free_nights_count: null as number | null,
		valid_from: "",
		valid_to: "",
		is_active: true,
		is_public: false,
		has_usage_limit: false,
		total_usage_limit: null as number | null,
		per_user_limit: 1 as number | null,
		minimum_stay_nights: null as number | null,
		maximum_stay_nights: null as number | null,
		minimum_booking_amount: null as number | null,
		combinable_with_other_promos: false,
		auto_apply: false,
		display_on_website: false,
	});

	readonly withdrawTarget = signal<PromoCode | null>(null);

	/** Live codes running out of redemptions — the thing to notice before a campaign dies. */
	readonly nearlyDepleted = computed(() =>
		this.codes().filter(
			(c) =>
				LIVE_STATUSES.has(c.promo_status) &&
				c.has_usage_limit &&
				c.remaining_uses != null &&
				c.remaining_uses <= 5,
		),
	);

	/** Live codes whose window has already closed but which still say "active". */
	readonly expiredButActive = computed(() => {
		const today = new Date().toISOString().slice(0, 10);
		return this.codes().filter(
			(c) => LIVE_STATUSES.has(c.promo_status) && c.valid_to.slice(0, 10) < today,
		);
	});

	readonly canSubmit = computed(() => {
		const f = this.form();
		if (f.promo_name.trim().length === 0) return false;
		if (!f.valid_from || !f.valid_to || f.valid_to < f.valid_from) return false;
		if (!this.editing() && !/^[A-Za-z0-9_-]{2,100}$/.test(f.promo_code.trim())) return false;
		if (f.discount_type === "percentage" && f.discount_percent == null) return false;
		if (f.discount_type === "fixed_amount" && f.discount_amount == null) return false;
		if (f.has_usage_limit && f.total_usage_limit == null) return false;
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

	statusClass(status: string): string {
		switch (status) {
			case "active":
				return "badge badge-accent badge-sm";
			case "scheduled":
				return "badge badge-warning badge-sm";
			case "paused":
			case "draft":
				return "badge badge-muted badge-sm";
			case "expired":
			case "depleted":
			case "cancelled":
				return "badge badge-attention badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	/** What the guest actually gets, rendered from whichever discount fields are set. */
	discountSummary(code: PromoCode): string {
		if (code.discount_type === "percentage" && code.discount_percent) {
			const cap = code.max_discount_amount ? ` (max ${code.max_discount_amount})` : "";
			return `${code.discount_percent}%${cap}`;
		}
		if (code.discount_type === "fixed_amount" && code.discount_amount) {
			return `${code.discount_amount} ${code.discount_currency ?? ""}`.trim();
		}
		if (code.free_nights_count) {
			return `${code.free_nights_count} free night${code.free_nights_count === 1 ? "" : "s"}`;
		}
		return this.labelFor(code.discount_type);
	}

	usageSummary(code: PromoCode): string {
		if (!code.has_usage_limit) return `${code.usage_count} used`;
		return `${code.usage_count} / ${code.total_usage_limit ?? "—"} used`;
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const status = this.statusFilter().trim();
			if (status) params["promo_status"] = status;
			const search = this.searchFilter().trim();
			if (search) params["search"] = search;

			const res = await this.api.get<{ data: PromoCode[] } | PromoCode[]>("/promo-codes", params);
			this.codes.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to load promotional codes"),
			);
		} finally {
			this.loading.set(false);
		}
	}

	openCreate(): void {
		this.editing.set(null);
		const today = new Date();
		const in90 = new Date(today.getTime() + 90 * 86_400_000);
		this.form.set({
			promo_code: "",
			promo_name: "",
			promo_description: "",
			promo_type: "discount_percent",
			promo_status: "draft",
			discount_type: "percentage",
			discount_percent: null,
			discount_amount: null,
			discount_currency: "USD",
			max_discount_amount: null,
			free_nights_count: null,
			valid_from: today.toISOString().slice(0, 10),
			valid_to: in90.toISOString().slice(0, 10),
			is_active: true,
			is_public: false,
			has_usage_limit: false,
			total_usage_limit: null,
			per_user_limit: 1,
			minimum_stay_nights: null,
			maximum_stay_nights: null,
			minimum_booking_amount: null,
			combinable_with_other_promos: false,
			auto_apply: false,
			display_on_website: false,
		});
		this.editorOpen.set(true);
	}

	openEdit(code: PromoCode): void {
		this.editing.set(code);
		this.form.set({
			promo_code: code.promo_code,
			promo_name: code.promo_name,
			promo_description: code.promo_description ?? "",
			promo_type: code.promo_type ?? "other",
			promo_status: code.promo_status,
			discount_type: code.discount_type ?? "percentage",
			discount_percent: code.discount_percent != null ? Number(code.discount_percent) : null,
			discount_amount: code.discount_amount != null ? Number(code.discount_amount) : null,
			discount_currency: code.discount_currency ?? "USD",
			max_discount_amount:
				code.max_discount_amount != null ? Number(code.max_discount_amount) : null,
			free_nights_count: code.free_nights_count,
			valid_from: code.valid_from.slice(0, 10),
			valid_to: code.valid_to.slice(0, 10),
			is_active: code.is_active,
			is_public: code.is_public,
			has_usage_limit: code.has_usage_limit,
			total_usage_limit: code.total_usage_limit,
			per_user_limit: code.per_user_limit,
			minimum_stay_nights: code.minimum_stay_nights,
			maximum_stay_nights: code.maximum_stay_nights,
			minimum_booking_amount:
				code.minimum_booking_amount != null ? Number(code.minimum_booking_amount) : null,
			combinable_with_other_promos: code.combinable_with_other_promos,
			auto_apply: code.auto_apply,
			display_on_website: code.display_on_website,
		});
		this.editorOpen.set(true);
	}

	cancelEditor(): void {
		this.editorOpen.set(false);
		this.editing.set(null);
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmit() || this.submitting()) return;
		const f = this.form();
		const existing = this.editing();

		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			promo_name: f.promo_name.trim(),
			promo_type: f.promo_type,
			promo_status: f.promo_status,
			discount_type: f.discount_type,
			discount_currency: f.discount_currency.trim() || "USD",
			valid_from: f.valid_from,
			valid_to: f.valid_to,
			is_active: f.is_active,
			is_public: f.is_public,
			has_usage_limit: f.has_usage_limit,
			combinable_with_other_promos: f.combinable_with_other_promos,
			auto_apply: f.auto_apply,
			display_on_website: f.display_on_website,
			...(f.promo_description.trim() ? { promo_description: f.promo_description.trim() } : {}),
			...(f.discount_percent != null ? { discount_percent: f.discount_percent } : {}),
			...(f.discount_amount != null ? { discount_amount: f.discount_amount } : {}),
			...(f.max_discount_amount != null ? { max_discount_amount: f.max_discount_amount } : {}),
			...(f.free_nights_count != null ? { free_nights_count: f.free_nights_count } : {}),
			...(f.total_usage_limit != null ? { total_usage_limit: f.total_usage_limit } : {}),
			...(f.per_user_limit != null ? { per_user_limit: f.per_user_limit } : {}),
			...(f.minimum_stay_nights != null ? { minimum_stay_nights: f.minimum_stay_nights } : {}),
			...(f.maximum_stay_nights != null ? { maximum_stay_nights: f.maximum_stay_nights } : {}),
			...(f.minimum_booking_amount != null
				? { minimum_booking_amount: f.minimum_booking_amount }
				: {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/promo-codes/${existing.promo_id}`, body);
				this.toast.success(this.i18n.t("Promotional code updated."));
			} else {
				const propertyId = this.ctx.propertyId();
				await this.api.post("/promo-codes", {
					...body,
					promo_code: f.promo_code.trim().toUpperCase(),
					...(propertyId ? { property_id: propertyId } : {}),
				});
				this.toast.success(this.i18n.t("Promotional code created."));
			}
			this.editorOpen.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to save promotional code"),
			);
		} finally {
			this.submitting.set(false);
		}
	}

	openWithdraw(code: PromoCode): void {
		this.withdrawTarget.set(code);
	}

	cancelWithdraw(): void {
		this.withdrawTarget.set(null);
	}

	async confirmWithdraw(): Promise<void> {
		const code = this.withdrawTarget();
		const tenantId = this.auth.tenantId();
		if (!code || !tenantId || this.submitting()) return;
		this.submitting.set(true);
		try {
			await this.api.delete(`/promo-codes/${code.promo_id}?tenant_id=${tenantId}`);
			this.toast.success(this.i18n.t("{p0} withdrawn.", { p0: code.promo_code }));
			this.withdrawTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to withdraw code"));
		} finally {
			this.submitting.set(false);
		}
	}
}
