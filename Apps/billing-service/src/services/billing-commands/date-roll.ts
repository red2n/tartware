import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingDateRollManualCommandSchema } from "../../schemas/billing-commands.js";
import { asUuid, type CommandContext, resolveActorId, SYSTEM_ACTOR_ID } from "./common.js";

/**
 * Manually advance the business date without running the full night audit.
 * Skips charge posting, tax posting, no-show marking, trial balance, and
 * commission accruals — only advances the date.
 *
 * Useful for correcting date issues or initial property setup.
 */
export const manualDateRoll = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingDateRollManualCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;

  const bizDateResult = await query<{ business_date: string }>(
    `SELECT business_date::text AS business_date
     FROM public.business_dates
     WHERE property_id = $1 AND tenant_id = $2
     LIMIT 1`,
    [command.property_id, context.tenantId],
  );

  const currentDate = bizDateResult.rows[0]?.business_date;
  if (!currentDate) {
    throw new Error(`No business date found for property ${command.property_id}`);
  }

  const targetDate = command.target_date ?? null;

  if (!command.skip_validation) {
    const statusResult = await query<{ is_locked: boolean; allow_postings: boolean }>(
      `SELECT
         COALESCE(is_locked, false) AS is_locked,
         COALESCE(allow_postings, true) AS allow_postings
       FROM public.business_dates
       WHERE property_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [command.property_id, context.tenantId],
    );
    const status = statusResult.rows[0];
    if (status?.is_locked) {
      throw new Error(
        "Business date is locked — cannot advance. Unlock first or use skip_validation.",
      );
    }
  }

  if (targetDate) {
    await query(
      `UPDATE public.business_dates
       SET business_date = $3::date,
           previous_business_date = business_date,
           date_rolled_at = NOW(),
           date_rolled_by = $4::uuid,
           updated_at = NOW(),
           updated_by = $4::uuid
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, targetDate, actorId],
    );
  } else {
    await query(
      `UPDATE public.business_dates
       SET business_date = (business_date + INTERVAL '1 day')::date,
           previous_business_date = business_date,
           date_rolled_at = NOW(),
           date_rolled_by = $3::uuid,
           updated_at = NOW(),
           updated_by = $3::uuid
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, actorId],
    );
  }

  const newDateResult = await query<{ business_date: string }>(
    `SELECT business_date::text AS business_date
     FROM public.business_dates
     WHERE property_id = $1 AND tenant_id = $2
     LIMIT 1`,
    [command.property_id, context.tenantId],
  );
  const newDate = newDateResult.rows[0]?.business_date ?? "unknown";

  appLogger.info(
    {
      propertyId: command.property_id,
      previousDate: currentDate,
      newDate,
      reason: command.reason,
      actorId,
    },
    "Manual date roll completed",
  );

  return `date-roll:${currentDate}->${newDate}`;
};
