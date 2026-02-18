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
      description = COALESCE($4, description),
      is_active = COALESCE($5, is_active),
      is_paused = COALESCE($6, is_paused),
      priority = COALESCE($7, priority),
      send_timing = COALESCE($8, send_timing),
      delay_minutes = COALESCE($9, delay_minutes),
      delay_hours = COALESCE($10, delay_hours),
      delay_days = COALESCE($11, delay_days),
      send_before_event_hours = COALESCE($12, send_before_event_hours),
      send_after_event_hours = COALESCE($13, send_after_event_hours),
      scheduled_time = COALESCE($14, scheduled_time),
      scheduled_timezone = COALESCE($15, scheduled_timezone),
      respect_quiet_hours = COALESCE($16, respect_quiet_hours),
      quiet_hours_start = COALESCE($17, quiet_hours_start),
      quiet_hours_end = COALESCE($18, quiet_hours_end),
      template_id = COALESCE($19, template_id),
      fallback_template_id = COALESCE($20, fallback_template_id),
      message_channel = COALESCE($21, message_channel),
      secondary_channels = COALESCE($22, secondary_channels),
      target_audience = COALESCE($23, target_audience),
      conditions = COALESCE($24, conditions),
      exclusion_conditions = COALESCE($25, exclusion_conditions),
      max_sends_per_guest_per_day = COALESCE($26, max_sends_per_guest_per_day),
      max_sends_per_guest_per_week = COALESCE($27, max_sends_per_guest_per_week),
      max_sends_per_guest_per_month = COALESCE($28, max_sends_per_guest_per_month),
      min_hours_between_sends = COALESCE($29, min_hours_between_sends),
      respect_unsubscribe = COALESCE($30, respect_unsubscribe),
      requires_consent = COALESCE($31, requires_consent),
      consent_type = COALESCE($32, consent_type),
      include_unsubscribe_link = COALESCE($33, include_unsubscribe_link),
      metadata = COALESCE($34, metadata),
      tags = COALESCE($35, tags),
      notes = COALESCE($36, notes),
      updated_by = $37::uuid,
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
    description?: string;
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
    fallbackTemplateId?: string;
    messageChannel?: string;
    secondaryChannels?: string[];
    targetAudience?: string[];
    conditions?: Record<string, unknown>;
    exclusionConditions?: Record<string, unknown>;
    maxSendsPerGuestPerDay?: number;
    maxSendsPerGuestPerWeek?: number;
    maxSendsPerGuestPerMonth?: number;
    minHoursBetweenSends?: number;
    respectUnsubscribe?: boolean;
    requiresConsent?: boolean;
    consentType?: string;
    includeUnsubscribeLink?: boolean;
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
    data.description ?? null,
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
    data.fallbackTemplateId ?? null,
    data.messageChannel ?? null,
    data.secondaryChannels ?? null,
    data.targetAudience ?? null,
    data.conditions ? JSON.stringify(data.conditions) : null,
    data.exclusionConditions ? JSON.stringify(data.exclusionConditions) : null,
    data.maxSendsPerGuestPerDay ?? null,
    data.maxSendsPerGuestPerWeek ?? null,
    data.maxSendsPerGuestPerMonth ?? null,
    data.minHoursBetweenSends ?? null,
    data.respectUnsubscribe ?? null,
    data.requiresConsent ?? null,
    data.consentType ?? null,
    data.includeUnsubscribeLink ?? null,
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
