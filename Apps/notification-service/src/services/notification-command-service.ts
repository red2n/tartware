import { appLogger } from "../lib/logger.js";
import { sendNotification } from "./notification-dispatch-service.js";
import { createTemplate, deleteTemplate, updateTemplate } from "./template-service.js";

const logger = appLogger.child({ module: "notification-command-service" });

const SYSTEM_ACTOR = "NOTIFICATION_SERVICE";

type CommandContext = {
  tenantId: string;
  initiatedBy?: { userId?: string } | null;
};

/** Extract a scalar actor id from the initiatedBy envelope field. */
const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? SYSTEM_ACTOR;

/**
 * Handle notification.send command — render template and dispatch notification.
 */
export const handleSendNotification = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const guestId = payload.guest_id as string;
  const propertyId = payload.property_id as string;
  const templateCode = payload.template_code as string;
  const recipientName = (payload.recipient_name as string) ?? "Guest";
  const recipientEmail = payload.recipient_email as string | undefined;
  const recipientPhone = payload.recipient_phone as string | undefined;
  const reservationId = payload.reservation_id as string | undefined;
  const idempotencyKey = payload.idempotency_key as string | undefined;
  const context = (payload.context as Record<string, string>) ?? {};

  if (!guestId || !propertyId || !templateCode) {
    throw new Error("Missing required fields: guest_id, property_id, template_code");
  }

  const result = await sendNotification({
    tenantId: ctx.tenantId,
    propertyId,
    guestId,
    reservationId: reservationId ?? null,
    templateCode,
    recipientName,
    recipientEmail: recipientEmail ?? null,
    recipientPhone: recipientPhone ?? null,
    context,
    initiatedBy: resolveActorId(ctx.initiatedBy),
    idempotencyKey: idempotencyKey ?? null,
  });

  if (!result) {
    logger.warn({ templateCode, guestId }, "Notification send skipped — template not found");
    return;
  }

  logger.info(
    {
      communicationId: result.communicationId,
      dispatched: result.dispatched,
      templateCode,
      guestId,
    },
    "notification.send command processed",
  );
};

/**
 * Handle notification.template.create command.
 */
export const handleCreateTemplate = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const result = await createTemplate(
    ctx.tenantId,
    {
      propertyId: (payload.property_id as string) ?? null,
      templateName: payload.template_name as string,
      templateCode: payload.template_code as string,
      communicationType: payload.communication_type as string,
      category: (payload.category as string) ?? null,
      subject: (payload.subject as string) ?? null,
      body: payload.body as string,
      htmlBody: (payload.html_body as string) ?? null,
      languageCode: (payload.language_code as string) ?? null,
      variables: (payload.variables as Record<string, unknown>) ?? null,
      isActive: (payload.is_active as boolean) ?? true,
      isAutomated: (payload.is_automated as boolean) ?? false,
      triggerEvent: (payload.trigger_event as string) ?? null,
      triggerOffsetHours: (payload.trigger_offset_hours as number) ?? null,
      sendPriority: (payload.send_priority as number) ?? 0,
      fromName: (payload.from_name as string) ?? null,
      fromEmail: (payload.from_email as string) ?? null,
      fromPhone: (payload.from_phone as string) ?? null,
      replyToEmail: (payload.reply_to_email as string) ?? null,
      ccEmails: (payload.cc_emails as string) ?? null,
      bccEmails: (payload.bcc_emails as string) ?? null,
      attachments: (payload.attachments as Record<string, unknown>) ?? null,
      metadata: (payload.metadata as Record<string, unknown>) ?? null,
    },
    resolveActorId(ctx.initiatedBy),
  );

  logger.info({ templateId: result.id, tenantId: ctx.tenantId }, "Template created via command");
};

/**
 * Handle notification.template.update command.
 */
export const handleUpdateTemplate = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const templateId = payload.template_id as string;
  if (!templateId) {
    throw new Error("Missing required field: template_id");
  }

  const result = await updateTemplate(
    ctx.tenantId,
    templateId,
    {
      templateName: payload.template_name as string | undefined,
      subject: payload.subject as string | undefined,
      body: payload.body as string | undefined,
      htmlBody: payload.html_body as string | undefined,
      category: payload.category as string | undefined,
      languageCode: payload.language_code as string | undefined,
      variables: payload.variables as Record<string, unknown> | undefined,
      isActive: payload.is_active as boolean | undefined,
      isAutomated: payload.is_automated as boolean | undefined,
      triggerEvent: payload.trigger_event as string | undefined,
      triggerOffsetHours: payload.trigger_offset_hours as number | undefined,
      sendPriority: payload.send_priority as number | undefined,
      fromName: payload.from_name as string | undefined,
      fromEmail: payload.from_email as string | undefined,
      fromPhone: payload.from_phone as string | undefined,
      replyToEmail: payload.reply_to_email as string | undefined,
      ccEmails: payload.cc_emails as string | undefined,
      bccEmails: payload.bcc_emails as string | undefined,
      attachments: payload.attachments as Record<string, unknown> | undefined,
      metadata: payload.metadata as Record<string, unknown> | undefined,
    },
    resolveActorId(ctx.initiatedBy),
  );

  if (!result) {
    logger.warn({ templateId, tenantId: ctx.tenantId }, "Template not found for update");
    return;
  }

  logger.info({ templateId, tenantId: ctx.tenantId }, "Template updated via command");
};

/**
 * Handle notification.template.delete command.
 */
export const handleDeleteTemplate = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const templateId = payload.template_id as string;
  if (!templateId) {
    throw new Error("Missing required field: template_id");
  }

  const deleted = await deleteTemplate(ctx.tenantId, templateId, resolveActorId(ctx.initiatedBy));

  if (!deleted) {
    logger.warn({ templateId, tenantId: ctx.tenantId }, "Template not found for deletion");
    return;
  }

  logger.info({ templateId, tenantId: ctx.tenantId }, "Template soft-deleted via command");
};
