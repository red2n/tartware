/**
 * DEV DOC
 * Module: ar-dunning-rule-repository.ts
 * Purpose: Repository for managing automated dunning escalation rules.
 *          Rules define when and how to remind guests about overdue AR balances.
 * Ownership: billing-service (primary consumer during aging sweeps)
 */

import type {
  ArDunningRuleRow,
  CreateArDunningRuleInput,
  UpdateArDunningRuleInput,
} from "@tartware/schemas";
import { auditAsync } from "../lib/audit-logger.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "ar-dunning-rule-repository" });

// ─── SQL ─────────────────────────────────────────────────────────────────────

const INSERT_DUNNING_RULE_SQL = `
  INSERT INTO public.ar_dunning_rules (
    tenant_id, property_id, bucket_name, min_days_overdue,
    max_days_overdue, action_type, template_code, delay_days,
    max_attempts, min_amount, escalation_order, is_active,
    created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $5, $6, $7, $8,
    $9, $10, $11, $12,
    $13::uuid, $13::uuid
  )
  RETURNING rule_id as id
`;

const LIST_DUNNING_RULES_SQL = `
  SELECT
    rule_id, tenant_id, property_id, bucket_name, min_days_overdue,
    max_days_overdue, action_type, template_code, delay_days,
    max_attempts, min_amount, escalation_order, is_active,
    created_at, updated_at, created_by, updated_by
  FROM public.ar_dunning_rules
  WHERE tenant_id = $1::uuid
    AND (property_id IS NULL OR property_id = $2::uuid)
  ORDER BY bucket_name, escalation_order
`;

const GET_ACTIVE_RULES_FOR_BUCKET_SQL = `
  SELECT
    rule_id, tenant_id, property_id, bucket_name, min_days_overdue,
    max_days_overdue, action_type, template_code, delay_days,
    max_attempts, min_amount, escalation_order, is_active,
    created_at, updated_at, created_by, updated_by
  FROM public.ar_dunning_rules
  WHERE tenant_id = $1::uuid
    AND (property_id = $2::uuid OR property_id IS NULL)
    AND bucket_name = $3
    AND is_active = true
  ORDER BY escalation_order ASC
`;

const UPDATE_DUNNING_RULE_SQL = `
  UPDATE public.ar_dunning_rules
  SET
    template_code = COALESCE($1, template_code),
    delay_days = COALESCE($2, delay_days),
    max_attempts = COALESCE($3, max_attempts),
    min_amount = COALESCE($4, min_amount),
    escalation_order = COALESCE($5, escalation_order),
    is_active = COALESCE($6, is_active),
    updated_at = NOW(),
    updated_by = $7::uuid
  WHERE rule_id = $8::uuid
    AND tenant_id = $9::uuid
  RETURNING rule_id as id
`;

const DELETE_DUNNING_RULE_SQL = `
  DELETE FROM public.ar_dunning_rules
  WHERE rule_id = $1::uuid
    AND tenant_id = $2::uuid
`;

// ─── Repository ──────────────────────────────────────────────────────────────

export async function createDunningRule(
  tenantId: string,
  userId: string,
  input: CreateArDunningRuleInput,
): Promise<string> {
  const result = await query<{ id: string }>(INSERT_DUNNING_RULE_SQL, [
    tenantId,
    input.property_id ?? null,
    input.bucket_name,
    input.min_days_overdue,
    input.max_days_overdue ?? null,
    input.action_type,
    input.template_code,
    input.delay_days ?? 0,
    input.max_attempts ?? 3,
    input.min_amount ?? 0,
    input.escalation_order ?? 1,
    input.is_active ?? true,
    userId,
  ]);

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Failed to create dunning rule — no ID returned");

  logger.info({ ruleId: id, tenantId, actionType: input.action_type }, "AR dunning rule created");

  auditAsync({
    tenantId,
    propertyId: input.property_id ?? null,
    userId,
    action: "CREATE_DUNNING_RULE",
    entityType: "ar_dunning_rules",
    entityId: id,
    category: "CONFIGURATION",
    severity: "INFO",
    description: `Created dunning rule for bucket ${input.bucket_name} with action ${input.action_type}`,
    newValues: input as unknown as Record<string, unknown>,
  });

  return id;
}

export async function listDunningRules(
  tenantId: string,
  propertyId?: string,
): Promise<ArDunningRuleRow[]> {
  const result = await query<ArDunningRuleRow>(LIST_DUNNING_RULES_SQL, [
    tenantId,
    propertyId ?? null,
  ]);
  return result.rows;
}

export async function getActiveRulesForBucket(
  tenantId: string,
  propertyId: string,
  bucketName: string,
): Promise<ArDunningRuleRow[]> {
  const result = await query<ArDunningRuleRow>(GET_ACTIVE_RULES_FOR_BUCKET_SQL, [
    tenantId,
    propertyId,
    bucketName,
  ]);
  return result.rows;
}

export async function updateDunningRule(
  tenantId: string,
  userId: string,
  input: UpdateArDunningRuleInput,
): Promise<boolean> {
  const result = await query(UPDATE_DUNNING_RULE_SQL, [
    input.template_code ?? null,
    input.delay_days ?? null,
    input.max_attempts ?? null,
    input.min_amount ?? null,
    input.escalation_order ?? null,
    input.is_active ?? null,
    userId,
    input.rule_id,
    tenantId,
  ]);

  const success = (result.rowCount ?? 0) > 0;
  if (success) {
    auditAsync({
      tenantId,
      userId,
      action: "UPDATE_DUNNING_RULE",
      entityType: "ar_dunning_rules",
      entityId: input.rule_id,
      category: "CONFIGURATION",
      severity: "INFO",
      description: `Updated dunning rule ${input.rule_id}`,
      newValues: input as unknown as Record<string, unknown>,
    });
  }

  return success;
}

export async function deleteDunningRule(
  tenantId: string,
  userId: string,
  ruleId: string,
): Promise<boolean> {
  const result = await query(DELETE_DUNNING_RULE_SQL, [ruleId, tenantId]);
  const success = (result.rowCount ?? 0) > 0;

  if (success) {
    auditAsync({
      tenantId,
      userId,
      action: "DELETE_DUNNING_RULE",
      entityType: "ar_dunning_rules",
      entityId: ruleId,
      category: "CONFIGURATION",
      severity: "WARNING",
      description: `Deleted dunning rule ${ruleId}`,
    });
  }

  return success;
}
