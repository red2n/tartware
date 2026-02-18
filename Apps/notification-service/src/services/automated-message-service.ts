import { query } from "../lib/db.js";

type AutomatedMessageRow = {
  message_id: string;
  tenant_id: string;
  property_id: string | null;
  message_name: string;
  message_code: string | null;
  description: string | null;
  trigger_type: string;
  trigger_event: string | null;
  is_active: boolean;
  is_paused: boolean;
  priority: number;
  send_timing: string;
  delay_minutes: number | null;
  delay_hours: number | null;
  delay_days: number | null;
  send_before_event_hours: number | null;
  send_after_event_hours: number | null;
  scheduled_time: string | null;
  scheduled_timezone: string | null;
  respect_quiet_hours: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  template_id: string | null;
  fallback_template_id: string | null;
  message_channel: string;
  secondary_channels: string[] | null;
  target_audience: string[] | null;
  conditions: Record<string, unknown> | null;
  exclusion_conditions: Record<string, unknown> | null;
  max_sends_per_guest_per_day: number | null;
  max_sends_per_guest_per_week: number | null;
  max_sends_per_guest_per_month: number | null;
  min_hours_between_sends: number | null;
  respect_unsubscribe: boolean;
  requires_consent: boolean;
  consent_type: string | null;
  include_unsubscribe_link: boolean;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  notes: string | null;
  sent_count: number;
  created_at: Date;
  updated_at: Date;
};

const SELECT_COLUMNS = `
  message_id, tenant_id, property_id, message_name, message_code, description,
  trigger_type, trigger_event, is_active, is_paused, priority,
  send_timing, delay_minutes, delay_hours, delay_days,
  send_before_event_hours, send_after_event_hours,
  scheduled_time, scheduled_timezone, respect_quiet_hours,
  quiet_hours_start, quiet_hours_end,
  template_id, fallback_template_id, message_channel, secondary_channels,
  target_audience, conditions, exclusion_conditions,
  max_sends_per_guest_per_day, max_sends_per_guest_per_week,
  max_sends_per_guest_per_month, min_hours_between_sends,
  respect_unsubscribe, requires_consent, consent_type, include_unsubscribe_link,
  metadata, tags, notes, sent_count, created_at, updated_at
`;

const LIST_MESSAGES_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
  ORDER BY priority DESC, message_name ASC
  LIMIT $2 OFFSET $3
`;

const GET_MESSAGE_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid AND message_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
`;

const GET_MESSAGES_BY_TRIGGER_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid
    AND trigger_type = $2
    AND is_active = true
    AND COALESCE(is_paused, false) = false
    AND COALESCE(is_deleted, false) = false
  ORDER BY priority DESC
`;

const CREATE_MESSAGE_SQL = `
  INSERT INTO automated_messages (
    tenant_id, property_id, message_name, message_code, description,
    trigger_type, trigger_event, is_active, priority,
    send_timing, delay_minutes, delay_hours, delay_days,
    send_before_event_hours, send_after_event_hours,
    scheduled_time, scheduled_timezone, respect_quiet_hours,
    quiet_hours_start, quiet_hours_end,
    template_id, fallback_template_id, message_channel, secondary_channels,
    target_audience, conditions, exclusion_conditions,
    max_sends_per_guest_per_day, max_sends_per_guest_per_week,
    max_sends_per_guest_per_month, min_hours_between_sends,
    respect_unsubscribe, requires_consent, consent_type, include_unsubscribe_link,
    metadata, tags, notes, created_by, updated_by
  ) VALUES (
    $1::uuid, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12, $13,
    $14, $15,
    $16, $17, $18,
    $19, $20,
    $21, $22, $23, $24,
    $25, $26, $27,
    $28, $29,
    $30, $31,
    $32, $33, $34, $35,
    $36, $37, $38, $39::uuid, $39::uuid
  )
  RETURNING message_id, created_at, updated_at
