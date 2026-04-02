import { appLogger } from "../lib/logger.js";

import {
  createAutomatedMessage,
  deleteAutomatedMessage,
  updateAutomatedMessage,
} from "./automated-message-service.js";
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

/**
 * Handle notification.automated.create command.
 */
export const handleCreateAutomatedMessage = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const result = await createAutomatedMessage(
    ctx.tenantId,
    {
      propertyId: (payload.property_id as string) ?? null,
      messageName: payload.message_name as string,
      messageCode: (payload.message_code as string) ?? null,
      description: (payload.description as string) ?? null,
      triggerType: payload.trigger_type as string,
      triggerEvent: (payload.trigger_event as string) ?? null,
      isActive: (payload.is_active as boolean) ?? true,
      priority: (payload.priority as number) ?? 100,
      sendTiming: (payload.send_timing as string) ?? "immediate",
      delayMinutes: (payload.delay_minutes as number) ?? null,
      delayHours: (payload.delay_hours as number) ?? null,
      delayDays: (payload.delay_days as number) ?? null,
      sendBeforeEventHours: (payload.send_before_event_hours as number) ?? null,
      sendAfterEventHours: (payload.send_after_event_hours as number) ?? null,
      scheduledTime: (payload.scheduled_time as string) ?? null,
      scheduledTimezone: (payload.scheduled_timezone as string) ?? null,
      respectQuietHours: (payload.respect_quiet_hours as boolean) ?? true,
      quietHoursStart: (payload.quiet_hours_start as string) ?? null,
      quietHoursEnd: (payload.quiet_hours_end as string) ?? null,
      templateId: (payload.template_id as string) ?? null,
      fallbackTemplateId: (payload.fallback_template_id as string) ?? null,
      messageChannel: payload.message_channel as string,
      secondaryChannels: (payload.secondary_channels as string[]) ?? null,
      targetAudience: (payload.target_audience as string[]) ?? null,
      conditions: (payload.conditions as Record<string, unknown>) ?? null,
      exclusionConditions: (payload.exclusion_conditions as Record<string, unknown>) ?? null,
      maxSendsPerGuestPerDay: (payload.max_sends_per_guest_per_day as number) ?? null,
      maxSendsPerGuestPerWeek: (payload.max_sends_per_guest_per_week as number) ?? null,
      maxSendsPerGuestPerMonth: (payload.max_sends_per_guest_per_month as number) ?? null,
      minHoursBetweenSends: (payload.min_hours_between_sends as number) ?? null,
      respectUnsubscribe: (payload.respect_unsubscribe as boolean) ?? true,
      requiresConsent: (payload.requires_consent as boolean) ?? false,
      consentType: (payload.consent_type as string) ?? null,
      includeUnsubscribeLink: (payload.include_unsubscribe_link as boolean) ?? true,
      metadata: (payload.metadata as Record<string, unknown>) ?? null,
      tags: (payload.tags as string[]) ?? null,
      notes: (payload.notes as string) ?? null,
    },
    resolveActorId(ctx.initiatedBy),
  );

  logger.info(
    { messageId: result.messageId, tenantId: ctx.tenantId },
    "Automated message created via command",
  );
};

/**
 * Handle notification.automated.update command.
 */
