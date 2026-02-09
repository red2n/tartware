/**
 * Notification provider abstraction.
 *
 * Each provider handles delivery through a specific channel (console, webhook, email, SMS).
 * Providers are selected at dispatch time based on the communication_type.
 */

export type NotificationPayload = {
  /** Recipient display name */
  recipientName: string;
  /** Recipient email (for email channel) */
  recipientEmail?: string;
  /** Recipient phone (for SMS channel) */
  recipientPhone?: string;
  /** Notification subject */
  subject: string;
  /** Plain text body */
  body: string;
  /** HTML body (for email) */
  htmlBody?: string;
  /** Sender display name */
  senderName?: string;
  /** Sender email */
  senderEmail?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
};

export type DispatchResult = {
  /** Whether the dispatch succeeded */
  success: boolean;
  /** External provider message ID (e.g., SendGrid message ID) */
  externalMessageId?: string;
  /** Error message on failure */
  error?: string;
  /** Provider name that handled delivery */
  provider: string;
};

/**
 * Interface for notification delivery providers.
 *
 * Implementations must be stateless and safe for concurrent invocations.
 */
export interface NotificationProvider {
  /** Unique provider identifier */
  readonly name: string;

  /** Supported communication channels */
  readonly supportedChannels: ReadonlyArray<string>;

  /**
   * Dispatch a notification to the recipient.
   *
   * @param payload - The notification content and recipient details
   * @returns Result of the dispatch attempt
   */
  dispatch(payload: NotificationPayload): Promise<DispatchResult>;
}
