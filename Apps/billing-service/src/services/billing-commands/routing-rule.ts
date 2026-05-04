import { auditAsync } from "../../lib/audit-logger.js";
import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingRoutingRuleCloneTemplateCommandSchema,
  BillingRoutingRuleCreateCommandSchema,
  BillingRoutingRuleDeleteCommandSchema,
  BillingRoutingRuleUpdateCommandSchema,
} from "../../schemas/billing-commands.js";
import { asUuid, BillingCommandError, type CommandContext, resolveActorId } from "./common.js";

const logger = appLogger.child({ module: "routing-rule-commands" });

/**
 * Create a new folio routing rule (template or active).
 */
export const createRoutingRule = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingRoutingRuleCreateCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info(
    { tenantId, ruleName: command.rule_name, isTemplate: command.is_template },
    "creating routing rule",
  );

  await query(
    `INSERT INTO folio_routing_rules (
      tenant_id, property_id, rule_name, rule_code, description,
      is_template, source_folio_id, source_reservation_id,
      destination_folio_id, destination_folio_type,
      charge_code_pattern, transaction_type, charge_category,
      min_amount, max_amount,
      routing_type, routing_percentage, routing_fixed_amount,
      priority, stop_on_match,
      effective_from, effective_until,
      auto_apply_to_group, auto_apply_to_company,
      company_id, group_booking_id,
      is_active,
      created_by, updated_by
    ) VALUES (
      $1::uuid, $2::uuid, $3, $4, $5,
      $6, $7::uuid, $8::uuid,
      $9::uuid, $10,
      $11, $12, $13,
      $14, $15,
      $16, $17, $18,
      $19, $20,
      $21, $22,
      $23, $24,
      $25::uuid, $26::uuid,
      true,
      $27::uuid, $27::uuid
    )`,
    [
      tenantId,
      command.property_id,
      command.rule_name,
      command.rule_code ?? null,
      command.description ?? null,
      command.is_template,
      command.source_folio_id ?? null,
      command.source_reservation_id ?? null,
      command.destination_folio_id ?? null,
      command.destination_folio_type ?? null,
      command.charge_code_pattern ?? null,
      command.transaction_type ?? null,
      command.charge_category ?? null,
      command.min_amount ?? null,
      command.max_amount ?? null,
      command.routing_type,
      command.routing_percentage ?? null,
      command.routing_fixed_amount ?? null,
      command.priority,
      command.stop_on_match,
      command.effective_from ?? null,
      command.effective_until ?? null,
      command.auto_apply_to_group,
      command.auto_apply_to_company,
      command.company_id ?? null,
      command.group_booking_id ?? null,
      asUuid(actorId),
    ],
  );

  logger.info({ tenantId, ruleName: command.rule_name }, "routing rule created");
  auditAsync({
    tenantId,
    propertyId: command.property_id,
    userId: actorId,
    action: "ROUTING_RULE_CREATE",
    entityType: "folio_routing_rule",
    severity: "INFO",
    description: `Routing rule '${command.rule_name}' created (template=${command.is_template})`,
    newValues: {
      rule_name: command.rule_name,
      rule_code: command.rule_code,
      is_template: command.is_template,
      property_id: command.property_id,
      routing_type: command.routing_type,
      priority: command.priority,
    },
  });
};

/**
 * Update an existing routing rule.
 * Only non-undefined fields in the payload are updated.
 */