export const handleUpdateAutomatedMessage = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const messageId = payload.message_id as string;
  if (!messageId) {
    throw new Error("Missing required field: message_id");
  }

  const result = await updateAutomatedMessage(
    ctx.tenantId,
    messageId,
    {
      messageName: payload.message_name as string | undefined,
      messageCode: payload.message_code as string | undefined,
      description: payload.description as string | undefined,
      triggerEvent: payload.trigger_event as string | undefined,
      isActive: payload.is_active as boolean | undefined,
      isPaused: payload.is_paused as boolean | undefined,
      priority: payload.priority as number | undefined,
      sendTiming: payload.send_timing as string | undefined,
      delayMinutes: payload.delay_minutes as number | undefined,
      delayHours: payload.delay_hours as number | undefined,
      delayDays: payload.delay_days as number | undefined,
      sendBeforeEventHours: payload.send_before_event_hours as number | undefined,
      sendAfterEventHours: payload.send_after_event_hours as number | undefined,
      scheduledTime: payload.scheduled_time as string | undefined,
      scheduledTimezone: payload.scheduled_timezone as string | undefined,
      respectQuietHours: payload.respect_quiet_hours as boolean | undefined,
      quietHoursStart: payload.quiet_hours_start as string | undefined,
      quietHoursEnd: payload.quiet_hours_end as string | undefined,
      templateId: payload.template_id as string | undefined,
      templateVersion: payload.template_version as number | undefined,
      fallbackTemplateId: payload.fallback_template_id as string | undefined,
      messageChannel: payload.message_channel as string | undefined,
      secondaryChannels: payload.secondary_channels as string[] | undefined,
      channelPriority: payload.channel_priority as string[] | undefined,
      targetAudience: payload.target_audience as string[] | undefined,
      guestSegments: payload.guest_segments as string[] | undefined,
      conditions: payload.conditions as Record<string, unknown> | undefined,
      exclusionConditions: payload.exclusion_conditions as Record<string, unknown> | undefined,
      useGuestName: payload.use_guest_name as boolean | undefined,
      usePropertyName: payload.use_property_name as boolean | undefined,
      personalizationFields: payload.personalization_fields as Record<string, unknown> | undefined,
      dynamicContentRules: payload.dynamic_content_rules as Record<string, unknown> | undefined,
      defaultLanguage: payload.default_language as string | undefined,
      multiLanguage: payload.multi_language as boolean | undefined,
      languageDetectionMethod: payload.language_detection_method as string | undefined,
      supportedLanguages: payload.supported_languages as string[] | undefined,
      maxSendsPerGuestPerDay: payload.max_sends_per_guest_per_day as number | undefined,
      maxSendsPerGuestPerWeek: payload.max_sends_per_guest_per_week as number | undefined,
      maxSendsPerGuestPerMonth: payload.max_sends_per_guest_per_month as number | undefined,
      minHoursBetweenSends: payload.min_hours_between_sends as number | undefined,
      respectUnsubscribe: payload.respect_unsubscribe as boolean | undefined,
      respectPreferences: payload.respect_preferences as boolean | undefined,
      isAbTest: payload.is_ab_test as boolean | undefined,
      abTestVariant: payload.ab_test_variant as string | undefined,
      abTestPercentage: payload.ab_test_percentage as number | undefined,
      abTestControlGroupPercentage: payload.ab_test_control_group_percentage as number | undefined,
      retryOnFailure: payload.retry_on_failure as boolean | undefined,
      maxRetryAttempts: payload.max_retry_attempts as number | undefined,
      retryDelayMinutes: payload.retry_delay_minutes as number | undefined,
      requiresConsent: payload.requires_consent as boolean | undefined,
      consentType: payload.consent_type as string | undefined,
      gdprCompliant: payload.gdpr_compliant as boolean | undefined,
      includeUnsubscribeLink: payload.include_unsubscribe_link as boolean | undefined,
      estimatedCostPerSend: payload.estimated_cost_per_send as number | undefined,
      currency: payload.currency as string | undefined,
      metadata: payload.metadata as Record<string, unknown> | undefined,
      tags: payload.tags as string[] | undefined,
      notes: payload.notes as string | undefined,
    },
    resolveActorId(ctx.initiatedBy),
  );

  if (!result) {
    logger.warn({ messageId, tenantId: ctx.tenantId }, "Automated message not found for update");
    return;
  }

  logger.info({ messageId, tenantId: ctx.tenantId }, "Automated message updated via command");
};

/**
 * Handle notification.automated.delete command.
 */
export const handleDeleteAutomatedMessage = async (
  payload: Record<string, unknown>,
  ctx: CommandContext,
): Promise<void> => {
  const messageId = payload.message_id as string;
  if (!messageId) {
    throw new Error("Missing required field: message_id");
  }

  const deleted = await deleteAutomatedMessage(
    ctx.tenantId,
    messageId,
    resolveActorId(ctx.initiatedBy),
  );

  if (!deleted) {
    logger.warn({ messageId, tenantId: ctx.tenantId }, "Automated message not found for deletion");
    return;
  }

  logger.info({ messageId, tenantId: ctx.tenantId }, "Automated message soft-deleted via command");
};
