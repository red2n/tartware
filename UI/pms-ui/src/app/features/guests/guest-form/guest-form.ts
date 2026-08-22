import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../../../shared/components/icon/icon";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";
import {
	isGuestFormValid,
	markFieldTouched,
	validateEmail,
	validatePhone,
} from "../guest-form-utils";

/**
 * Guest profile as returned by the detail endpoint — only the parts this form
 * edits. Kept local rather than importing GuestDetail so the form is not
 * coupled to fields it never writes (stay statistics, consent, blacklist).
 */
type EditableGuest = {
	id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	title?: string;
	nationality?: string;
	gender?: string;
	date_of_birth?: string | Date;
	company_name?: string;
	loyalty_tier?: string;
	vip_status?: string;
	address?: {
		street?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
	preferences?: Record<string, unknown>;
};

/** Comma-separated free text ⇄ trimmed string array, for dietary/special-request lists. */
const parseList = (value: string): string[] =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

const formatList = (value: unknown): string =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").join(", ") : "";

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

@Component({
	selector: "app-guest-form",
	standalone: true,
	imports: [
		FormsModule,
		RouterLink,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./guest-form.html",
	styleUrl: "./guest-form.scss",
})
export class GuestFormComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly guestId = signal<string | null>(null);
	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly loadError = signal<string | null>(null);
	readonly fieldErrors = signal<Record<string, string>>({});

	readonly isEdit = computed(() => this.guestId() !== null);
	readonly heading = computed(() => (this.isEdit() ? "Edit Guest" : "New Guest"));

	touched: Record<string, boolean> = {};

	/* ── Identity ── */
	title = "";
	firstName = "";
	lastName = "";
	dateOfBirth = "";
	gender = "";
	nationality = "";

	/* ── Contact ── */
	email = "";
	phone = "";

	/* ── Address ── */
	street = "";
	city = "";
	state = "";
	postalCode = "";
	country = "";

	/* ── Company ── */
	companyName = "";

	/* ── Loyalty & VIP ── */
	loyaltyTier = "";
	vipStatus = "";

	/* ── Preferences ── */
	prefRoomType = "";
	prefBedType = "";
	prefFloor = "";
	prefLanguage = "";
	prefSmoking = false;
	prefDietary = "";
	prefSpecialRequests = "";

	get emailError(): string | null {
		return validateEmail(this.email);
	}

	get phoneError(): string | null {
		return validatePhone(this.phone);
	}

	get isValid(): boolean {
		return isGuestFormValid(this);
	}

	markTouched(field: string): void {
		this.touched = markFieldTouched(this.touched, field);
	}

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get("guestId");
		if (id) {
			this.guestId.set(id);
			this.loadGuest(id);
		}
	}

	private async loadGuest(id: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.loadError.set(null);
		try {
			const g = await this.api.get<EditableGuest>(`/guests/${id}`, { tenant_id: tenantId });
			this.hydrate(g);
		} catch (e) {
			this.loadError.set(e instanceof Error ? e.message : "Failed to load guest");
		} finally {
			this.loading.set(false);
		}
	}

	private hydrate(g: EditableGuest): void {
		this.title = g.title ?? "";
		this.firstName = g.first_name ?? "";
		this.lastName = g.last_name ?? "";
		this.dateOfBirth = this.toDateInput(g.date_of_birth);
		this.gender = g.gender ?? "";
		this.nationality = g.nationality ?? "";

		this.email = g.email ?? "";
		this.phone = g.phone ?? "";

		this.street = g.address?.street ?? "";
		this.city = g.address?.city ?? "";
		this.state = g.address?.state ?? "";
		this.postalCode = g.address?.postalCode ?? "";
		this.country = g.address?.country ?? "";

		this.companyName = g.company_name ?? "";
		this.loyaltyTier = g.loyalty_tier ?? "";
		this.vipStatus = g.vip_status ?? "";

		// Preference keys mirror what the detail view's summary card already
		// reads, so anything saved here shows up there without a second mapping.
		const p = g.preferences ?? {};
		this.prefRoomType = asText(p["roomType"]);
		this.prefBedType = asText(p["bedType"]);
		this.prefFloor = asText(p["floor"]);
		this.prefLanguage = asText(p["language"]);
		this.prefSmoking = p["smoking"] === true;
		this.prefDietary = formatList(p["dietaryRestrictions"]);
		this.prefSpecialRequests = formatList(p["specialRequests"]);
	}

	private toDateInput(value: string | Date | null | undefined): string {
		if (!value) return "";
		const d = value instanceof Date ? value : new Date(value);
		return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
	}

	/** Only emit an address when at least one line is filled, so an untouched form doesn't write an empty object. */
	private buildAddress(): Record<string, string> | undefined {
		const address = {
			street: this.street.trim(),
			city: this.city.trim(),
			state: this.state.trim(),
			postalCode: this.postalCode.trim(),
			country: this.country.trim(),
		};
		return Object.values(address).some((v) => v !== "") ? address : undefined;
	}

	private buildPreferences(): Record<string, unknown> | undefined {
		const preferences: Record<string, unknown> = {};
		if (this.prefRoomType.trim()) preferences["roomType"] = this.prefRoomType.trim();
		if (this.prefBedType.trim()) preferences["bedType"] = this.prefBedType.trim();
		if (this.prefFloor.trim()) preferences["floor"] = this.prefFloor.trim();
		if (this.prefLanguage.trim()) preferences["language"] = this.prefLanguage.trim();
		if (this.prefSmoking) preferences["smoking"] = true;
		if (this.prefDietary.trim()) preferences["dietaryRestrictions"] = parseList(this.prefDietary);
		if (this.prefSpecialRequests.trim())
			preferences["specialRequests"] = parseList(this.prefSpecialRequests);
		// VIP and loyalty stay in the JSONB alongside the rest, matching what the
		// register/profile commands already accept.
		if (this.vipStatus) preferences["vip_status"] = this.vipStatus;
		if (this.loyaltyTier) preferences["loyalty_tier"] = this.loyaltyTier;
		return Object.keys(preferences).length > 0 ? preferences : undefined;
	}

	async save(): Promise<void> {
		if (!this.isValid || this.saving()) return;
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);
		this.fieldErrors.set({});

		const body = {
			first_name: this.firstName.trim(),
			last_name: this.lastName.trim(),
			email: this.email.trim(),
			phone: this.phone.trim() || undefined,
			title: this.title || undefined,
			nationality: this.nationality.trim() || undefined,
			gender: this.gender || undefined,
			date_of_birth: this.dateOfBirth || undefined,
			company_name: this.companyName.trim() || undefined,
			address: this.buildAddress(),
			preferences: this.buildPreferences(),
		};

		try {
			const id = this.guestId();
			if (id) {
				await this.api.post(`/tenants/${tenantId}/guests/${id}/profile`, body);
				this.toast.success(this.i18n.t("Guest profile updated."));
				this.router.navigate(["/guests", id]);
			} else {
				await this.api.post("/guests", {
					tenant_id: tenantId,
					...body,
					loyalty_tier: this.loyaltyTier || undefined,
				});
				this.toast.success(this.i18n.t("Guest created."));
				this.router.navigate(["/guests"]);
			}
		} catch (e) {
			if (e instanceof ApiValidationError) {
				const errors: Record<string, string> = {};
				for (const fe of e.fieldErrors) {
					errors[fe.path] =
						fe.path === "date_of_birth" ? "Please enter a valid date (DD/MM/YYYY)" : fe.message;
				}
				this.fieldErrors.set(errors);
				this.toast.error(e.message);
			} else {
				this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to save guest"));
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		const id = this.guestId();
		this.router.navigate(id ? ["/guests", id] : ["/guests"]);
	}
}
