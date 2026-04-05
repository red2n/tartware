import { computed, effect, Injectable, signal } from "@angular/core";

import type { SettingsDefinition, SettingsValue } from "@tartware/schemas";

import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";

interface CatalogResponse {
	data: {
		definitions: SettingsDefinition[];
	};
}

interface ValuesResponse {
	data: SettingsValue[];
	meta: { count: number; sampleTenantId: string | null };
}

/**
 * Provides reactive access to all tenant settings with automatic default fallback.
 * On tenant change, settings are reloaded. All features should read settings through
 * the getBool / getNumber / getString helpers rather than raw getValue.
 */
@Injectable({ providedIn: "root" })
export class SettingsService {
	/** code → resolved value (configured value or definition default) */
	private readonly _map = signal<Map<string, unknown>>(new Map());
	private readonly _loaded = signal(false);

	readonly loaded = this._loaded.asReadonly();

	constructor(
		private readonly api: ApiService,
		private readonly auth: AuthService,
	) {
		effect(() => {
			const tenantId = this.auth.tenantId();
			if (tenantId) {
				void this.load(tenantId);
			} else {
				this._map.set(new Map());
				this._loaded.set(false);
			}
		});
	}

	private async load(tenantId: string): Promise<void> {
		try {
			const [catalog, values] = await Promise.all([
				this.api.get<CatalogResponse>("/settings/catalog"),
				this.api.get<ValuesResponse>("/settings/values", { tenant_id: tenantId }),
			]);

			const definitions = catalog.data?.definitions ?? [];
			const savedValues = values.data ?? [];

			// Build id → code mapping from definitions
			const idToCode = new Map<string, string>();
			const codeToDefault = new Map<string, unknown>();
			for (const def of definitions) {
				idToCode.set(def.id, def.code);
				if (def.default_value !== undefined) {
					codeToDefault.set(def.code, def.default_value);
				}
			}

			// Start with all defaults
			const map = new Map<string, unknown>(codeToDefault);

			// Override with configured values
			for (const sv of savedValues) {
				const code = idToCode.get(sv.setting_id);
				if (code && sv.value !== null && sv.value !== undefined) {
					map.set(code, sv.value);
				}
			}

			this._map.set(map);
			this._loaded.set(true);
		} catch {
			// Fail silently — screens fall back to their hardcoded defaults
			this._loaded.set(true);
		}
	}

	// ── Convenience signals ───────────────────────────────────────────────────
	/** ISO 4217 currency code for the tenant (e.g. "USD"). */
	readonly baseCurrency = computed(() => this.getString("property.base_currency", "USD"));
	/** BCP 47 locale for number/date display (e.g. "en-US"). */
	readonly locale = computed(() => this.getString("property.locale", "en-US"));
	/** Date format token: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD". */
	readonly dateFormat = computed(() => this.getString("ui.date_format", "MM/DD/YYYY"));
	/** Time format: "12h" | "24h". */
	readonly timeFormat = computed(() => this.getString("ui.time_format", "12h"));

	// ── Primitive accessors ───────────────────────────────────────────────────

	/** Returns raw resolved value for a setting code, or undefined if not found. */
	getValue(code: string): unknown {
		return this._map().get(code);
	}

	/**
	 * Returns the setting as a boolean.
	 * JSON-string "true"/"false" from the DB are handled automatically.
	 */
	getBool(code: string, fallback = false): boolean {
		const v = this.getValue(code);
		if (v === undefined || v === null) return fallback;
		if (typeof v === "boolean") return v;
		if (v === "true" || v === 1) return true;
		if (v === "false" || v === 0) return false;
		if (typeof v === "string") {
			const lower = v.replace(/^"|"$/g, "").toLowerCase();
			if (lower === "true") return true;
			if (lower === "false") return false;
		}
		return fallback;
	}

	/** Returns the setting as a number. */
	getNumber(code: string, fallback = 0): number {
		const v = this.getValue(code);
		if (v === undefined || v === null) return fallback;
		const n = Number(v);
		return Number.isFinite(n) ? n : fallback;
	}

	/**
	 * Returns the setting as a string.
	 * Strips surrounding double-quotes that come from JSON string encoding (e.g. `"15:00"` → `15:00`).
	 */
	getString(code: string, fallback = ""): string {
		const v = this.getValue(code);
		if (v === undefined || v === null) return fallback;
		if (typeof v === "string") return v.replace(/^"|"$/g, "");
		return String(v);
	}

	// ── Formatting helpers (settings-aware) ──────────────────────────────────

	/**
	 * Formats a date string using the tenant's `ui.date_format` and `property.locale` settings.
	 * Accepts an ISO date string (YYYY-MM-DD) or any Date-parseable string.
	 */
	formatDate(dateStr: string): string {
		if (!dateStr) return "";
		// Parse date-only strings as local dates to avoid UTC off-by-one
		let d: Date;
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
			const [y, m, day] = dateStr.split("-").map(Number);
			d = new Date(y, m - 1, day);
		} else {
			d = new Date(dateStr);
		}
		if (!Number.isFinite(d.getTime())) return dateStr;

		const fmt = this.dateFormat();
		const locale = this.locale();

		if (fmt === "YYYY-MM-DD") {
			return d.toLocaleDateString("en-CA"); // en-CA produces YYYY-MM-DD
		}
		if (fmt === "DD/MM/YYYY") {
			return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
		}
		// Default: MM/DD/YYYY — use en-US short
		return d.toLocaleDateString(locale || "en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	/**
	 * Formats a time value (Date or time string like "15:00") using the tenant's `ui.time_format`.
	 * Returns a formatted string such as "3:00 PM" (12h) or "15:00" (24h).
	 */
	formatTime(value: string | Date): string {
		let d: Date;
		if (typeof value === "string") {
			// Handle "HH:mm" time-only strings by attaching to today's date
			if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
				const [h, m] = value.split(":").map(Number);
				d = new Date();
				d.setHours(h, m, 0, 0);
			} else {
				d = new Date(value);
			}
		} else {
			d = value;
		}
		if (!Number.isFinite(d.getTime())) return String(value);

		const use24h = this.timeFormat() === "24h";
		return d.toLocaleTimeString(this.locale() || "en-US", {
			hour: use24h ? "2-digit" : "numeric",
			minute: "2-digit",
			hour12: !use24h,
		});
	}

	/**
	 * Formats a monetary amount using the tenant's base currency.
	 * Falls back to USD if no currency is configured.
	 */
	formatCurrency(amount: number, currencyOverride?: string): string {
		const currency = currencyOverride ?? this.baseCurrency();
		return new Intl.NumberFormat(this.locale() || "en-US", {
			style: "currency",
			currency: currency || "USD",
		}).format(amount);
	}
}
