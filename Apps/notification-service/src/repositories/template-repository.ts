/**
 * DEV DOC
 * Module: template-repository.ts
 * Purpose: Communication templates and their usage counters.
 * Ownership: notification-service
 *
 * Statements moved verbatim out of `services/template-service.ts`.
 */

export const LIST_TEMPLATES_SQL = `
  SELECT id, tenant_id, property_id, template_name, template_code,
         communication_type, category, subject, body, html_body,
         language_code, variables, is_active, is_automated,
         trigger_event, trigger_offset_hours, send_priority,
         from_name, from_email, from_phone, reply_to_email,
         cc_emails, bcc_emails, attachments, metadata,
         usage_count, last_used_at, created_by, updated_by,
         created_at, updated_at
  FROM communication_templates
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
  ORDER BY send_priority DESC, template_name ASC
  LIMIT $2 OFFSET $3
`;
export const GET_TEMPLATE_SQL = `
  SELECT id, tenant_id, property_id, template_name, template_code,
         communication_type, category, subject, body, html_body,
         language_code, variables, is_active, is_automated,
         trigger_event, trigger_offset_hours, send_priority,
         from_name, from_email, from_phone, reply_to_email,
         cc_emails, bcc_emails, attachments, metadata,
         usage_count, last_used_at, created_by, updated_by,
         created_at, updated_at
  FROM communication_templates
  WHERE tenant_id = $1::uuid AND id = $2::uuid
    AND COALESCE(is_deleted, false) = false
`;
export const GET_TEMPLATE_BY_CODE_SQL = `
  SELECT id, tenant_id, property_id, template_name, template_code,
         communication_type, category, subject, body, html_body,
         language_code, variables, is_active, is_automated,
         trigger_event, trigger_offset_hours, send_priority,
         from_name, from_email, from_phone, reply_to_email,
         cc_emails, bcc_emails, attachments, metadata,
         usage_count, last_used_at, created_by, updated_by,
         created_at, updated_at
  FROM communication_templates
  WHERE tenant_id IN ($1::uuid, '00000000-0000-0000-0000-000000000001'::uuid)
    AND template_code = $2
    AND COALESCE(is_deleted, false) = false
    AND is_active = true
  ORDER BY
    CASE WHEN tenant_id = $1::uuid THEN 0 ELSE 1 END,
    CASE WHEN property_id = NULLIF($3, '')::uuid THEN 0 ELSE 1 END,
    send_priority DESC
  LIMIT 1
`;
export const CREATE_TEMPLATE_SQL = `
  INSERT INTO communication_templates (
    tenant_id, property_id, template_name, template_code, communication_type,
    category, subject, body, html_body, language_code, variables,
    is_active, is_automated, trigger_event, trigger_offset_hours, send_priority,
    from_name, from_email, from_phone, reply_to_email, cc_emails, bcc_emails,
    attachments, metadata, created_by, updated_by
  ) VALUES (
    $1::uuid, $2, $3, $4, $5,
    $6, $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22,
    $23, $24, $25::uuid, $25::uuid
  )
  RETURNING id, created_at, updated_at
`;
export const UPDATE_TEMPLATE_SQL = `
  UPDATE communication_templates
  SET template_name = COALESCE($3, template_name),
      subject = COALESCE($4, subject),
      body = COALESCE($5, body),
      html_body = COALESCE($6, html_body),
      category = COALESCE($7, category),
      language_code = COALESCE($8, language_code),
      variables = COALESCE($9, variables),
      is_active = COALESCE($10, is_active),
      is_automated = COALESCE($11, is_automated),
      trigger_event = COALESCE($12, trigger_event),
      trigger_offset_hours = COALESCE($13, trigger_offset_hours),
      send_priority = COALESCE($14, send_priority),
      from_name = COALESCE($15, from_name),
      from_email = COALESCE($16, from_email),
      from_phone = COALESCE($17, from_phone),
      reply_to_email = COALESCE($18, reply_to_email),
      cc_emails = COALESCE($19, cc_emails),
      bcc_emails = COALESCE($20, bcc_emails),
      attachments = COALESCE($21, attachments),
      metadata = COALESCE($22, metadata),
      updated_by = $23::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid AND id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING id, updated_at
`;
export const DELETE_TEMPLATE_SQL = `
  UPDATE communication_templates
  SET is_deleted = true,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3
  WHERE tenant_id = $1::uuid AND id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING id
`;
export const INCREMENT_USAGE_SQL = `
  UPDATE communication_templates
  SET usage_count = usage_count + 1,
      last_used_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid AND id = $2::uuid
`;
