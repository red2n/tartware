import { computed, effect, Injectable, inject, signal } from "@angular/core";

import type { Property } from "@tartware/schemas";

import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";

export type PropertyOption = Pick<
	Property,
	"id" | "property_name" | "property_code"
>;

@Injectable({ providedIn: "root" })
export class TenantContextService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);

	private readonly _properties = signal<PropertyOption[]>([]);
	private readonly _propertyId = signal<string | null>(null);
	private readonly _loading = signal(false);

	readonly properties = this._properties.asReadonly();
	readonly propertyId = this._propertyId.asReadonly();
	readonly loading = this._loading.asReadonly();

	/** The currently-selected property option */
	readonly activeProperty = computed(() => {
		const pid = this._propertyId();
		if (!pid) return null;
		return this._properties().find((p) => p.id === pid) ?? null;
	});

	constructor() {
		// Restore saved property
		const savedPropertyId = localStorage.getItem("property_id");
		if (savedPropertyId) {
			this._propertyId.set(savedPropertyId);
		}

		// Reload properties whenever the tenant changes
		effect(() => {
			const tenantId = this.auth.tenantId();
			if (tenantId) {
				this.loadProperties(tenantId);
			} else {
				this._properties.set([]);
				this._propertyId.set(null);
			}
		});
	}

	selectProperty(propertyId: string | null): void {
		this._propertyId.set(propertyId);
		if (propertyId) {
			localStorage.setItem("property_id", propertyId);
		} else {
			localStorage.removeItem("property_id");
		}
	}

	/** Returns true if a property is already selected (from localStorage) */
	hasPropertySelected(): boolean {
		return this._propertyId() !== null;
	}

	/**
	 * Load properties for the given tenant (or current tenant).
	 * Returns the loaded property list so callers (e.g. login flow) can decide
	 * whether to show a picker dialog.
	 */
	async fetchProperties(tenantId?: string): Promise<PropertyOption[]> {
		const tid = tenantId ?? this.auth.tenantId();
		if (!tid) return [];
		return this.loadProperties(tid);
	}

	private async loadProperties(tenantId: string): Promise<PropertyOption[]> {
		this._loading.set(true);
		try {
			const items = await this.api.get<PropertyOption[]>("/properties", {
				tenant_id: tenantId,
			});
			this._properties.set(items);

			// Auto-select if only one property, or validate saved selection
			const savedId = this._propertyId();
			if (items.length === 1) {
				this.selectProperty(items[0].id);
			} else if (savedId && !items.find((p) => p.id === savedId)) {
				// Saved property no longer valid for this tenant
				this.selectProperty(items[0]?.id ?? null);
			}
			return items;
		} catch {
			this._properties.set([]);
			return [];
		} finally {
			this._loading.set(false);
		}
	}
}
