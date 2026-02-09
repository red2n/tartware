import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { renderTemplate } from "../utils/template-renderer.js";

const logger = appLogger.child({ module: "template-service" });

type TemplateRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  template_name: string;
  template_code: string;
  communication_type: string;
  category: string | null;
  subject: string | null;
  body: string;
  html_body: string | null;
  language_code: string | null;
  variables: Record<string, unknown> | null;
  is_active: boolean;
  is_automated: boolean;
  trigger_event: string | null;
  trigger_offset_hours: number | null;
  send_priority: number | null;
  from_name: string | null;
  from_email: string | null;
  from_phone: string | null;
  reply_to_email: string | null;
  cc_emails: string | null;
  bcc_emails: string | null;
  attachments: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  usage_count: number;
  last_used_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

const LIST_TEMPLATES_SQL = `
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

const GET_TEMPLATE_SQL = `
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

const GET_TEMPLATE_BY_CODE_SQL = `
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
    AND template_code = $2
    AND COALESCE(is_deleted, false) = false
    AND is_active = true
  ORDER BY
    CASE WHEN property_id = $3::uuid THEN 0 ELSE 1 END,
    send_priority DESC
  LIMIT 1
`;

const CREATE_TEMPLATE_SQL = `
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

const UPDATE_TEMPLATE_SQL = `
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

const DELETE_TEMPLATE_SQL = `
  UPDATE communication_templates
  SET is_deleted = true,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3
  WHERE tenant_id = $1::uuid AND id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING id
`;

const INCREMENT_USAGE_SQL = `
  UPDATE communication_templates
  SET usage_count = usage_count + 1,
      last_used_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid AND id = $2::uuid
`;

/**
 * List communication templates for a tenant.
 */
export const listTemplates = async (
  tenantId: string,
  limit = 50,
  offset = 0,
): Promise<TemplateRow[]> => {
  const cappedLimit = Math.min(limit, 200);
  const { rows } = await query<TemplateRow>(LIST_TEMPLATES_SQL, [tenantId, cappedLimit, offset]);
  return rows;
};

/**
 * Get a single template by ID.
 */
export const getTemplate = async (
  tenantId: string,
  templateId: string,
): Promise<TemplateRow | null> => {
  const { rows } = await query<TemplateRow>(GET_TEMPLATE_SQL, [tenantId, templateId]);
  return rows[0] ?? null;
};

/**
 * Resolve a template by code, preferring property-specific over global.
 */
export const resolveTemplateByCode = async (
  tenantId: string,
  templateCode: string,
  propertyId: string,
): Promise<TemplateRow | null> => {
  const { rows } = await query<TemplateRow>(GET_TEMPLATE_BY_CODE_SQL, [
    tenantId,
    templateCode,
    propertyId,
  ]);
  return rows[0] ?? null;
};

/**
 * Create a new communication template.
 */
