import { randomUUID } from "node:crypto";

import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingNightAuditCommandSchema } from "../../schemas/billing-commands.js";
import {
  type CommandContext,
  SYSTEM_ACTOR_ID,
  asUuid,
  resolveActorId,
  resolveFolioId,
} from "./common.js";

/**
 * Execute the nightly audit process:
 * 1. Post room+tax charges for all CHECKED_IN reservations
 * 2. Mark stale PENDING/CONFIRMED reservations as NO_SHOW
 * 3. Advance the business date
 */
export const executeNightAudit = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingNightAuditCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const shouldPostCharges = command.post_room_charges !== false;
  const shouldMarkNoShows = command.mark_no_shows !== false;
  const shouldAdvanceDate = command.advance_date !== false;

  // Resolve current business date
  const bizDateResult = await query<{ business_date: string }>(
    `SELECT business_date::text AS business_date FROM public.business_dates
     WHERE property_id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.property_id, context.tenantId],
  );
  const businessDate = command.business_date ?? bizDateResult.rows[0]?.business_date;
  const auditDate = businessDate ?? new Date().toISOString().slice(0, 10);

  let chargesPosted = 0;
  let noShowsMarked = 0;
  let taxChargesPosted = 0;

  // Step 1: Post room charges for in-house guests
  if (shouldPostCharges) {
    const inHouseResult = await query<{
      id: string;
      room_rate: string;
      room_number: string;
      total_amount: string;
      guest_id: string;
    }>(
      `SELECT r.id, r.room_rate, r.room_number, r.total_amount, r.guest_id
       FROM reservations r
       WHERE r.tenant_id = $1 AND r.property_id = $2 AND r.status = 'CHECKED_IN'
         AND r.is_deleted = false`,
      [context.tenantId, command.property_id],
    );

    for (const res of inHouseResult.rows) {
      const roomRate = Number(res.room_rate ?? 0);
      if (roomRate <= 0) continue;

      const folioId = await resolveFolioId(context.tenantId, res.id);
      if (!folioId) continue;

      try {
        await withTransaction(async (client) => {
          // Post room charge
          await queryWithClient(
            client,
            `INSERT INTO public.charge_postings (
               tenant_id, property_id, folio_id, reservation_id,
               transaction_type, posting_type, charge_code, charge_description,
               quantity, unit_price, subtotal, total_amount,
               currency_code, posting_time, business_date,
               notes, created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, $4::uuid,
               'CHARGE', 'DEBIT', 'ROOM', 'Room charge - night audit',
               1, $5, $5, $5,
               'USD', NOW(), $6::date,
               'Auto-posted by night audit', $7::uuid, $7::uuid
             )`,
            [context.tenantId, command.property_id, folioId, res.id, roomRate, auditDate, actorId],
          );

          // G7: Calculate and post applicable taxes for room charge
          const taxResult = await queryWithClient<{
            tax_code: string;
            tax_name: string;
            tax_rate: string;
          }>(
            client,
            `SELECT tax_code, tax_name, tax_rate FROM tax_configurations
             WHERE tenant_id = $1::uuid
               AND (property_id = $2::uuid OR property_id IS NULL)
               AND is_active = TRUE
               AND effective_from <= $3::date
               AND (effective_to IS NULL OR effective_to >= $3::date)
               AND 'rooms' = ANY(applies_to)
               AND is_percentage = TRUE
             ORDER BY tax_code`,
            [context.tenantId, command.property_id, auditDate],
          );

          let totalTaxAmount = 0;
          for (const tax of taxResult.rows) {
            const taxRate = Number(tax.tax_rate);
            const taxAmount = Number(((roomRate * taxRate) / 100).toFixed(2));
            if (taxAmount <= 0) continue;

            await queryWithClient(
              client,
              `INSERT INTO public.charge_postings (
                 tenant_id, property_id, folio_id, reservation_id,
                 transaction_type, posting_type, charge_code, charge_description,
                 quantity, unit_price, subtotal, total_amount,
                 currency_code, posting_time, business_date,
                 department_code, notes, created_by, updated_by
               ) VALUES (
                 $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                 'CHARGE', 'DEBIT', 'ROOM_TAX', $5,
                 1, $6, $6, $6,
                 'USD', NOW(), $7::date,
                 'ROOMS', $8, $9::uuid, $9::uuid
               )`,
              [
                context.tenantId,
                command.property_id,
                folioId,
                res.id,
                `${tax.tax_name} (${taxRate}%)`,
                taxAmount,
                auditDate,
                `${tax.tax_code}: ${taxRate}% on room charge`,
                actorId,
              ],
            );
            totalTaxAmount += taxAmount;
            taxChargesPosted++;
          }

          // Update folio balance (room charge + taxes)
          const chargeTotal = roomRate + totalTaxAmount;
          await queryWithClient(
            client,
            `UPDATE public.folios
             SET total_charges = total_charges + $2,
                 balance = balance + $2,
                 updated_at = NOW(), updated_by = $3::uuid
             WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
            [context.tenantId, chargeTotal, actorId, folioId],
          );
        });
        chargesPosted++;
      } catch {
        // Log but continue with other reservations
      }
    }
  }

  // Step 2: Mark no-shows (PENDING/CONFIRMED with check_in_date <= business date)
  if (shouldMarkNoShows) {
    const noShowResult = await query<{ count: string }>(
      `UPDATE reservations
       SET status = 'NO_SHOW', is_no_show = true,
           no_show_date = NOW(), no_show_fee = COALESCE(room_rate, 0),
           version = version + 1, updated_at = NOW()
       WHERE tenant_id = $1 AND property_id = $2
         AND status IN ('PENDING', 'CONFIRMED')
         AND check_in_date <= $3::date
         AND is_deleted = false
       RETURNING id`,
      [context.tenantId, command.property_id, auditDate],
    );
    noShowsMarked = noShowResult.rowCount ?? 0;
  }

  // Step 3: Advance business date
  if (shouldAdvanceDate) {
    await query(
      `UPDATE public.business_dates
       SET business_date = ($3::date + INTERVAL '1 day')::date,
           previous_business_date = $3::date,
           updated_at = NOW(), updated_by = $4
       WHERE property_id = $1 AND tenant_id = $2`,
      [command.property_id, context.tenantId, auditDate, actorId],
    );
  }

  // Log audit run in night_audit_log
  const auditRunId = randomUUID();
  const auditLogResult = await query<{ audit_log_id: string }>(
    `INSERT INTO public.night_audit_log (
       tenant_id, property_id, audit_run_id, business_date,
       audit_status, step_number, step_name, step_category, step_status,
       started_at, completed_at, step_completed_at,
       records_processed, records_succeeded,
       initiated_by, created_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::date,
       'COMPLETED', 1, 'night_audit_full', 'AUDIT', 'COMPLETED',
       NOW(), NOW(), NOW(),
       $5, $5,
       $6::uuid, $6::uuid
     )
     ON CONFLICT DO NOTHING
     RETURNING audit_log_id`,
    [
      context.tenantId,
      command.property_id,
      auditRunId,
      auditDate,
      chargesPosted + noShowsMarked,
      actorId,
    ],
  );

  appLogger.info(
    { auditDate, chargesPosted, noShowsMarked, taxChargesPosted, auditRunId },
    "Night audit completed",
  );

  return auditLogResult.rows[0]?.audit_log_id ?? `audit-${auditDate}`;
};
