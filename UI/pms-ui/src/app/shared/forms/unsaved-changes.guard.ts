import { inject } from "@angular/core";
import type { CanDeactivateFn } from "@angular/router";

import { UnsavedChangesService } from "./unsaved-changes.service";

/**
 * Stops a route change from silently throwing away a half-filled page (New
 * Reservation, New Group). The page itself only has to pull in
 * UnsavedGuardDirective — via hostDirectives — for its input to be tracked.
 */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () =>
	inject(UnsavedChangesService).confirmLeave();
