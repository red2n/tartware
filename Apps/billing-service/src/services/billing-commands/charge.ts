import { queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingChargePostCommand,
  BillingChargePostCommandSchema,
  BillingChargeTransferCommandSchema,
  type BillingChargeVoidCommand,
  BillingChargeVoidCommandSchema,
  BillingFolioSplitCommandSchema,
} from "../../schemas/billing-commands.js";
import { addMoney, parseDbMoneyOrZero } from "../../utils/money.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Post a miscellaneous charge to a reservation folio.
 */
export const postCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingChargePostCommandSchema.parse(payload);
  return applyChargePost(command, context);
};

/**
 * Void a charge posting and create a reversal entry.
 * Adjusts folio balance to reverse the original charge.
 */
export const voidCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingChargeVoidCommandSchema.parse(payload);
  return applyChargeVoid(command, context);
};

/**
 * Transfer a specific charge posting from one folio to another.
 * Creates TRANSFER-type audit records on both folios and adjusts balances.
 */
export const transferCharge = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingChargeTransferCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  // Resolve target folio
  let targetFolioId = command.to_folio_id ?? null;
  if (!targetFolioId && command.to_reservation_id) {
    targetFolioId = await resolveFolioId(tenantId, command.to_reservation_id);
  }
  if (!targetFolioId) {
    throw new BillingCommandError(
      "FOLIO_NOT_FOUND",
      "Unable to locate target folio for charge transfer.",
    );
  }

  return withTransaction(async (client) => {
    // 1. Fetch and lock the original posting
    const { rows } = await queryWithClient<{
      posting_id: string;
      folio_id: string;
      property_id: string;
      reservation_id: string | null;
      charge_code: string;
      charge_description: string;
      quantity: string;
      unit_price: string;
      subtotal: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, folio_id, property_id, reservation_id,
              charge_code, charge_description, quantity, unit_price,
              subtotal, total_amount, currency_code, department_code, is_voided
       FROM charge_postings
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, tenantId],
    );

    const original = rows[0];
    if (!original) {
      throw new BillingCommandError(
        "POSTING_NOT_FOUND",
        `Posting ${command.posting_id} not found.`,
      );
    }
    if (original.is_voided) {
      throw new BillingCommandError("POSTING_VOIDED", "Cannot transfer a voided posting.");
    }
    if (original.folio_id === targetFolioId) {
      throw new BillingCommandError("SAME_FOLIO", "Source and target folio are the same.");
    }

    const amount = parseDbMoneyOrZero(original.total_amount);

    // 2. Mark original as transferred
    await queryWithClient(
      client,
      `UPDATE charge_postings
       SET transfer_to_folio_id = $3::uuid, updated_at = NOW(), updated_by = $4::uuid
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.posting_id, tenantId, targetFolioId, actorId],
    );

    // 3. Create TRANSFER CREDIT on source folio (reduces balance)
    await queryWithClient(
      client,
      `INSERT INTO charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount, currency_code,
         department_code, transfer_from_folio_id, transfer_to_folio_id,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'TRANSFER', 'CREDIT', $5, $6,
         $7, $8, $9, $10, $11,
         $12, $3::uuid, $13::uuid,
         $14::uuid, CURRENT_DATE, $15,
         $16::uuid, $16::uuid
       )`,
      [
        tenantId,
        original.property_id,
        original.folio_id,
        original.reservation_id,
        original.charge_code,
        `Transfer out: ${original.charge_description}`,
        original.quantity,
        original.unit_price,
        original.subtotal,
        original.total_amount,
        original.currency_code,
        original.department_code,
        targetFolioId,
        command.posting_id,
        command.reason ?? `Charge transferred to another folio`,
        actorId,
      ],
    );

    // 4. Create TRANSFER DEBIT on target folio (increases balance)
    const { rows: newRows } = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO charge_postings (
         tenant_id, property_id, folio_id, reservation_id,
         transaction_type, posting_type, charge_code, charge_description,
         quantity, unit_price, subtotal, total_amount, currency_code,
         department_code, transfer_from_folio_id,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         'TRANSFER', 'DEBIT', $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13::uuid,
         $14::uuid, CURRENT_DATE, $15,
         $16::uuid, $16::uuid
       )
       RETURNING posting_id`,
      [
        tenantId,
        original.property_id,
        targetFolioId,
        original.reservation_id,
        original.charge_code,
        `Transfer in: ${original.charge_description}`,
        original.quantity,
        original.unit_price,
        original.subtotal,
        original.total_amount,
        original.currency_code,
        original.department_code,
        original.folio_id,
        command.posting_id,
        command.reason ?? `Charge transferred from another folio`,
        actorId,
      ],
    );

    // 5. Adjust source folio balance (decrease)
    await queryWithClient(
      client,
      `UPDATE folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, amount, actorId, original.folio_id],
    );

    // 6. Adjust target folio balance (increase)
    await queryWithClient(
      client,
      `UPDATE folios
       SET total_charges = total_charges + $2,
           balance = balance + $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, amount, actorId, targetFolioId],
    );

    const newPostingId = newRows[0]?.posting_id ?? command.posting_id;
    appLogger.info(
      {
        originalPostingId: command.posting_id,
        newPostingId,
        fromFolio: original.folio_id,
        toFolio: targetFolioId,
        amount,
      },
      "Charge transferred between folios",
    );
    return newPostingId;
  });
};