`;

const UPDATE_MESSAGE_SQL = `
  UPDATE automated_messages
  SET message_name = COALESCE($3, message_name),
      message_code = COALESCE($4, message_code),
      description = COALESCE($5, description),
      trigger_event = COALESCE($6, trigger_event),
      is_active = COALESCE($7, is_active),
      is_paused = COALESCE($8, is_paused),
      priority = COALESCE($9, priority),
      send_timing = COALESCE($10, send_timing),
      delay_minutes = COALESCE($11, delay_minutes),
      delay_hours = COALESCE($12, delay_hours),
      delay_days = COALESCE($13, delay_days),
      send_before_event_hours = COALESCE($14, send_before_event_hours),
      send_after_event_hours = COALESCE($15, send_after_event_hours),
      scheduled_time = COALESCE($16, scheduled_time),
      scheduled_timezone = COALESCE($17, scheduled_timezone),
      respect_quiet_hours = COALESCE($18, respect_quiet_hours),
      quiet_hours_start = COALESCE($19, quiet_hours_start),
      quiet_hours_end = COALESCE($20, quiet_hours_end),
      template_id = COALESCE($21, template_id),
      template_version = COALESCE($22, template_version),
      fallback_template_id = COALESCE($23, fallback_template_id),
      message_channel = COALESCE($24, message_channel),
      secondary_channels = COALESCE($25, secondary_channels),
      channel_priority = COALESCE($26, channel_priority),
      target_audience = COALESCE($27, target_audience),
      guest_segments = COALESCE($28, guest_segments),
      conditions = COALESCE($29, conditions),
      exclusion_conditions = COALESCE($30, exclusion_conditions),
      use_guest_name = COALESCE($31, use_guest_name),
      use_property_name = COALESCE($32, use_property_name),
      personalization_fields = COALESCE($33, personalization_fields),
      dynamic_content_rules = COALESCE($34, dynamic_content_rules),
      default_language = COALESCE($35, default_language),
      multi_language = COALESCE($36, multi_language),
      language_detection_method = COALESCE($37, language_detection_method),
      supported_languages = COALESCE($38, supported_languages),
      max_sends_per_guest_per_day = COALESCE($39, max_sends_per_guest_per_day),
      max_sends_per_guest_per_week = COALESCE($40, max_sends_per_guest_per_week),
      max_sends_per_guest_per_month = COALESCE($41, max_sends_per_guest_per_month),
      min_hours_between_sends = COALESCE($42, min_hours_between_sends),
      respect_unsubscribe = COALESCE($43, respect_unsubscribe),
      respect_preferences = COALESCE($44, respect_preferences),
      is_ab_test = COALESCE($45, is_ab_test),
      ab_test_variant = COALESCE($46, ab_test_variant),
      ab_test_percentage = COALESCE($47, ab_test_percentage),
      ab_test_control_group_percentage = COALESCE($48, ab_test_control_group_percentage),
      retry_on_failure = COALESCE($49, retry_on_failure),
      max_retry_attempts = COALESCE($50, max_retry_attempts),
      retry_delay_minutes = COALESCE($51, retry_delay_minutes),
      requires_consent = COALESCE($52, requires_consent),
      consent_type = COALESCE($53, consent_type),
      gdpr_compliant = COALESCE($54, gdpr_compliant),
      include_unsubscribe_link = COALESCE($55, include_unsubscribe_link),
      estimated_cost_per_send = COALESCE($56, estimated_cost_per_send),
      currency = COALESCE($57, currency),
      metadata = COALESCE($58, metadata),
      tags = COALESCE($59, tags),
      notes = COALESCE($60, notes),
      updated_by = $61::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid AND message_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING message_id, updated_at
`;

const DELETE_MESSAGE_SQL = `
  UPDATE automated_messages
  SET is_deleted = true,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3
  WHERE tenant_id = $1::uuid AND message_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING message_id
