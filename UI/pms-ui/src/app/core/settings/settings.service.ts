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

	/** Signals for individual settings used by multiple screens */
	readonly checkInTime = computed(() => this.getString("property.check_in_time", "15:00"));
	readonly checkOutTime = computed(() => this.getString("property.check_out_time", "11:00"));
	readonly dateFormat = computed(() => this.getString("ui.date_format", "MM/DD/YYYY"));
	readonly timeFormat = computed(() => this.getString("ui.time_format", "12h"));

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
		// Handle JSON-encoded booleans stored as strings
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
}
