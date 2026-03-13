import { computed, Injectable, inject, signal } from "@angular/core";

import type { ScreenPermissionEntry, TenantRole } from "@tartware/schemas";

import { ApiService } from "../api/api.service";
import { AuthService } from "./auth.service";

type RoleScreenPermissionsResponse = {
	role: TenantRole;
	screens: ScreenPermissionEntry[];
};

/**
 * Fetches and caches the role-based screen permissions for the current
 * user's tenant + role. Used by the sidebar and route guards to determine
 * which screens the user can access.
 */
@Injectable({ providedIn: "root" })
export class ScreenPermissionsService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);

	/** Raw screen permission entries for the current user's role. */
	private readonly _screens = signal<ScreenPermissionEntry[]>([]);
	private readonly _loaded = signal(false);

	/** Set of screen keys that are visible to the current user. */
	readonly allowedScreens = computed(() => {
		const screens = this._screens();
		return new Set(screens.filter((s) => s.is_visible).map((s) => s.screen_key));
	});

	/** Whether permissions have been loaded from the API. */
	readonly loaded = this._loaded.asReadonly();

	/**
	 * Fetch screen permissions for the user's current role.
	 * Called after login / tenant selection.
	 */
	async loadPermissions(): Promise<void> {
		const membership = this.auth.activeMembership();
		if (!membership) {
			this._screens.set([]);
			this._loaded.set(true);
			return;
		}

		const tenantId = this.auth.tenantId();
		if (!tenantId) {
			this._screens.set([]);
			this._loaded.set(true);
			return;
		}

		try {
			const response = await this.api.get<RoleScreenPermissionsResponse>(
				`/settings/screen-permissions/${membership.role}?tenant_id=${tenantId}`,
			);
			this._screens.set(response.screens);
		} catch {
			// If the API fails (e.g. first deploy before seed), allow all screens
			this._screens.set([]);
		}
		this._loaded.set(true);
	}

	/** Check if a specific screen is allowed for the current user. */
	isScreenAllowed(screenKey: string): boolean {
		// If permissions haven't loaded yet, allow all (fail-open for UX)
		if (!this._loaded()) return true;
		// If no permissions returned (empty set), allow all (backwards compat)
		if (this._screens().length === 0) return true;
		return this.allowedScreens().has(screenKey);
	}

	/** Reset state (call on logout). */
	clear(): void {
		this._screens.set([]);
		this._loaded.set(false);
	}
}
