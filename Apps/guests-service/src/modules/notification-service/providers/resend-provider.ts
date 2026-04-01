import type { PinoLogger } from "@tartware/telemetry";
import { Resend } from "resend";

import type {
  DispatchResult,
  NotificationPayload,
  NotificationProvider,
} from "./provider-interface.js";

/**
 * Resend email notification provider.
 *
 * Uses the Resend Node SDK for EMAIL channel delivery.
 */
export class ResendNotificationProvider implements NotificationProvider {
  readonly name = "resend";
  readonly supportedChannels = ["EMAIL"] as const;

  private readonly logger: PinoLogger;
  private readonly defaultSenderEmail: string;
  private readonly senderDomain: string;
  private readonly defaultSenderName: string;
  private readonly resend: Resend;

  constructor(
    logger: PinoLogger,
    apiKey: string,
    defaultSenderEmail = "noreply@swaas.tech",
    senderDomain = "swaas.tech",
    defaultSenderName = "Tartware PMS",
  ) {
    this.logger = logger.child({ provider: "resend" });
    this.defaultSenderEmail = defaultSenderEmail;
    this.senderDomain = senderDomain.toLowerCase();
    this.defaultSenderName = defaultSenderName;
    this.resend = new Resend(apiKey);
  }

  private resolveSenderEmail(senderEmail?: string): string {
    if (!senderEmail) {
      return this.defaultSenderEmail;
    }

    const normalized = senderEmail.trim().toLowerCase();
    if (normalized.endsWith(`@${this.senderDomain}`)) {
      return senderEmail;
    }

    this.logger.warn(
      { senderEmail, allowedDomain: this.senderDomain, fallback: this.defaultSenderEmail },
      "Sender email is outside allowed Resend domain; using default sender",
    );
    return this.defaultSenderEmail;
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
      const fromEmail = this.resolveSenderEmail(payload.senderEmail);

      const response = await this.resend.emails.send({
        from: `${payload.senderName ?? this.defaultSenderName} <${fromEmail}>`,
        to: [payload.recipientEmail],
        subject: payload.subject,
        text: payload.body,
        html: payload.htmlBody ?? undefined,
      });

      const messageId = response.data?.id;
      const error = response.error;

      if (error) {
        const errorMessage =
          typeof error.message === "string" && error.message.length > 0
            ? error.message
            : "Resend returned an unknown error";

        this.logger.error(
          { to: payload.recipientEmail, subject: payload.subject, error },
          "Resend dispatch failed",
        );

        return {
          success: false,
          error: errorMessage,
          provider: this.name,
        };
      }

      this.logger.info(
        {
          to: payload.recipientEmail,
          subject: payload.subject,
          messageId,
        },
        "Resend email dispatched",
      );

      return {
        success: true,
        externalMessageId: messageId,
        provider: this.name,
      };
    } catch (dispatchError) {
      const message =
        dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
      this.logger.error(
        { err: dispatchError, to: payload.recipientEmail, subject: payload.subject },
        "Resend dispatch threw an error",
      );

      return {
        success: false,
        error: message,
        provider: this.name,
      };
    }
  }
}
