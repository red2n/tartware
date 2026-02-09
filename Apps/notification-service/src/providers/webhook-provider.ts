import type { PinoLogger } from "@tartware/telemetry";

import type {
  DispatchResult,
  NotificationPayload,
  NotificationProvider,
} from "./provider-interface.js";

/**
 * Webhook notification provider — sends notifications via HTTP POST to a configured URL.
 *
 * Can be used to integrate with Slack, Microsoft Teams, custom notification endpoints,
 * or bridge to third-party email/SMS APIs.
 */
export class WebhookNotificationProvider implements NotificationProvider {
  readonly name = "webhook";
  readonly supportedChannels = ["EMAIL", "SMS", "WHATSAPP", "PUSH_NOTIFICATION"] as const;

  private readonly logger: PinoLogger;
  private readonly webhookUrl: string;
  private readonly timeoutMs: number;

  constructor(logger: PinoLogger, webhookUrl: string, timeoutMs = 5000) {
    this.logger = logger.child({ provider: "webhook" });
    this.webhookUrl = webhookUrl;
    this.timeoutMs = timeoutMs;
  }

  async dispatch(payload: NotificationPayload): Promise<DispatchResult> {
    if (!this.webhookUrl) {
      return {
        success: false,
        error: "Webhook URL not configured",
        provider: this.name,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: {
            name: payload.recipientName,
            email: payload.recipientEmail,
            phone: payload.recipientPhone,
          },
          subject: payload.subject,
          body: payload.body,
          htmlBody: payload.htmlBody,
          sender: {
            name: payload.senderName,
            email: payload.senderEmail,
          },
          metadata: payload.metadata,
          sentAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        this.logger.warn(
          { status: response.status, errorBody },
          "Webhook delivery returned non-OK status",
        );
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
          provider: this.name,
        };
      }

      const externalMessageId = response.headers.get("x-message-id") ?? undefined;
      return {
        success: true,
        externalMessageId,
        provider: this.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ err: error, url: this.webhookUrl }, "Webhook delivery failed");
      return {
        success: false,
        error: message,
        provider: this.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
