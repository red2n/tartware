/**
 * HTNG POS Charge Route — ACCT-05
 *
 * POST /v1/billing/charges/pos
 *
 * Dedicated HTNG-compatible endpoint for POS system charge posting.
 * Provides sub-3-second response SLA; enforces idempotency on pos_transaction_id.
 *
 * Ref: BA §2.2, §14.1 | Issue: ACCT-05
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { PosChargeInput } from "@tartware/schemas";
import { PosChargeInputSchema, PosChargeResponseSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { BillingCommandError } from "../services/billing-commands/common.js";
import { postPosCharge } from "../services/pos-charge-service.js";

const POS_TAG = "POS Integration";

const PosChargeBodyJsonSchema = schemaFromZod(PosChargeInputSchema, "PosChargeInput");
const PosChargeResponseJsonSchema = schemaFromZod(PosChargeResponseSchema, "PosChargeResponse");

// 3-second SLA guard — matches HTNG §14.1 timeout requirement
const POS_TIMEOUT_MS = 3_000;

export const registerPosChargeRoutes = (app: FastifyInstance): void => {
  app.post<{ Body: PosChargeInput }>(
    "/v1/billing/charges/pos",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as PosChargeInput).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: POS_TAG,
        summary:
          "Post an HTNG-compatible POS charge to a guest folio (room number → folio resolution, idempotent on pos_transaction_id)",
        body: PosChargeBodyJsonSchema,
        response: {
          200: PosChargeResponseJsonSchema,
          409: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      }),
    },
    async (request, reply) => {
      const input = PosChargeInputSchema.parse(request.body);

      // Resolve actor from JWT; fall back to system account for integration tokens
      const actorId =
        (request.auth?.userId as string | undefined) ?? "00000000-0000-0000-0000-000000000000";

      // Apply 3-second response SLA (HTNG §14.1).
      // If the DB is overloaded the POS system will queue and retry with
      // pos_transaction_id providing idempotency protection.
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new BillingCommandError("POS_TIMEOUT", "POS charge timed out — retry.", true)),
          POS_TIMEOUT_MS,
        ),
      );

      const result = await Promise.race([postPosCharge(input, actorId), timeoutPromise]);

      if (result.duplicate) {
        reply.code(200);
      }

      return PosChargeResponseSchema.parse(result);
    },
  );
};