`;

/**
 * List automated messages for a tenant.
 */
export const listAutomatedMessages = async (
  tenantId: string,
  limit = 50,
  offset = 0,
): Promise<AutomatedMessageRow[]> => {
  const cappedLimit = Math.min(limit, 200);
  const { rows } = await query<AutomatedMessageRow>(LIST_MESSAGES_SQL, [
    tenantId,
    cappedLimit,
    offset,
  ]);
  return rows;
};

/**
 * Get a single automated message by ID.
 */
export const getAutomatedMessage = async (
  tenantId: string,
  messageId: string,
): Promise<AutomatedMessageRow | null> => {
  const { rows } = await query<AutomatedMessageRow>(GET_MESSAGE_SQL, [tenantId, messageId]);
  return rows[0] ?? null;
};

/**
 * Get active automated messages for a given trigger type.
 * Used by the event consumer to determine which messages to fire.
 */
export const getMessagesByTrigger = async (
  tenantId: string,
  triggerType: string,
): Promise<AutomatedMessageRow[]> => {
  const { rows } = await query<AutomatedMessageRow>(GET_MESSAGES_BY_TRIGGER_SQL, [
    tenantId,
    triggerType,
  ]);
  return rows;
};

/**
 * Create a new automated message rule.
 */
export const createAutomatedMessage = async (
  tenantId: string,
  data: {
    propertyId?: string | null;
    messageName: string;
    messageCode?: string | null;
    description?: string | null;
    triggerType: string;
    triggerEvent?: string | null;
    isActive?: boolean;
    priority?: number;
    sendTiming?: string;
    delayMinutes?: number | null;
    delayHours?: number | null;
    delayDays?: number | null;
    sendBeforeEventHours?: number | null;
    sendAfterEventHours?: number | null;
    scheduledTime?: string | null;
    scheduledTimezone?: string | null;
    respectQuietHours?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    templateId?: string | null;
    fallbackTemplateId?: string | null;
    messageChannel: string;
    secondaryChannels?: string[] | null;
    targetAudience?: string[] | null;
    conditions?: Record<string, unknown> | null;
    exclusionConditions?: Record<string, unknown> | null;
    maxSendsPerGuestPerDay?: number | null;
    maxSendsPerGuestPerWeek?: number | null;
    maxSendsPerGuestPerMonth?: number | null;
    minHoursBetweenSends?: number | null;
    respectUnsubscribe?: boolean;
    requiresConsent?: boolean;
    consentType?: string | null;
    includeUnsubscribeLink?: boolean;
    metadata?: Record<string, unknown> | null;
    tags?: string[] | null;
    notes?: string | null;
  },
  createdBy: string | null,
): Promise<{ messageId: string; createdAt: Date; updatedAt: Date }> => {
  const { rows } = await query<{ message_id: string; created_at: Date; updated_at: Date }>(
    CREATE_MESSAGE_SQL,
    [
      tenantId,
      data.propertyId ?? null,
      data.messageName,
      data.messageCode ?? null,
      data.description ?? null,
      data.triggerType,
      data.triggerEvent ?? null,
      data.isActive ?? true,
      data.priority ?? 100,
      data.sendTiming ?? "immediate",
      data.delayMinutes ?? null,
      data.delayHours ?? null,
      data.delayDays ?? null,
      data.sendBeforeEventHours ?? null,
      data.sendAfterEventHours ?? null,
      data.scheduledTime ?? null,
      data.scheduledTimezone ?? null,
      data.respectQuietHours ?? true,
      data.quietHoursStart ?? null,
      data.quietHoursEnd ?? null,
      data.templateId ?? null,
      data.fallbackTemplateId ?? null,
      data.messageChannel,
      data.secondaryChannels ?? null,
      data.targetAudience ?? null,
      data.conditions ? JSON.stringify(data.conditions) : null,
      data.exclusionConditions ? JSON.stringify(data.exclusionConditions) : null,
      data.maxSendsPerGuestPerDay ?? null,
      data.maxSendsPerGuestPerWeek ?? null,
      data.maxSendsPerGuestPerMonth ?? null,
      data.minHoursBetweenSends ?? null,
      data.respectUnsubscribe ?? true,
      data.requiresConsent ?? false,
      data.consentType ?? null,
      data.includeUnsubscribeLink ?? true,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.tags ?? null,
      data.notes ?? null,
      createdBy,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("INSERT did not return a row");
  }
  return { messageId: row.message_id, createdAt: row.created_at, updatedAt: row.updated_at };
};

/**
 * Update an existing automated message rule.
 */
export const updateAutomatedMessage = async (
  tenantId: string,
  messageId: string,
  data: {
    messageName?: string;
    messageCode?: string;
    description?: string;
    triggerEvent?: string;
    isActive?: boolean;
    isPaused?: boolean;
    priority?: number;
    sendTiming?: string;
    delayMinutes?: number;
    delayHours?: number;
    delayDays?: number;
    sendBeforeEventHours?: number;
    sendAfterEventHours?: number;
    scheduledTime?: string;
    scheduledTimezone?: string;
    respectQuietHours?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    templateId?: string;
    templateVersion?: number;
    fallbackTemplateId?: string;
    messageChannel?: string;
    secondaryChannels?: string[];
    channelPriority?: string[];
    targetAudience?: string[];
    guestSegments?: string[];
    conditions?: Record<string, unknown>;
    exclusionConditions?: Record<string, unknown>;
    useGuestName?: boolean;
    usePropertyName?: boolean;
    personalizationFields?: Record<string, unknown>;
    dynamicContentRules?: Record<string, unknown>;
    defaultLanguage?: string;
    multiLanguage?: boolean;
    languageDetectionMethod?: string;
    supportedLanguages?: string[];
    maxSendsPerGuestPerDay?: number;
    maxSendsPerGuestPerWeek?: number;
    maxSendsPerGuestPerMonth?: number;
    minHoursBetweenSends?: number;
    respectUnsubscribe?: boolean;
    respectPreferences?: boolean;
    isAbTest?: boolean;
    abTestVariant?: string;
    abTestPercentage?: number;
    abTestControlGroupPercentage?: number;
    retryOnFailure?: boolean;
    maxRetryAttempts?: number;
    retryDelayMinutes?: number;
    requiresConsent?: boolean;
    consentType?: string;
    gdprCompliant?: boolean;
    includeUnsubscribeLink?: boolean;
    estimatedCostPerSend?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    notes?: string;
  },
  updatedBy: string | null,
): Promise<{ messageId: string; updatedAt: Date } | null> => {
  const { rows } = await query<{ message_id: string; updated_at: Date }>(UPDATE_MESSAGE_SQL, [
    tenantId,
    messageId,
    data.messageName ?? null,
    data.messageCode ?? null,
    data.description ?? null,
    data.triggerEvent ?? null,
    data.isActive ?? null,
    data.isPaused ?? null,
    data.priority ?? null,
    data.sendTiming ?? null,
    data.delayMinutes ?? null,
    data.delayHours ?? null,
    data.delayDays ?? null,
    data.sendBeforeEventHours ?? null,
    data.sendAfterEventHours ?? null,
    data.scheduledTime ?? null,
    data.scheduledTimezone ?? null,
    data.respectQuietHours ?? null,
    data.quietHoursStart ?? null,
    data.quietHoursEnd ?? null,
    data.templateId ?? null,
    data.templateVersion ?? null,
    data.fallbackTemplateId ?? null,
    data.messageChannel ?? null,
    data.secondaryChannels ?? null,
    data.channelPriority ?? null,
    data.targetAudience ?? null,
    data.guestSegments ?? null,
    data.conditions ? JSON.stringify(data.conditions) : null,
    data.exclusionConditions ? JSON.stringify(data.exclusionConditions) : null,
    data.useGuestName ?? null,
    data.usePropertyName ?? null,
    data.personalizationFields ? JSON.stringify(data.personalizationFields) : null,
    data.dynamicContentRules ? JSON.stringify(data.dynamicContentRules) : null,
    data.defaultLanguage ?? null,
    data.multiLanguage ?? null,
    data.languageDetectionMethod ?? null,
    data.supportedLanguages ?? null,
    data.maxSendsPerGuestPerDay ?? null,
    data.maxSendsPerGuestPerWeek ?? null,
    data.maxSendsPerGuestPerMonth ?? null,
    data.minHoursBetweenSends ?? null,
    data.respectUnsubscribe ?? null,
    data.respectPreferences ?? null,
    data.isAbTest ?? null,
    data.abTestVariant ?? null,
    data.abTestPercentage ?? null,
    data.abTestControlGroupPercentage ?? null,
    data.retryOnFailure ?? null,
    data.maxRetryAttempts ?? null,
    data.retryDelayMinutes ?? null,
    data.requiresConsent ?? null,
    data.consentType ?? null,
    data.gdprCompliant ?? null,
    data.includeUnsubscribeLink ?? null,
    data.estimatedCostPerSend ?? null,
    data.currency ?? null,
    data.metadata ? JSON.stringify(data.metadata) : null,
    data.tags ?? null,
    data.notes ?? null,
    updatedBy,
  ]);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;
  return { messageId: row.message_id, updatedAt: row.updated_at };
};

/**
 * Soft-delete an automated message rule.
 */
export const deleteAutomatedMessage = async (
  tenantId: string,
  messageId: string,
  deletedBy: string | null,
): Promise<boolean> => {
  const { rowCount } = await query(DELETE_MESSAGE_SQL, [tenantId, messageId, deletedBy]);
  return (rowCount ?? 0) > 0;
};
