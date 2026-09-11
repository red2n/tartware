import { randomUUID } from "node:crypto";

import { gatewayRefusal } from "@tartware/schemas";

import { auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { resolveGatewayConfig } from "../../repositories/payment-gateway-repository.js";
import {
  BillingPaymentAuthorizeCommandSchema,
  BillingPaymentIncrementAuthCommandSchema,
  BillingPaymentVoidCommandSchema,
} from "../../schemas/billing-commands.js";
import { parseDbMoneyOrZero } from "../../utils/money.js";
import { type GatewayCallResult, simulatedAuthorize } from "../payment-gateways/simulated.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";
import { recordCreditLimitOverride } from "./credit-limit-gate.js";
import { enforceCreditLimit } from "./payment.js";

/**
 * Pre-authorize a payment hold without capturing funds.
 * Records an AUTHORIZED payment that can later be captured or voided.
 */
export const authorizePayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentAuthorizeCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Enforce credit limit before authorizing
  const creditLimit = await enforceCreditLimit(context.tenantId, command.guest_id, command.amount, {
    context,
    propertyId: command.property_id,
    commandName: "billing.payment.authorize",
    flowName: "check_in",
    override: {
      requested: command.credit_limit_override,
      reasonCode: command.credit_limit_override_reason_code,
      notes: command.credit_limit_override_notes,
    },
  });
  if (creditLimit.warning) {
    appLogger.warn(
      { guestId: command.guest_id, creditWarning: creditLimit.warning },
      "Credit limit warning on authorize",
    );
  }

  const currency = command.currency ?? "USD";

  // Which processor is this property actually wired to?
  //
  // Nothing on the payment path asked before. `gateway.name` and
  // `gateway.reference` arrive in the request body, so the row this handler
  // wrote said a processor approved something no processor was asked about —
  // and a folio settles against it. `payment_gateway_configurations` has held
  // the answer the whole time with exactly one reader, the webhook dispatcher.
  //
  // The refusal is non-retryable by default, which is what it should be: no
  // amount of backoff configures a processor, and a retried refusal stalls
  // every command queued behind it on the partition.
  const gateway = await resolveGatewayConfig(context.tenantId, command.property_id ?? null);
  const refusal = gatewayRefusal(gateway, command.amount, currency);
  if (refusal) {
    throw new BillingCommandError(refusal.code, refusal.message);
  }

  // What the processor returned — not what the caller sent.
  //
  // `command.gateway.name` / `.reference` were the whole mechanism before this:
  // the request body decided what the ledger recorded about a card operation.
  // They are now ignored on the authorize path. A MANUAL configuration is the
  // one case with no call to make, and it records that plainly rather than
  // borrowing a processor's vocabulary.
  const outcome: GatewayCallResult =
    gateway && gateway.provider === "SIMULATED"
      ? simulatedAuthorize(gateway, command.amount, currency)
      : {
          reference: `MANUAL-${command.payment_reference ?? asUuid(randomUUID())}`,
          name: gateway?.provider ?? "MANUAL",
          response: {
            simulated: false,
            note: "Offline payment recorded by an operator; no processor was contacted.",
            config_id: gateway?.configId ?? null,
            environment: gateway?.environment ?? null,
          },
        };

  const gatewayResponse = outcome.response;

  const result = await query<{ id: string }>(
    `
      INSERT INTO public.payments (
        tenant_id,
        property_id,
        reservation_id,
        guest_id,
        payment_reference,
        transaction_type,
        payment_method,
        amount,
        currency,
        status,
        gateway_name,
        gateway_reference,
        gateway_response,
        processed_at,
        processed_by,
        metadata,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        'AUTHORIZATION',
        UPPER($6)::payment_method,
        $7,
        UPPER($8),
        'AUTHORIZED',
        $9,
        $10,
        $11::jsonb,
        NOW(),
        $12,
        $13::jsonb,
        $12,
        $12
      )
      ON CONFLICT (tenant_id, payment_reference) DO UPDATE
      SET
        amount = EXCLUDED.amount,
        status = 'AUTHORIZED',
        version = payments.version + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `,
    [
      context.tenantId,
      command.property_id,
      command.reservation_id,
      command.guest_id,
      command.payment_reference,
      command.payment_method,
      command.amount,
      currency,
      outcome.name,
      outcome.reference,
      JSON.stringify(gatewayResponse),
      actor,
      JSON.stringify(command.metadata ?? {}),
    ],
  );

  const paymentId = result.rows[0]?.id;
  if (!paymentId) {
    throw new BillingCommandError(
      "PAYMENT_AUTHORIZE_FAILED",
      "Failed to record payment authorization.",
    );
  }

  // Only now: the authorisation exists, so the override row documents a block
  // that was actually lifted rather than one attempt out of four.
  if (creditLimit.override) {
    await recordCreditLimitOverride(
      creditLimit.override.gate,
      creditLimit.override.reason,
      command.credit_limit_override_notes,
    );
  }

  return paymentId;
};