export const createTemplate = async (
  tenantId: string,
  data: {
    propertyId?: string | null;
    templateName: string;
    templateCode: string;
    communicationType: string;
    category?: string | null;
    subject?: string | null;
    body: string;
    htmlBody?: string | null;
    languageCode?: string | null;
    variables?: Record<string, unknown> | null;
    isActive?: boolean;
    isAutomated?: boolean;
    triggerEvent?: string | null;
    triggerOffsetHours?: number | null;
    sendPriority?: number | null;
    fromName?: string | null;
    fromEmail?: string | null;
    fromPhone?: string | null;
    replyToEmail?: string | null;
    ccEmails?: string | null;
    bccEmails?: string | null;
    attachments?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  },
  createdBy: string | null,
): Promise<{ id: string; createdAt: Date; updatedAt: Date }> => {
  const { rows } = await query<{ id: string; created_at: Date; updated_at: Date }>(
    CREATE_TEMPLATE_SQL,
    [
      tenantId,
      data.propertyId ?? null,
      data.templateName,
      data.templateCode,
      data.communicationType,
      data.category ?? null,
      data.subject ?? null,
      data.body,
      data.htmlBody ?? null,
      data.languageCode ?? "en",
      data.variables ? JSON.stringify(data.variables) : null,
      data.isActive ?? true,
      data.isAutomated ?? false,
      data.triggerEvent ?? null,
      data.triggerOffsetHours ?? null,
      data.sendPriority ?? 0,
      data.fromName ?? null,
      data.fromEmail ?? null,
      data.fromPhone ?? null,
      data.replyToEmail ?? null,
      data.ccEmails ?? null,
      data.bccEmails ?? null,
      data.attachments ? JSON.stringify(data.attachments) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      createdBy,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("INSERT did not return a row");
  }
  return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
};

/**
 * Update an existing communication template.
 */
export const updateTemplate = async (
  tenantId: string,
  templateId: string,
  data: {
    templateName?: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    category?: string;
    languageCode?: string;
    variables?: Record<string, unknown>;
    isActive?: boolean;
    isAutomated?: boolean;
    triggerEvent?: string;
    triggerOffsetHours?: number;
    sendPriority?: number;
    fromName?: string;
    fromEmail?: string;
    fromPhone?: string;
    replyToEmail?: string;
    ccEmails?: string;
    bccEmails?: string;
    attachments?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
  updatedBy: string | null,
): Promise<{ id: string; updatedAt: Date } | null> => {
  const { rows } = await query<{ id: string; updated_at: Date }>(UPDATE_TEMPLATE_SQL, [
    tenantId,
    templateId,
    data.templateName ?? null,
    data.subject ?? null,
    data.body ?? null,
    data.htmlBody ?? null,
    data.category ?? null,
    data.languageCode ?? null,
    data.variables ? JSON.stringify(data.variables) : null,
    data.isActive ?? null,
    data.isAutomated ?? null,
    data.triggerEvent ?? null,
    data.triggerOffsetHours ?? null,
    data.sendPriority ?? null,
    data.fromName ?? null,
    data.fromEmail ?? null,
    data.fromPhone ?? null,
    data.replyToEmail ?? null,
    data.ccEmails ?? null,
    data.bccEmails ?? null,
    data.attachments ? JSON.stringify(data.attachments) : null,
    data.metadata ? JSON.stringify(data.metadata) : null,
    updatedBy,
  ]);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, updatedAt: row.updated_at };
};

/**
 * Soft-delete a communication template.
 */
export const deleteTemplate = async (
  tenantId: string,
  templateId: string,
  deletedBy: string | null,
): Promise<boolean> => {
  const { rowCount } = await query(DELETE_TEMPLATE_SQL, [tenantId, templateId, deletedBy]);
  return (rowCount ?? 0) > 0;
};

/**
 * Render a template by code, resolving variables from the provided context.
 * Also increments usage count on the template.
 */
export const renderTemplateByCode = async (
  tenantId: string,
  templateCode: string,
  propertyId: string,
  context: Record<string, string | number | boolean | null | undefined>,
): Promise<{
  templateId: string;
  subject: string;
  body: string;
  htmlBody: string | null;
  communicationType: string;
  fromName: string | null;
  fromEmail: string | null;
} | null> => {
  const template = await resolveTemplateByCode(tenantId, templateCode, propertyId);
  if (!template) {
    logger.warn({ tenantId, templateCode, propertyId }, "Template not found for rendering");
    return null;
  }

  const renderedSubject = template.subject ? renderTemplate(template.subject, context) : "";
  const renderedBody = renderTemplate(template.body, context);
  const renderedHtmlBody = template.html_body ? renderTemplate(template.html_body, context) : null;

  // Fire-and-forget usage increment — non-critical
  void query(INCREMENT_USAGE_SQL, [tenantId, template.id]).catch((err) =>
    logger.warn({ err, templateId: template.id }, "Failed to increment template usage"),
  );

  return {
    templateId: template.id,
    subject: renderedSubject,
    body: renderedBody,
    htmlBody: renderedHtmlBody,
    communicationType: template.communication_type,
    fromName: template.from_name,
    fromEmail: template.from_email,
  };
};
