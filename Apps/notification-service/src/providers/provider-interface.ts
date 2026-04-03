/**
 * Notification provider abstraction.
 *
 * Each provider handles delivery through a specific channel (console, webhook, email, SMS).
 * Providers are selected at dispatch time based on the communication_type.
 */

export type {
  DispatchResult,
  NotificationPayload,
  NotificationProvider,
} from "@tartware/schemas";