/**
 * Split a charge across multiple folios.
 * Voids the original posting and creates partial-amount postings on each target folio.
 */
export const splitCharge = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingFolioSplitCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const tenantId = context.tenantId;

  return withTransaction(async (client) => {
    // 1. Fetch and lock the original posting
    const { rows } = await queryWithClient<{
      posting_id: string;
      folio_id: string;
      property_id: string;
      reservation_id: string | null;
      charge_code: string;
      charge_description: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, folio_id, property_id, reservation_id,
              charge_code, charge_description, total_amount, currency_code,
              department_code, is_voided
       FROM charge_postings
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, tenantId],
    );

    const original = rows[0];
    if (!original) {
      throw new BillingCommandError(
        "POSTING_NOT_FOUND",
        `Posting ${command.posting_id} not found.`,
      );
    }
    if (original.is_voided) {
      throw new BillingCommandError("POSTING_VOIDED", "Cannot split a voided posting.");
    }

    const originalAmount = parseDbMoneyOrZero(original.total_amount);
    const splitTotal = command.splits.reduce((sum, s) => addMoney(sum, s.amount), 0);
    if (Math.abs(splitTotal - originalAmount) > 0.01) {
      throw new BillingCommandError(
        "SPLIT_AMOUNT_MISMATCH",
        `Split amounts sum to ${splitTotal} but original posting is ${originalAmount}.`,
      );
    }

    // 2. Void the original posting
    await queryWithClient(
      client,
      `UPDATE charge_postings
       SET is_voided = TRUE, voided_at = NOW(), voided_by = $3::uuid,
           void_reason = 'Split into multiple folios', version = version + 1,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE posting_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.posting_id, tenantId, actorId],
    );

    // 3. Decrease source folio balance for the voided original
    await queryWithClient(
      client,
      `UPDATE folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(), updated_by = $3::uuid
       WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
      [tenantId, originalAmount, actorId, original.folio_id],
    );

    // 4. Create split postings on each target folio
    const splitIds: string[] = [];
    for (const split of command.splits) {
      let targetFolioId = split.folio_id ?? null;
      if (!targetFolioId && split.reservation_id) {
        const fid = await resolveFolioId(tenantId, split.reservation_id);
        targetFolioId = fid;
      }
      if (!targetFolioId) {
        throw new BillingCommandError(
          "FOLIO_NOT_FOUND",
          "Unable to locate target folio for split.",
        );
      }

      const unitPrice = split.amount;
      const desc = split.description ?? `Split: ${original.charge_description}`;

      const { rows: newRows } = await queryWithClient<{ posting_id: string }>(
        client,
        `INSERT INTO charge_postings (
           tenant_id, property_id, folio_id, reservation_id,
           transaction_type, posting_type, charge_code, charge_description,
           quantity, unit_price, subtotal, total_amount, currency_code,
           department_code, original_posting_id, business_date,
           notes, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           'CHARGE', 'DEBIT', $5, $6,
           1, $7, $7, $7, $8,
           $9, $10::uuid, CURRENT_DATE,
           $11, $12::uuid, $12::uuid
         )
         RETURNING posting_id`,
        [
          tenantId,
          original.property_id,
          targetFolioId,
          original.reservation_id,
          original.charge_code,
          desc,
          unitPrice,
          original.currency_code,
          original.department_code,
          command.posting_id,
          command.reason ?? `Split from posting ${command.posting_id}`,
          actorId,
        ],
      );

      // Update target folio balance
      await queryWithClient(
        client,
        `UPDATE folios
         SET total_charges = total_charges + $2,
             balance = balance + $2,
             updated_at = NOW(), updated_by = $3::uuid
         WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
        [tenantId, unitPrice, actorId, targetFolioId],
      );

      if (newRows[0]?.posting_id) {
        splitIds.push(newRows[0].posting_id);
      }
    }

    appLogger.info(
      { originalPostingId: command.posting_id, splitCount: command.splits.length, splitIds },
      "Charge split across folios",
    );
    return splitIds[0] ?? command.posting_id;
  });
};

const applyChargePost = async (
  command: BillingChargePostCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const currency = command.currency ?? "USD";
  const folioId = await resolveFolioId(context.tenantId, command.reservation_id);
  if (!folioId) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", "No folio found for reservation.");
  }

  const postingId = await withTransaction(async (client) => {
    const unitPrice = command.amount;
    const subtotal = unitPrice * command.quantity;
    const result = await queryWithClient<{ posting_id: string }>(
      client,
      `
        INSERT INTO public.charge_postings (
          tenant_id,
          property_id,
          folio_id,
          reservation_id,
          transaction_type,
          posting_type,
          charge_code,
          department_code,
          charge_description,
          quantity,
          unit_price,
          subtotal,
          total_amount,
          currency_code,
          posting_time,
          business_date,
          notes,
          created_by,
          updated_by
        ) VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          'CHARGE',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $11,
          UPPER($12),
          COALESCE($13::timestamptz, NOW()),
          CURRENT_DATE,
          $14,
          $15::uuid,
          $15::uuid
        )
        RETURNING posting_id
      `,
      [
        context.tenantId,
        command.property_id,
        folioId,
        command.reservation_id,
        command.posting_type,
        command.charge_code,
        command.department_code ?? null,
        command.description ?? "Charge",
        command.quantity,
        unitPrice,
        subtotal,
        currency,
        command.posted_at ?? null,
        command.description ?? null,
        actorId,
      ],
    );

    const id = result.rows[0]?.posting_id;
    if (!id) {
      throw new BillingCommandError("CHARGE_POST_FAILED", "Unable to post charge.");
    }

    // G3: Update folio totals — must satisfy CHECK (balance = total_charges - total_payments - total_credits)
    await queryWithClient(
      client,
      `
        UPDATE public.folios
        SET
          total_charges = total_charges + $2,
          balance = balance + $2,
          updated_at = NOW(),
          updated_by = $3::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id = $4::uuid
      `,
      [context.tenantId, command.amount, actorId, folioId],
    );

    return id;
  });

  return postingId;
};

/**
 * Void a charge posting. Within a single transaction:
 * 1. Validates the original posting exists and is not already voided.
 * 2. Marks the original posting as voided.
 * 3. Inserts a reversal VOID posting (CREDIT) for the same amount.
 * 4. Cross-links original ↔ void via void_posting_id / original_posting_id.
 * 5. Adjusts folio balance to reverse the charge.
 */
const applyChargeVoid = async (
  command: BillingChargeVoidCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;

  return withTransaction(async (client) => {
    const { rows: postingRows } = await queryWithClient<{
      posting_id: string;
      tenant_id: string;
      property_id: string;
      folio_id: string;
      reservation_id: string | null;
      guest_id: string | null;
      charge_code: string;
      charge_description: string;
      charge_category: string | null;
      quantity: string;
      unit_price: string;
      subtotal: string;
      tax_amount: string;
      service_charge: string;
      discount_amount: string;
      total_amount: string;
      currency_code: string;
      department_code: string | null;
      revenue_center: string | null;
      gl_account: string | null;
      is_voided: boolean;
    }>(
      client,
      `SELECT posting_id, tenant_id, property_id, folio_id, reservation_id,
              guest_id, charge_code, charge_description, charge_category,
              quantity, unit_price, subtotal, tax_amount, service_charge,
              discount_amount, total_amount, currency_code, department_code,
              revenue_center, gl_account, is_voided
       FROM public.charge_postings
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid
       FOR UPDATE`,
      [command.posting_id, context.tenantId],
    );

    const original = postingRows[0];
    if (!original) {
      throw new BillingCommandError(
        "POSTING_NOT_FOUND",
        `Charge posting ${command.posting_id} not found.`,
      );
    }
    if (original.is_voided) {
      throw new BillingCommandError(
        "POSTING_ALREADY_VOIDED",
        `Charge posting ${command.posting_id} has already been voided.`,
      );
    }

    await queryWithClient(
      client,
      `UPDATE public.charge_postings
       SET is_voided = TRUE,
           voided_at = NOW(),
           voided_by = $3::uuid,
           void_reason = $4,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $3::uuid
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid`,
      [command.posting_id, context.tenantId, actorId, command.void_reason ?? null],
    );

    const voidResult = await queryWithClient<{ posting_id: string }>(
      client,
      `INSERT INTO public.charge_postings (
         tenant_id, property_id, folio_id, reservation_id, guest_id,
         transaction_type, posting_type, charge_code, charge_description,
         charge_category, quantity, unit_price, subtotal,
         tax_amount, service_charge, discount_amount, total_amount,
         currency_code, department_code, revenue_center, gl_account,
         original_posting_id, business_date, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
         'VOID', 'CREDIT', $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20::uuid, CURRENT_DATE, $21,
         $22::uuid, $22::uuid
       )
       RETURNING posting_id`,
      [
        context.tenantId,
        original.property_id,
        original.folio_id,
        original.reservation_id,
        original.guest_id,
        original.charge_code,
        `VOID: ${original.charge_description}`,
        original.charge_category,
        original.quantity,
        original.unit_price,
        original.subtotal,
        original.tax_amount,
        original.service_charge,
        original.discount_amount,
        original.total_amount,
        original.currency_code,
        original.department_code,
        original.revenue_center,
        original.gl_account,
        command.posting_id,
        command.void_reason ?? `Void of posting ${command.posting_id}`,
        actorId,
      ],
    );

    const voidPostingId = voidResult.rows[0]?.posting_id;
    if (!voidPostingId) {
      throw new BillingCommandError("CHARGE_VOID_FAILED", "Failed to create void posting.");
    }

    await queryWithClient(
      client,
      `UPDATE public.charge_postings
       SET void_posting_id = $3::uuid,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $4::uuid
       WHERE posting_id = $1::uuid
         AND tenant_id = $2::uuid`,
      [command.posting_id, context.tenantId, voidPostingId, actorId],
    );

    const totalAmount = parseDbMoneyOrZero(original.total_amount);
    await queryWithClient(
      client,
      `UPDATE public.folios
       SET total_charges = total_charges - $2,
           balance = balance - $2,
           updated_at = NOW(),
           updated_by = $3::uuid
       WHERE tenant_id = $1::uuid
         AND folio_id = $4::uuid`,
      [context.tenantId, totalAmount, actorId, original.folio_id],
    );

    appLogger.info(
      { voidPostingId, originalPostingId: command.posting_id, totalAmount },
      "Charge posting voided",
    );

    return voidPostingId;
  });
};
