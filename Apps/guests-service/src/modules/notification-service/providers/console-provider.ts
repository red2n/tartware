import type { PinoLogger } from "@tartware/telemetry";

import type {
  DispatchResult,
  NotificationPayload,
  NotificationProvider,
} from "./provider-interface.js";

/**
 * Console notification provider — logs notifications to stdout.
 *
 * Used in development and testing environments. Does not send real messages.
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";
  readonly supportedChannels = ["EMAIL", "SMS", "WHATSAPP", "PUSH_NOTIFICATION"] as const;

  private readonly logger: PinoLogger;

  constructor(logger: PinoLogger) {
    this.logger = logger.child({ provider: "console" });
  }

  async dispatch(payload: NotificationPayload): Promise<DispatchResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.logger.info(
      {
        messageId,
        to: payload.recipientEmail ?? payload.recipientPhone ?? payload.recipientName,
        subject: payload.subject,
        bodyLength: payload.body.length,
        sender: payload.senderName ?? "system",
      },
      `[NOTIFICATION] ${payload.subject}`,
    );

    return {
      success: true,
      externalMessageId: messageId,
      provider: this.name,
    };
  }
}
