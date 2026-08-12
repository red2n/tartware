import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { FxRateItem } from "@tartware/schemas";
import { convertCurrency, getCurrencyExponent } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { CalloutComponent } from "../../../shared/components/callout/callout";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../../shared/toast/toast.service";
import { COMMON_CURRENCIES } from "../../select-property/create-property-dialog/reference-data";

/** A property's base currency alongside how many rate hops it needs. */
interface PropertyCurrencyRow {
	propertyId: string;
	propertyName: string;
	currency: string;
	exponent: number;
	isActive: boolean;
	/** True when this property's currency has a rate to the active base today. */
	hasRate: boolean;
}

@Component({
	selector: "app-currency-config",
	standalone: true,
	imports: [
		FormsModule,
		CalloutComponent,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
		UnsavedGuardDirective,
		SubmitOnEnterDirective,
	],
	templateUrl: "./currency-config.html",
	styleUrl: "./currency-config.scss",
})
export class CurrencyConfigComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly currencies = COMMON_CURRENCIES;

	// ── State ──
	readonly rates = signal<FxRateItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly saving = signal(false);

	/** Date the rates apply to. Rates are a daily snapshot, so this drives everything. */
	readonly rateDate = signal(new Date().toISOString().slice(0, 10));

	// ── New / correcting rate form ──
	readonly showForm = signal(false);
	readonly formFrom = signal("EUR");
	readonly formTo = signal("USD");
	readonly formRate = signal<string>("");
	readonly formSourceRef = signal("");

	/** The base currency of the property currently in context. */
	readonly baseCurrency = computed(() => this.settings.baseCurrency());

	/** Decimal places the base currency is denominated in. */
	readonly baseExponent = computed(() => getCurrencyExponent(this.baseCurrency()));

	/**
	 * Every distinct currency across the tenant's properties.
	 *
	 * This is what makes the screen actionable: a rate is only needed for pairs
	 * the estate actually transacts in, so the missing-rate warnings below are
	 * derived from real properties rather than the whole ISO 4217 list.
	 */
	readonly propertyCurrencies = computed<PropertyCurrencyRow[]>(() => {
		const base = this.baseCurrency();
		const activeId = this.ctx.propertyId();
		const todaysRates = this.rates();

		return this.ctx
			.properties()
			.map((p) => {
				const currency = p.currency || "USD";
				const hasRate =
					currency === base ||
					todaysRates.some((r) => r.from_currency === currency && r.to_currency === base);
				return {
					propertyId: p.id,
					propertyName: p.property_name,
					currency,
					exponent: getCurrencyExponent(currency),
					isActive: p.id === activeId,
					hasRate,
				};
			})
			.sort((a, b) => a.propertyName.localeCompare(b.propertyName));
	});

	/**
	 * Currencies in use by a property that have no rate to the base currency today.
	 *
	 * Without a rate the posting path falls back to 1.0, which records a ¥29,000
	 * charge as 29,000 in the base currency — so this is the one warning on the
	 * screen that represents live financial risk rather than tidiness.
	 */
	readonly missingRates = computed(() =>
		this.propertyCurrencies().filter((p) => !p.hasRate && p.currency !== this.baseCurrency()),
	);

	/** Live preview of the rate being entered, at the target currency's precision. */
	readonly preview = computed(() => {
		const rate = this.formRate().trim();
		if (!rate || Number.isNaN(Number(rate)) || Number(rate) <= 0) return null;
		const to = this.formTo();
		return {
			amount: 100,
			from: this.formFrom(),
			to,
			converted: convertCurrency(100, rate, to),
			exponent: getCurrencyExponent(to),
		};
	});

	readonly formValid = computed(() => {
		const rate = Number(this.formRate());
		return (
			this.formFrom().length === 3 &&
			this.formTo().length === 3 &&
			this.formFrom() !== this.formTo() &&
			Number.isFinite(rate) &&
			rate > 0
		);
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.rateDate();
			void this.loadRates();
		});
	}

	async loadRates(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.dataReady.set(false);
		this.error.set(null);
		try {
			const res = await this.api.get<{ data: FxRateItem[] }>("/billing/fx-rates", {
				tenant_id: tenantId,
				rate_date: this.rateDate(),
			});
			this.rates.set(res.data ?? []);
		} catch (e) {
			this.rates.set([]);
			this.error.set(
				e instanceof Error ? e.message : "FX rate list is not currently available through the API.",
			);
		} finally {
			this.dataReady.set(true);
		}
	}

	// ── Form ──

	openForm(from?: string, to?: string): void {
		this.formFrom.set(from ?? "EUR");
		this.formTo.set(to ?? this.baseCurrency());
		this.formRate.set("");
		this.formSourceRef.set("");
		this.showForm.set(true);
	}

	/** Pre-fill the form for a property currency that has no rate yet. */
	fixMissing(row: PropertyCurrencyRow): void {
		this.openForm(row.currency, this.baseCurrency());
	}

	/** Load an existing rate into the form so it can be corrected in place. */
	editRate(r: FxRateItem): void {
		this.formFrom.set(r.from_currency);
		this.formTo.set(r.to_currency);
		this.formRate.set(String(r.rate));
		this.formSourceRef.set(r.rate_source_ref ?? "");
		this.showForm.set(true);
	}

	cancelForm(): void {
		this.showForm.set(false);
	}

	async saveRate(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.formValid()) return;

		this.saving.set(true);
		try {
			await this.api.post("/billing/fx-rates", {
				tenant_id: tenantId,
				from_currency: this.formFrom(),
				to_currency: this.formTo(),
				rate: Number(this.formRate()),
				rate_date: this.rateDate(),
				rate_source: "MANUAL",
				rate_source_ref: this.formSourceRef() || undefined,
			});
			// Re-posting the same pair on the same date corrects it in place rather
			// than creating a second row, so save and edit are the same call.
			this.toast.success(`Rate ${this.formFrom()} → ${this.formTo()} saved.`);
			this.showForm.set(false);
			await this.loadRates();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save FX rate.");
		} finally {
			this.saving.set(false);
		}
	}

	/** Swap the pair, inverting the entered rate so the form stays meaningful. */
	swapPair(): void {
		const from = this.formFrom();
		const rate = Number(this.formRate());
		this.formFrom.set(this.formTo());
		this.formTo.set(from);
		if (Number.isFinite(rate) && rate > 0) {
			this.formRate.set((1 / rate).toFixed(6));
		}
	}

	// ── Display helpers ──

	currencyName(code: string): string {
		return this.currencies.find((c) => c.code === code)?.name ?? code;
	}

	exponentOf(code: string): number {
		return getCurrencyExponent(code);
	}

	/** "2 decimals" / "no decimals" / "3 decimals" — plain language for the table. */
	exponentLabel(code: string): string {
		const dp = getCurrencyExponent(code);
		if (dp === 0) return "no decimals";
		return `${dp} decimals`;
	}

	/** Sample of one unit converted, so a wrong rate is visible at a glance. */
	sampleConversion(r: FxRateItem): string {
		const converted = convertCurrency(1, String(r.rate), r.to_currency);
		return `1 ${r.from_currency} = ${converted} ${r.to_currency}`;
	}

	formatDate(d: string): string {
		return this.settings.formatDate(d);
	}

	isGlobal(r: FxRateItem): boolean {
		return r.tenant_id === null;
	}

	shiftDate(days: number): void {
		const d = new Date(`${this.rateDate()}T00:00:00`);
		d.setDate(d.getDate() + days);
		this.rateDate.set(d.toISOString().slice(0, 10));
	}

	today(): void {
		this.rateDate.set(new Date().toISOString().slice(0, 10));
	}
}
