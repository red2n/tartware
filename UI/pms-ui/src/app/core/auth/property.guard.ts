import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";

import { TenantContextService } from "../context/tenant-context.service";

/**
 * Guard that redirects to /select-property when the user has multiple
 * properties and none is selected yet. Used on property-scoped routes
 * (dashboard, rooms, rates, etc.) but NOT on tenant-level routes like settings.
 */
export const propertyGuard: CanActivateFn = () => {
	const ctx = inject(TenantContextService);
	const router = inject(Router);

	if (ctx.hasPropertySelected()) {
		return true;
	}

	// If there are multiple properties and none selected, redirect
	if (ctx.properties().length > 1) {
		return router.createUrlTree(["/select-property"]);
	}

	// 0 or 1 property — auto-selected by service, allow through
	return true;
};
