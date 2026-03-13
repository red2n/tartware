import sgMail from "@sendgrid/mail";
import type { PinoLogger } from "@tartware/telemetry";

import type {
  DispatchResult,
  NotificationPayload,
  NotificationProvider,
} from "./provider-interface.js";

/**
 * SendGrid email notification provider.
 *
 * Dispatches email notifications via the SendGrid v3 API.
 * Only supports the EMAIL channel; SMS/push notifications should use other providers.
 *
 * The provider creates a single instance and configures the SendGrid module-level
 * API key once at construction. Callers should memoize the instance (single provider
 * per process) to avoid redundant global-state mutation.
 */
export class SendGridNotificationProvider implements NotificationProvider {
  readonly name = "sendgrid";
  readonly supportedChannels = ["EMAIL"] as const;

  private readonly logger: PinoLogger;
  private readonly defaultSenderEmail: string;
  private readonly defaultSenderName: string;

  constructor(
    logger: PinoLogger,
    apiKey: string,
    defaultSenderEmail = "noreply@tartware.com",
    defaultSenderName = "Tartware PMS",
  ) {
    this.logger = logger.child({ provider: "sendgrid" });
    this.defaultSenderEmail = defaultSenderEmail;
    this.defaultSenderName = defaultSenderName;
    sgMail.setApiKey(apiKey);
  }

  async dispatch(payload: NotificationPayload): Promise<DispatchResult> {
    if (!payload.recipientEmail) {
      return {
        success: false,
        error: "No recipient email address provided",
        provider: this.name,
      };
    }

    try {
      const [response] = await sgMail.send({
        to: payload.recipientEmail,
        from: {
          email: payload.senderEmail ?? this.defaultSenderEmail,
          name: payload.senderName ?? this.defaultSenderName,
        },
        subject: payload.subject,
        text: payload.body,
        html: payload.htmlBody ?? undefined,
      });

      const messageId = response.headers["x-message-id"] as string | undefined;

      this.logger.info(
        {
          to: payload.recipientEmail,
          subject: payload.subject,
          statusCode: response.statusCode,
          messageId,
        },
        "SendGrid email dispatched",
      );

      return {
        success: true,
        externalMessageId: messageId,
        provider: this.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { err: error, to: payload.recipientEmail, subject: payload.subject },
        "SendGrid dispatch failed",
      );
      return {
        success: false,
        error: message,
        provider: this.name,
      };
    }
  }
}
