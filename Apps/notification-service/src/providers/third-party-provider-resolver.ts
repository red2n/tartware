import type { PinoLogger } from "@tartware/telemetry";

import { ConsoleNotificationProvider } from "./console-provider.js";
import type { NotificationProvider } from "./provider-interface.js";
import { ResendNotificationProvider } from "./resend-provider.js";
import { SendGridNotificationProvider } from "./sendgrid-provider.js";
import { WebhookNotificationProvider } from "./webhook-provider.js";

let cachedProvider: NotificationProvider | null = null;
let cachedProviderKey: string | null = null;

/**
 * Resolve the active third-party provider once and memoize it.
 *
 * This keeps external integration wiring isolated from notification business logic.
 */
export const resolveThirdPartyProvider = (
  logger: PinoLogger,
  defaultChannel: string,
  sendgridApiKey: string,
  resendApiKey: string,
  resendSenderDomain: string,
  resendSenderEmail: string,
  webhookUrl: string,
  defaultSenderEmail: string,
  defaultSenderName: string,
): NotificationProvider => {
  const key = `${defaultChannel}:${sendgridApiKey ? "sendgrid" : ""}:${resendApiKey ? "resend" : ""}:${resendSenderDomain}:${resendSenderEmail}:${webhookUrl ? "webhook" : ""}:${defaultSenderEmail}:${defaultSenderName}`;

  if (cachedProvider && cachedProviderKey === key) {
    return cachedProvider;
  }

  if (defaultChannel === "sendgrid" && sendgridApiKey) {
    cachedProvider = new SendGridNotificationProvider(
      logger,
      sendgridApiKey,
      defaultSenderEmail,
      defaultSenderName,
    );
  } else if (defaultChannel === "resend" && resendApiKey) {
    cachedProvider = new ResendNotificationProvider(
      logger,
      resendApiKey,
      resendSenderEmail,
      resendSenderDomain,
      defaultSenderName,
    );
  } else if (defaultChannel === "webhook" && webhookUrl) {
    cachedProvider = new WebhookNotificationProvider(logger, webhookUrl);
  } else {
    cachedProvider = new ConsoleNotificationProvider(logger);
  }

  cachedProviderKey = key;
  return cachedProvider;
};
