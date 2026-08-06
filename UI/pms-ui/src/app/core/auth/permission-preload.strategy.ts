import { inject, Injectable } from "@angular/core";
import type { PreloadingStrategy, Route } from "@angular/router";
import { EMPTY, type Observable } from "rxjs";

import { ScreenPermissionsService } from "./screen-permissions.service";

/**
 * Preloads only the screens the signed-in user can actually open.
 *
 * The app previously used `PreloadAllModules`, which pulls every lazy chunk in
 * the background — including the ~26 screens a given role is not permitted to
 * reach. Those downloads can never be used: `screenGuard` blocks the route
 * regardless.
 *
 * Routes carry their screen key in `data.screen`, mirroring the key already
 * passed to `screenGuard`, so permission lives in exactly one place.
 *
 * Unguarded lazy routes (login, select-property, the shell) preload normally —
 * every user needs them.
 */
@Injectable({ providedIn: "root" })
export class PermissionPreloadStrategy implements PreloadingStrategy {
	private readonly screenPerms = inject(ScreenPermissionsService);

	preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
		const screen = route.data?.["screen"] as string | undefined;

		if (!screen) {
			return load();
		}

		// isScreenAllowed fails open while permissions are still loading, which
		// is the behaviour we want: preloading should never be the thing that
		// makes a screen feel broken.
		return this.screenPerms.isScreenAllowed(screen) ? load() : EMPTY;
	}
}
