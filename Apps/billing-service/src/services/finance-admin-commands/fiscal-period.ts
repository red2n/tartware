import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingFiscalPeriodCloseCommandSchema,
  BillingFiscalPeriodLockCommandSchema,
  BillingFiscalPeriodReopenCommandSchema,
} from "../../schemas/finance-commands.js";
import {
  BillingCommandError,
  type CommandContext,
  resolveActorId,
} from "../billing-commands/common.js";

export const closeFiscalPeriod = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingFiscalPeriodCloseCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rowCount } = await query(
    `UPDATE public.fiscal_periods
     SET period_status = 'SOFT_CLOSE',
         soft_closed_at = NOW(),
         soft_closed_by = $4,
         close_notes = $5,
         updated_at = NOW()
     WHERE tenant_id = $1::uuid
       AND fiscal_period_id = $2::uuid
       AND property_id = $3::uuid
       AND period_status = 'OPEN'`,
    [context.tenantId, command.period_id, command.property_id, actor, command.close_reason ?? null],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "PERIOD_NOT_FOUND_OR_NOT_OPEN",
      "Fiscal period not found or is not in OPEN status",
    );
  }

  appLogger.info(
    { periodId: command.period_id, propertyId: command.property_id },
    "Fiscal period soft-closed",
  );
};

export const lockFiscalPeriod = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingFiscalPeriodLockCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rowCount } = await query(
    `UPDATE public.fiscal_periods
     SET period_status = 'LOCKED',
         locked_at = NOW(),
         locked_by = COALESCE($4, $5),
         updated_at = NOW()
     WHERE tenant_id = $1::uuid
       AND fiscal_period_id = $2::uuid
       AND property_id = $3::uuid
       AND period_status = 'SOFT_CLOSE'`,
    [context.tenantId, command.period_id, command.property_id, command.approved_by ?? null, actor],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "PERIOD_NOT_SOFT_CLOSED",
      "Fiscal period must be in SOFT_CLOSE status before locking",
    );
  }

  appLogger.info(
    { periodId: command.period_id, propertyId: command.property_id },
    "Fiscal period locked",
  );
};

export const reopenFiscalPeriod = async (
  payload: unknown,
  context: CommandContext,
): Promise<void> => {
  const command = BillingFiscalPeriodReopenCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rowCount } = await query(
    `UPDATE public.fiscal_periods
     SET period_status = 'OPEN',
         soft_closed_at = NULL,
         soft_closed_by = NULL,
         close_notes = $5,
         updated_at = NOW()
     WHERE tenant_id = $1::uuid
       AND fiscal_period_id = $2::uuid
       AND property_id = $3::uuid
       AND period_status = 'SOFT_CLOSE'`,
    [context.tenantId, command.period_id, command.property_id, actor, command.reason],
  );

  if (!rowCount || rowCount === 0) {
    throw new BillingCommandError(
      "PERIOD_NOT_SOFT_CLOSED",
      "Only SOFT_CLOSE periods can be reopened (LOCKED periods are immutable)",
    );
  }

  appLogger.info(
    { periodId: command.period_id, propertyId: command.property_id, reason: command.reason },
    "Fiscal period reopened",
  );
};
