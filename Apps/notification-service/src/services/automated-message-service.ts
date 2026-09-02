import type { AutomatedMessageRow } from "@tartware/schemas";
import { query } from "../lib/db.js";
import {
  CREATE_MESSAGE_SQL,
  DELETE_MESSAGE_SQL,
  GET_MESSAGE_SQL,
  GET_MESSAGES_BY_TRIGGER_SQL,
  LIST_MESSAGES_SQL,
  UPDATE_MESSAGE_SQL,
} from "../repositories/automated-message-repository.js";

// AutomatedMessageRow imported from @tartware/schemas

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
