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
 */
export class SendGridNotificationProvider implements NotificationProvider {
  readonly name = "sendgrid";
  readonly supportedChannels = ["EMAIL"] as const;

  private readonly logger: PinoLogger;

  constructor(logger: PinoLogger, apiKey: string) {
    this.logger = logger.child({ provider: "sendgrid" });
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
          email: payload.senderEmail ?? "noreply@tartware.com",
          name: payload.senderName ?? "Tartware PMS",
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
