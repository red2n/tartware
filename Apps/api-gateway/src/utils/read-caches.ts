/**
 * DEV DOC
 * Module: utils/read-caches.ts
 * Purpose: The booking funnel's two cached reads, owned in one place so any
 *          route that changes what they would answer can drop them.
 * Ownership: api-gateway
 *
 * Both caches used to be created inside `registerRoomRoutes`, which meant only
 * that file could invalidate them. Rate writes did, because they live there;
 * **allotment writes did not, because they live in `booking-config-routes.ts`
 * and had no way to reach the cache.** A contracted room block takes rooms out
 * of sale the moment it is created, and for the next two seconds the funnel
 * went on offering them.
 *
 * That surfaced as an E2E failure reading `expected=2 actual=4` — which looks
 * exactly like a room block that does not hold inventory, and was in fact a
 * search answered from cache. The invariant was fine; the test measured through
 * a stale window. Two seconds is small, but it is small in the one direction
 * that matters least: the window opens immediately after someone deliberately
 * removes inventory from sale.
 *
 * Module-level singletons rather than per-registration instances, because
 * "invalidate the availability cache" has to mean the same object no matter
 * which route family is doing the invalidating. `targetBaseUrl` stays a thunk
 * so config is read at request time, as it was.
 */

import { cachedReadConfig, serviceTargets } from "../config.js";

import { createCachedRead } from "./cached-read.js";

/**
 * Availability search — the funnel's hottest read.
 *
 * See `cached-read.ts` for why caching it does not risk overbooking:
 * availability-guard-service prevents that when a command is *applied*, not
 * when a search is answered.
 */
export const availabilityRead = createCachedRead({
  name: "rooms-availability",
  ttlMs: cachedReadConfig.availabilityTtlMs,
  maxSize: cachedReadConfig.maxEntries,
  targetBaseUrl: () => serviceTargets.roomsServiceUrl,
});

/** Rate lookup — longer TTL, because it is invalidated on write. */
export const ratesRead = createCachedRead({
  name: "rates",
  ttlMs: cachedReadConfig.ratesTtlMs,
  maxSize: cachedReadConfig.maxEntries,
  targetBaseUrl: () => serviceTargets.roomsServiceUrl,
});

/**
 * Drop both cached reads for one tenant.
 *
 * Called by every write that changes what a search or a quote should say — a
 * rate, and any allotment operation. Availability goes with rates rather than
 * alone: a rate write can change which rooms a search returns at all.
 */
export const invalidateFunnelReads = (tenantId: string | undefined): void => {
  if (!tenantId) return;
  ratesRead.invalidateTenant(tenantId);
  availabilityRead.invalidateTenant(tenantId);
};