export const updateRoutingRule = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingRoutingRuleUpdateCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info({ tenantId, ruleId: command.rule_id }, "updating routing rule");

  const setClauses: string[] = [];
  const params: unknown[] = [tenantId, command.rule_id];
  let paramIdx = 3;

  const updatableFields: Array<{ column: string; value: unknown; cast?: string }> = [
    { column: "rule_name", value: command.rule_name },
    { column: "description", value: command.description },
    { column: "destination_folio_id", value: command.destination_folio_id, cast: "::uuid" },
    { column: "destination_folio_type", value: command.destination_folio_type },
    { column: "charge_code_pattern", value: command.charge_code_pattern },
    { column: "transaction_type", value: command.transaction_type },
    { column: "charge_category", value: command.charge_category },
    { column: "min_amount", value: command.min_amount },
    { column: "max_amount", value: command.max_amount },
    { column: "routing_type", value: command.routing_type },
    { column: "routing_percentage", value: command.routing_percentage },
    { column: "routing_fixed_amount", value: command.routing_fixed_amount },
    { column: "priority", value: command.priority },
    { column: "stop_on_match", value: command.stop_on_match },
    { column: "effective_from", value: command.effective_from },
    { column: "effective_until", value: command.effective_until },
    { column: "is_active", value: command.is_active },
  ];

  for (const field of updatableFields) {
    if (field.value !== undefined) {
      setClauses.push(`${field.column} = $${paramIdx}${field.cast ?? ""}`);
      params.push(field.value);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    logger.warn({ tenantId, ruleId: command.rule_id }, "no fields to update");
    return;
  }

  setClauses.push(`updated_at = NOW()`);
  setClauses.push(`updated_by = $${paramIdx}::uuid`);
  params.push(asUuid(actorId));

  const { rowCount } = await query(
    `UPDATE folio_routing_rules
     SET ${setClauses.join(", ")}
     WHERE tenant_id = $1::uuid
       AND rule_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    params,
  );

  if (rowCount === 0) {
    throw new BillingCommandError(
      "ROUTING_RULE_NOT_FOUND",
      `Routing rule ${command.rule_id} not found or already deleted`,
    );
  }

  logger.info(
    { tenantId, ruleId: command.rule_id, fieldsUpdated: setClauses.length - 2 },
    "routing rule updated",
  );
  auditAsync({
    tenantId,
    userId: actorId,
    action: "ROUTING_RULE_UPDATE",
    entityType: "folio_routing_rule",
    entityId: command.rule_id,
    severity: "INFO",
    description: `Routing rule ${command.rule_id} updated (${setClauses.length - 2} fields)`,
    newValues: { fields_updated: setClauses.length - 2 },
  });
};

/**
 * Soft-delete a routing rule.
 */
export const deleteRoutingRule = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingRoutingRuleDeleteCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info({ tenantId, ruleId: command.rule_id }, "deleting routing rule");

  const { rowCount } = await query(
    `UPDATE folio_routing_rules
     SET is_deleted = true,
         is_active = false,
         deleted_at = NOW(),
         deleted_by = $3::uuid,
         updated_at = NOW(),
         updated_by = $3::uuid
     WHERE tenant_id = $1::uuid
       AND rule_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, command.rule_id, asUuid(actorId)],
  );

  if (rowCount === 0) {
    throw new BillingCommandError(
      "ROUTING_RULE_NOT_FOUND",
      `Routing rule ${command.rule_id} not found or already deleted`,
    );
  }

  logger.info({ tenantId, ruleId: command.rule_id }, "routing rule deleted");
  auditAsync({
    tenantId,
    userId: actorId,
    action: "ROUTING_RULE_DELETE",
    entityType: "folio_routing_rule",
    entityId: command.rule_id,
    severity: "WARNING",
    description: `Routing rule ${command.rule_id} soft-deleted`,
    oldValues: { is_active: true, is_deleted: false },
    newValues: { is_active: false, is_deleted: true },
  });
};

/**
 * Clone a template rule into an active rule bound to specific folios.
 * Copies all template criteria, sets is_template=false, and binds source + destination.
 */
export const cloneRoutingRuleTemplate = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingRoutingRuleCloneTemplateCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info(
    { tenantId, templateId: command.template_id, sourceFolio: command.source_folio_id },
    "cloning routing rule template",
  );

  const { rows } = await query<{ rule_id: string }>(
    `INSERT INTO folio_routing_rules (
      tenant_id, property_id, rule_name, rule_code, description,
      is_template, template_id,
      source_folio_id, destination_folio_id, destination_folio_type,
      charge_code_pattern, transaction_type, charge_category,
      min_amount, max_amount,
      routing_type, routing_percentage, routing_fixed_amount,
      priority, stop_on_match,
      effective_from, effective_until,
      is_active,
      created_by, updated_by
    )
    SELECT
      t.tenant_id, t.property_id,
      t.rule_name || ' (cloned)', t.rule_code, t.description,
      false, t.rule_id,
      $3::uuid, $4::uuid, t.destination_folio_type,
      t.charge_code_pattern, t.transaction_type, t.charge_category,
      t.min_amount, t.max_amount,
      t.routing_type, t.routing_percentage, t.routing_fixed_amount,
      COALESCE($5, t.priority), t.stop_on_match,
      COALESCE($6, t.effective_from), COALESCE($7, t.effective_until),
      true,
      $8::uuid, $8::uuid
    FROM folio_routing_rules t
    WHERE t.tenant_id = $1::uuid
      AND t.rule_id = $2::uuid
      AND t.is_template = true
      AND COALESCE(t.is_deleted, false) = false
    RETURNING rule_id`,
    [
      tenantId,
      command.template_id,
      command.source_folio_id,
      command.destination_folio_id,
      command.priority ?? null,
      command.effective_from ?? null,
      command.effective_until ?? null,
      asUuid(actorId),
    ],
  );

  if (rows.length === 0) {
    throw new BillingCommandError(
      "TEMPLATE_NOT_FOUND",
      `Routing rule template ${command.template_id} not found or is not a template`,
    );
  }

  const newRule = rows[0] as { rule_id: string };
  logger.info(
    { tenantId, templateId: command.template_id, newRuleId: newRule.rule_id },
    "routing rule cloned from template",
  );
  auditAsync({
    tenantId,
    userId: actorId,
    action: "ROUTING_RULE_CLONE",
    entityType: "folio_routing_rule",
    entityId: newRule.rule_id,
    severity: "INFO",
    description: `Cloned routing rule template ${command.template_id} \u2192 ${newRule.rule_id}`,
    newValues: {
      template_id: command.template_id,
      new_rule_id: newRule.rule_id,
      source_folio_id: command.source_folio_id,
      destination_folio_id: command.destination_folio_id,
    },
  });
};
