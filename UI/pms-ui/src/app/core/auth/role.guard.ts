import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";

import type { TenantRole } from "@tartware/schemas";

import { hasMinRole, findFirstAllowedRoute } from "../../layout/nav-config";
import { AuthService } from "./auth.service";
import { ScreenPermissionsService } from "./screen-permissions.service";

/**
 * Factory that creates a route guard requiring a minimum tenant role.
 * If the user's role is below the minimum, they are redirected to /dashboard.
 */
export function roleGuard(minRole: TenantRole): CanActivateFn {
	return () => {
		const auth = inject(AuthService);
		const router = inject(Router);
		const screenPerms = inject(ScreenPermissionsService);

		const membership = auth.activeMembership();
		if (!membership) {
			return router.createUrlTree(["/login"]);
		}

		if (hasMinRole(membership.role, minRole)) {
			return true;
		}

		const fallback = findFirstAllowedRoute(screenPerms.allowedScreens());
		return router.createUrlTree([fallback]);
	};
}

/**
 * Factory that creates a route guard checking DB-driven screen permissions.
 * Falls back to allowing access if permissions haven't loaded yet (fail-open).
 */
export function screenGuard(screenKey: string): CanActivateFn {
	return () => {
		const auth = inject(AuthService);
		const router = inject(Router);
		const screenPerms = inject(ScreenPermissionsService);

		const membership = auth.activeMembership();
		if (!membership) {
			return router.createUrlTree(["/login"]);
		}

		if (screenPerms.isScreenAllowed(screenKey)) {
			return true;
		}

		const fallback = findFirstAllowedRoute(screenPerms.allowedScreens());
		return router.createUrlTree([fallback]);
	};
}
