import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingTaxConfigCreateCommandSchema,
  BillingTaxConfigDeleteCommandSchema,
  BillingTaxConfigUpdateCommandSchema,
} from "../../schemas/billing-commands.js";
import { asUuid, BillingCommandError, type CommandContext, resolveActorId } from "./common.js";

const logger = appLogger.child({ module: "tax-config-commands" });

/**
 * Create a new tax configuration rule.
 */
export const createTaxConfig = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = BillingTaxConfigCreateCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info(
    { tenantId, taxCode: command.tax_code, taxType: command.tax_type },
    "creating tax configuration",
  );

  await query(
    `INSERT INTO tax_configurations (
			tenant_id, property_id, tax_code, tax_name, tax_description,
			tax_type, country_code, state_province, city,
			jurisdiction_name, jurisdiction_level,
			tax_rate, is_percentage, fixed_amount,
			effective_from, effective_to, is_active,
			applies_to, excluded_items,
			is_compound_tax, compound_order, compound_on_tax_codes,
			calculation_method, rounding_method,
			created_by, updated_by
		) VALUES (
			$1::uuid, $2::uuid, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11,
			$12, $13, $14,
			$15, $16, $17,
			$18, $19,
			$20, $21, $22,
			$23, $24,
			$25::uuid, $25::uuid
		)`,
    [
      tenantId,
      command.property_id,
      command.tax_code,
      command.tax_name,
      command.tax_description ?? null,
      command.tax_type,
      command.country_code,
      command.state_province ?? null,
      command.city ?? null,
      command.jurisdiction_name ?? null,
      command.jurisdiction_level ?? null,
      command.tax_rate,
      command.is_percentage ?? true,
      command.fixed_amount ?? null,
      command.effective_from,
      command.effective_to ?? null,
      command.is_active ?? true,
      command.applies_to ?? null,
      command.excluded_items ?? null,
      command.is_compound_tax ?? false,
      command.compound_order ?? null,
      command.compound_on_tax_codes ?? null,
      command.calculation_method ?? "standard",
      command.rounding_method ?? "round_half_up",
      asUuid(actorId),
    ],
  );

  logger.info({ tenantId, taxCode: command.tax_code }, "tax configuration created");
};

/**
 * Update an existing tax configuration rule.
 * Only non-null fields in the payload are updated.
 */
export const updateTaxConfig = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = BillingTaxConfigUpdateCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info({ tenantId, taxConfigId: command.tax_config_id }, "updating tax configuration");

  // Build dynamic SET clause from provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [tenantId, command.tax_config_id];
  let paramIdx = 3;

  const updatableFields: Array<{
    column: string;
    value: unknown;
    cast?: string;
  }> = [
    { column: "tax_code", value: command.tax_code },
    { column: "tax_name", value: command.tax_name },
    { column: "tax_description", value: command.tax_description },
    { column: "tax_type", value: command.tax_type },
    { column: "tax_rate", value: command.tax_rate },
    { column: "is_percentage", value: command.is_percentage },
    { column: "fixed_amount", value: command.fixed_amount },
    { column: "effective_from", value: command.effective_from },
    { column: "effective_to", value: command.effective_to },
    { column: "is_active", value: command.is_active },
    { column: "applies_to", value: command.applies_to },
    { column: "excluded_items", value: command.excluded_items },
    { column: "is_compound_tax", value: command.is_compound_tax },
    { column: "compound_order", value: command.compound_order },
    { column: "compound_on_tax_codes", value: command.compound_on_tax_codes },
    { column: "calculation_method", value: command.calculation_method },
    { column: "rounding_method", value: command.rounding_method },
  ];

  for (const field of updatableFields) {
    if (field.value !== undefined) {
      setClauses.push(`${field.column} = $${paramIdx}${field.cast ?? ""}`);
      params.push(field.value);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    logger.warn({ tenantId, taxConfigId: command.tax_config_id }, "no fields to update");
    return;
  }

  setClauses.push(`updated_at = NOW()`);
  setClauses.push(`updated_by = $${paramIdx}::uuid`);
  params.push(asUuid(actorId));

  const { rowCount } = await query(
    `UPDATE tax_configurations
		 SET ${setClauses.join(", ")}
		 WHERE tenant_id = $1::uuid
		   AND tax_config_id = $2::uuid
		   AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()`,
    params,
  );

  if (rowCount === 0) {
    throw new BillingCommandError(
      "TAX_CONFIG_NOT_FOUND",
      `Tax configuration ${command.tax_config_id} not found or already deleted`,
    );
  }

  logger.info(
    { tenantId, taxConfigId: command.tax_config_id, fieldsUpdated: setClauses.length - 2 },
    "tax configuration updated",
  );
};

/**
 * Soft-delete (deactivate) a tax configuration.
 */
export const deleteTaxConfig = async (payload: unknown, context: CommandContext): Promise<void> => {
  const command = BillingTaxConfigDeleteCommandSchema.parse(payload);
  const actorId = resolveActorId(context.initiatedBy);
  const tenantId = context.tenantId;

  logger.info({ tenantId, taxConfigId: command.tax_config_id }, "deactivating tax configuration");

  const { rowCount } = await query(
    `UPDATE tax_configurations
		 SET is_active = false,
		     deleted_at = NOW(),
		     deleted_by = $3::uuid,
		     updated_at = NOW(),
		     updated_by = $3::uuid
		 WHERE tenant_id = $1::uuid
		   AND tax_config_id = $2::uuid
		   AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()`,
    [tenantId, command.tax_config_id, asUuid(actorId)],
  );

  if (rowCount === 0) {
    throw new BillingCommandError(
      "TAX_CONFIG_NOT_FOUND",
      `Tax configuration ${command.tax_config_id} not found or already deleted`,
    );
  }

  logger.info(
    { tenantId, taxConfigId: command.tax_config_id, reason: command.reason },
    "tax configuration deactivated",
  );
};