/**
 * Void a previously authorized payment.
 * Only AUTHORIZED payments can be voided. Creates a VOID transaction.
 */
export const voidPayment = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingPaymentVoidCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);
  const actorId = asUuid(actor) ?? SYSTEM_ACTOR_ID;
  const currency = "USD";

  // Find the authorized payment by reference
  const { rows: authRows } = await query<{
    id: string;
    amount: string;
    status: string;
    version: number;
  }>(
    `SELECT id, amount, status, version FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );
  const authPayment = authRows[0];
  if (!authPayment) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }
  if (authPayment.status !== "AUTHORIZED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Payment is ${authPayment.status}, only AUTHORIZED payments can be voided`,
    );
  }

  const voidId = await withTransaction(async (client) => {
    // Mark original payment as CANCELLED
    const { rowCount } = await queryWithClient(
      client,
      `UPDATE public.payments SET status = 'CANCELLED', version = version + 1, updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid AND version = $3`,
      [authPayment.id, context.tenantId, authPayment.version],
    );

    if (rowCount === 0) {
      throw new BillingCommandError(
        "CONCURRENT_MODIFICATION",
        "Payment modified by another transaction",
        true,
      );
    }

    // Create a VOID transaction record
    const result = await queryWithClient<{ id: string }>(
      client,
      `INSERT INTO public.payments (
         tenant_id, property_id, reservation_id, guest_id,
         payment_reference, amount, currency,
         transaction_type, status, payment_method,
         notes, created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         (SELECT guest_id FROM public.payments WHERE id = $4::uuid),
         $5, $6, $7,
         'VOID', 'COMPLETED', 'CREDIT_CARD',
         $8, $9::uuid, $9::uuid
       ) RETURNING id`,
      [
        context.tenantId,
        command.property_id,
        command.reservation_id,
        authPayment.id,
        `VOID-${command.payment_reference}`,
        parseDbMoneyOrZero(authPayment.amount),
        currency,
        command.reason ?? "Payment voided",
        actorId,
      ],
    );
    const newVoidId = result.rows[0]?.id ?? randomUUID();

    // PCI-DSS Req 10: audit payment voids synchronously within the transaction.
    await auditWithClient(client, {
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actorId,
      action: "PAYMENT_VOID",
      entityType: "payment",
      entityId: authPayment.id,
      severity: "WARNING",
      isPciRelevant: true,
      description: `Payment authorization voided: ${command.payment_reference} reason=${command.reason ?? "not provided"}`,
      oldValues: {
        original_payment_id: authPayment.id,
        original_status: "AUTHORIZED",
        amount: parseDbMoneyOrZero(authPayment.amount),
      },
      newValues: {
        void_payment_id: newVoidId,
        new_status: "CANCELLED",
        reason: command.reason,
      },
    });

    return newVoidId;
  });

  appLogger.info(
    { voidId, originalPaymentId: authPayment.id, reference: command.payment_reference },
    "Payment voided",
  );
  return voidId;
};

/**
 * Increment an existing pre-authorization by adding an additional amount.
 * Only AUTHORIZED payments can be incremented. Updates the total authorization amount.
 */
export const incrementAuthorization = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentIncrementAuthCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  const { rows } = await query<{ id: string; amount: string; status: string; version: number }>(
    `SELECT id, amount, status, version FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );

  const existing = rows[0];
  if (!existing) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }
  if (existing.status !== "AUTHORIZED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Cannot increment authorization on payment with status ${existing.status}`,
    );
  }

  const newAmount = Number(existing.amount) + command.additional_amount;

  const { rowCount } = await query(
    `UPDATE public.payments
     SET amount = $3::numeric,
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{incremental_auth_history}',
           COALESCE(metadata->'incremental_auth_history', '[]'::jsonb) ||
           jsonb_build_object(
             'previous_amount', amount,
             'increment', $4::numeric,
             'new_amount', $3::numeric,
             'reason', $5::text,
             'timestamp', NOW()
           )::jsonb
         ),
         version = version + 1,
         updated_at = NOW(),
         updated_by = $6::uuid
     WHERE tenant_id = $1::uuid AND id = $2::uuid AND version = $7`,
    [
      context.tenantId,
      existing.id,
      newAmount,
      command.additional_amount,
      command.reason ?? null,
      actor,
      existing.version,
    ],
  );

  if (rowCount === 0) {
    throw new BillingCommandError(
      "CONCURRENT_MODIFICATION",
      "Payment modified by another transaction",
      true,
    );
  }

  appLogger.info(
    {
      paymentId: existing.id,
      previousAmount: Number(existing.amount),
      increment: command.additional_amount,
      newAmount,
    },
    "Payment authorization incremented",
  );

  return existing.id;
};
