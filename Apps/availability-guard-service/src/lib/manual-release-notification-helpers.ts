import type { ManualReleaseNotification } from "@tartware/schemas";

// Re-export for consumers
export type { ManualReleaseNotification };

export type RecipientBuckets = {
  email: string[];
  sms: string[];
  slack: string[];
};

export const dedupeRecipients = (values: string[]): string[] => {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
};

const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;
const slackRegex = /^(?:slack:)?[@#][\w.-]+$/i;

const stripSlackPrefix = (recipient: string): string => {
  return recipient.replace(/^slack:/i, "");
};

export const classifyRecipients = (recipients: string[]): RecipientBuckets => {
  const buckets: RecipientBuckets = { email: [], sms: [], slack: [] };

  for (const recipient of recipients) {
    if (phoneRegex.test(recipient)) {
      buckets.sms.push(recipient);
    } else if (slackRegex.test(recipient)) {
      buckets.slack.push(stripSlackPrefix(recipient));
    } else if (emailRegex.test(recipient)) {
      buckets.email.push(recipient.toLowerCase());
    } else {
      buckets.email.push(recipient);
    }
  }

  return buckets;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${dateFormatter.format(date)} UTC`;
};

export type NotificationSummary = {
  subject: string;
  plainText: string;
  htmlBody: string;
  slackText: string;
  smsText: string;
  metadata: Record<string, unknown>;
};

export const buildNotificationSummary = (
  payload: ManualReleaseNotification,
): NotificationSummary => {
  const stayWindow = `${formatDate(payload.stayStart)} → ${formatDate(payload.stayEnd)}`;
  const roomLabel = payload.roomId
    ? `${payload.roomTypeId} / ${payload.roomId}`
    : payload.roomTypeId;

  const metadata = {
    lockId: payload.lockId,
    tenantId: payload.tenantId,
    reservationId: payload.reservationId,
    roomTypeId: payload.roomTypeId,
    roomId: payload.roomId,
    stayStart: payload.stayStart,
    stayEnd: payload.stayEnd,
    reason: payload.reason,
    actor: payload.actor,
  };

  const plainText = [
    `Lock ${payload.lockId} was manually released`,
    `Tenant: ${payload.tenantId}`,
    `Reservation: ${payload.reservationId ?? "N/A"}`,
    `Room: ${roomLabel}`,
    `Stay: ${stayWindow}`,
    `Actor: ${payload.actor.name} (${payload.actor.id})`,
    `Reason: ${payload.reason}`,
  ].join("\n");

  const htmlBody = `
    <p>Availability Guard recorded a manual release.</p>
    <ul>
      <li><strong>Lock:</strong> ${escapeHtml(payload.lockId)}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(payload.tenantId)}</li>
      <li><strong>Reservation:</strong> ${escapeHtml(
        payload.reservationId ?? "N/A",
      )}</li>
      <li><strong>Room:</strong> ${escapeHtml(roomLabel)}</li>
      <li><strong>Stay:</strong> ${escapeHtml(stayWindow)}</li>
      <li><strong>Actor:</strong> ${escapeHtml(
        `${payload.actor.name} (${payload.actor.id})`,
      )}</li>
    </ul>
    <p><strong>Reason:</strong> ${escapeHtml(payload.reason)}</p>
  `;

  const slackText = [
    ":warning: *Manual release recorded*",
    `• Lock: \`${payload.lockId}\``,
    `• Tenant: \`${payload.tenantId}\``,
    `• Reservation: \`${payload.reservationId ?? "N/A"}\``,
    `• Room: \`${roomLabel}\``,
    `• Stay: ${stayWindow}`,
    `• Actor: ${payload.actor.name}`,
    `• Reason: ${payload.reason}`,
  ].join("\n");

  const smsText = `Manual release ${roomLabel} (${stayWindow}). Reason: ${payload.reason}. Actor: ${payload.actor.name}.`;

  return {
    subject: `[Availability Guard] Manual release recorded for lock ${payload.lockId}`,
    plainText,
    htmlBody,
    slackText,
    smsText,
    metadata,
  };
};
