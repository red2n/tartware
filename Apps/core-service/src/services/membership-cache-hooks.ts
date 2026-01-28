import { appLogger } from "../lib/logger.js";

import { userCacheService } from "./user-cache-service.js";

/**
 * Reasons for invalidating user membership cache entries.
 */
export type MembershipCacheInvalidationReason =
  | "PASSWORD_UPDATED"
  | "USER_PROFILE_UPDATED"
  | "TENANT_MEMBERSHIP_MUTATED"
  | "TENANT_MEMBERSHIP_REMOVED"
  | "TENANT_MEMBERSHIP_ADDED"
  | "BULK_OPERATION"
  | (string & { readonly __membershipReasonBrand?: never });

/**
 * Membership cache invalidation event payload.
 */
export type MembershipCacheInvalidationEvent = {
  userId: string;
  username?: string;
  reason: MembershipCacheInvalidationReason;
  metadata?: Record<string, unknown>;
};

type MembershipCacheInvalidationHandler = (
  event: MembershipCacheInvalidationEvent,
) => Promise<void> | void;

const membershipCacheInvalidationHandlers = new Set<MembershipCacheInvalidationHandler>();

/**
 * Register a handler for membership cache invalidation events.
 */
export const registerMembershipCacheInvalidationHandler = (
  handler: MembershipCacheInvalidationHandler,
): (() => void) => {
  membershipCacheInvalidationHandlers.add(handler);
  return () => membershipCacheInvalidationHandlers.delete(handler);
};

const defaultInvalidationHandler: MembershipCacheInvalidationHandler = async (event) => {
  await userCacheService.invalidateUser(event.userId, event.username);
  appLogger.debug(
    {
      userId: event.userId,
      reason: event.reason,
    },
    "membership cache invalidated",
  );
};

registerMembershipCacheInvalidationHandler(async (event) => {
  try {
    await defaultInvalidationHandler(event);
  } catch (error) {
    appLogger.error(
      { err: error, userId: event.userId, reason: event.reason },
      "membership cache invalidation handler failed",
    );
  }
});

/**
 * Emit a membership cache invalidation event to all handlers.
 */
export const emitMembershipCacheInvalidation = async (
  event: MembershipCacheInvalidationEvent,
): Promise<void> => {
  await Promise.all(
    Array.from(membershipCacheInvalidationHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        appLogger.error(
          { err: error, userId: event.userId, reason: event.reason },
          "membership cache invalidation listener threw",
        );
      }
    }),
  );
};
