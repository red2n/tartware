import type { TemplateRow } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  CREATE_TEMPLATE_SQL,
  DELETE_TEMPLATE_SQL,
  GET_TEMPLATE_BY_CODE_SQL,
  GET_TEMPLATE_SQL,
  INCREMENT_USAGE_SQL,
  LIST_TEMPLATES_SQL,
  UPDATE_TEMPLATE_SQL,
} from "../repositories/template-repository.js";
import { renderTemplate } from "../utils/template-renderer.js";

const logger = appLogger.child({ module: "template-service" });

// TemplateRow imported from @tartware/schemas

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
