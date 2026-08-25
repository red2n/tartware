/**
 * DEV DOC
 * Module: automated-message-repository.ts
 * Purpose: Automated message definitions — the trigger-driven messages the
 *          dispatcher sends without a human in the loop.
 * Ownership: notification-service
 *
 * Statements moved verbatim out of `services/automated-message-service.ts`.
 */

export const SELECT_COLUMNS = `
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
export const LIST_MESSAGES_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
  ORDER BY priority DESC, message_name ASC
  LIMIT $2 OFFSET $3
`;
export const GET_MESSAGE_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid AND message_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
`;
export const GET_MESSAGES_BY_TRIGGER_SQL = `
  SELECT ${SELECT_COLUMNS}
  FROM automated_messages
  WHERE tenant_id = $1::uuid
    AND trigger_type = $2
    AND is_active = true
    AND COALESCE(is_paused, false) = false
    AND COALESCE(is_deleted, false) = false
  ORDER BY priority DESC
`;
export const CREATE_MESSAGE_SQL = `
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
export const UPDATE_MESSAGE_SQL = `
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
export const DELETE_MESSAGE_SQL = `
  UPDATE automated_messages
  SET is_deleted = true,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3
  WHERE tenant_id = $1::uuid AND message_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING message_id
`;
