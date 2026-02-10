import type { PinoLogger } from "@tartware/telemetry";

import { config } from "../config.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { observeDispatchDuration, recordDispatch } from "../lib/metrics.js";
import { ConsoleNotificationProvider } from "../providers/console-provider.js";
import type { NotificationProvider } from "../providers/provider-interface.js";
import { WebhookNotificationProvider } from "../providers/webhook-provider.js";
import { renderTemplateByCode } from "./template-service.js";

const logger: PinoLogger = appLogger.child({ module: "notification-dispatch" });

/** Resolve the active provider based on config. */
const resolveProvider = (): NotificationProvider => {
  if (config.providers.defaultChannel === "webhook" && config.providers.webhookUrl) {
    return new WebhookNotificationProvider(logger, config.providers.webhookUrl);
  }
  return new ConsoleNotificationProvider(logger);
};

const INSERT_COMMUNICATION_SQL = `
  INSERT INTO guest_communications (
    tenant_id, property_id, guest_id, reservation_id, template_id,
    communication_type, direction, subject, message,
    sender_name, sender_email,
    recipient_name, recipient_email, recipient_phone,
    status, external_message_id, sent_at, metadata, created_by
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4, $5,
    $6, 'OUTBOUND', $7, $8,
    $9, $10,
    $11, $12, $13,
    $14, $15, $16, $17, $18::uuid
  )
  RETURNING id
`;

const UPDATE_COMMUNICATION_STATUS_SQL = `
  UPDATE guest_communications
  SET status = $3,
      external_message_id = COALESCE($4, external_message_id),
      sent_at = COALESCE($5, sent_at),
      failed_at = CASE WHEN $3 = 'FAILED' THEN CURRENT_TIMESTAMP ELSE failed_at END,
      failure_reason = $6,
      updated_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid AND id = $2::uuid
`;

type SendNotificationParams = {
  tenantId: string;
  propertyId: string;
  guestId: string;
  reservationId?: string | null;
  templateCode: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  context: Record<string, string | number | boolean | null | undefined>;
  initiatedBy?: string | null;
  idempotencyKey?: string | null;
};

/**
 * Send a notification to a guest using a template.
 *
 * 1. Renders the template with variable substitution
 * 2. Records the communication in `guest_communications`
 * 3. Dispatches via the configured provider
 * 4. Updates the communication status based on dispatch result
 *
 * @returns The communication record ID, or null if template was not found
 */
export const sendNotification = async (
  params: SendNotificationParams,
): Promise<{ communicationId: string; dispatched: boolean } | null> => {
  const startTime = Date.now();

  // 1. Render the template
  const rendered = await renderTemplateByCode(
    params.tenantId,
    params.templateCode,
    params.propertyId,
    params.context,
  );

  if (!rendered) {
    logger.warn(
      { tenantId: params.tenantId, templateCode: params.templateCode },
      "No active template found — cannot send notification",
    );
    return null;
  }

  // 2. Insert the communication record with QUEUED status
  const { rows } = await query<{ id: string }>(INSERT_COMMUNICATION_SQL, [
    params.tenantId,
    params.propertyId,
    params.guestId,
    params.reservationId ?? null,
    rendered.templateId,
    rendered.communicationType,
    rendered.subject,
    rendered.body,
    rendered.fromName,
    rendered.fromEmail,
    params.recipientName,
    params.recipientEmail ?? null,
    params.recipientPhone ?? null,
    "QUEUED",
    null, // external_message_id set after dispatch
    null, // sent_at set after dispatch
    params.idempotencyKey ? JSON.stringify({ idempotencyKey: params.idempotencyKey }) : null,
    params.initiatedBy,
  ]);

  const communicationId = rows[0]?.id;
  if (!communicationId) {
    throw new Error("Failed to insert communication record");
  }

  // 3. Dispatch via provider
  const provider = resolveProvider();
  const result = await provider.dispatch({
    recipientName: params.recipientName,
    recipientEmail: params.recipientEmail ?? undefined,
    recipientPhone: params.recipientPhone ?? undefined,
    subject: rendered.subject,
    body: rendered.body,
    htmlBody: rendered.htmlBody ?? undefined,
    senderName: rendered.fromName ?? undefined,
    senderEmail: rendered.fromEmail ?? undefined,
    metadata: { communicationId, templateCode: params.templateCode },
  });

  // 4. Update communication status
  const newStatus = result.success ? "SENT" : "FAILED";
  await query(UPDATE_COMMUNICATION_STATUS_SQL, [
    params.tenantId,
    communicationId,
    newStatus,
    result.externalMessageId ?? null,
    result.success ? new Date() : null,
    result.error ?? null,
  ]);

  const durationSeconds = (Date.now() - startTime) / 1000;
  recordDispatch(rendered.communicationType, result.success ? "sent" : "failed");
  observeDispatchDuration(rendered.communicationType, durationSeconds);

  if (result.success) {
    logger.info(
      {
        communicationId,
        templateCode: params.templateCode,
        guestId: params.guestId,
        channel: rendered.communicationType,
        provider: result.provider,
        externalMessageId: result.externalMessageId,
      },
      "Notification dispatched successfully",
    );
  } else {
    logger.error(
      {
        communicationId,
        templateCode: params.templateCode,
        guestId: params.guestId,
        channel: rendered.communicationType,
        error: result.error,
      },
      "Notification dispatch failed",
    );
  }

  return { communicationId, dispatched: result.success };
};

/**
 * List guest communications for a tenant/guest with pagination.
 */
export const listGuestCommunications = async (
  tenantId: string,
  guestId: string,
  limit = 50,
  offset = 0,
): Promise<unknown[]> => {
  const cappedLimit = Math.min(limit, 200);
  const { rows } = await query(
    `SELECT id, tenant_id, property_id, guest_id, reservation_id,
            communication_type, direction, subject, status,
            sent_at, delivered_at, opened_at,
            external_message_id, created_at
     FROM guest_communications
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [tenantId, guestId, cappedLimit, offset],
  );
  return rows;
};

/**
 * Get a single communication by ID.
 */
export const getCommunication = async (
  tenantId: string,
  communicationId: string,
): Promise<unknown | null> => {
  const { rows } = await query(
    `SELECT id, tenant_id, property_id, guest_id, reservation_id,
            template_id, communication_type, direction, subject, message,
            sender_name, sender_email, recipient_name, recipient_email,
            recipient_phone, status, external_message_id,
            sent_at, delivered_at, opened_at, clicked_at,
            failed_at, failure_reason, attachments, metadata,
            created_by, created_at, updated_at
     FROM guest_communications
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, communicationId],
  );
  return rows[0] ?? null;
};
