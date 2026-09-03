import { verifyWebhookSignature } from "@tartware/fastify-server/webhook-signature";
import {
  CHANNEL_SIGNATURE_HEADER,
  OtaReservationIntakeRequestSchema,
  type OtaReservationIntakeResult,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";

/**
 * The channel reservation ingress — the writer `ota_reservations_queue` never
 * had.
 *
 * Before this route the queue was drained by a command and filled by nothing:
 * no INSERT into it existed anywhere in the repository, so the inbound half of
 * channel management was a processor running against a permanently empty table.
 *
 * Shape follows billing's payment-gateway webhook, deliberately — same raw-body
 * parser, same constant-time HMAC through the same shared helper, same "always
 * 202 once the signature passes" contract. A channel manager that is handed an
 * error retries, so a duplicate must not be one.
 */

const logger = reservationsLogger.child({ module: "channel-intake" });

export const registerChannelIntakeRoutes = (app: FastifyInstance): void => {
  // A child scope, so the raw-body parser applies here and nowhere else.
  void app.register(channelIntakePlugin);
};

const channelIntakePlugin: FastifyPluginAsync = async (scope) => {
  // The HMAC has to be computed over the exact bytes the channel signed, so the
  // raw Buffer is kept alongside the parsed object. Merged last so a channel
  // payload cannot shadow the sentinel.
  scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    try {
      const parsed = JSON.parse((body as Buffer).toString("utf8")) as Record<string, unknown>;
      done(null, { ...parsed, __rawBody: body });
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  scope.post(
    "/v1/channels/:otaCode/reservations",
    {
      schema: {
        description:
          "Inbound channel reservation delivery. HMAC-SHA256 verified against the channel's api_secret, idempotent on the channel's own reservation id.",
        tags: ["Channels"],
        params: {
          type: "object",
          required: ["otaCode"],
          properties: { otaCode: { type: "string", minLength: 1, maxLength: 50 } },
        },
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: { tenant_id: { type: "string", format: "uuid" } },
        },
        response: {
          202: {
            type: "object",
            properties: {
              accepted: { type: "number" },
              duplicates: { type: "number" },
              results: { type: "array", items: { type: "object" } },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          422: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { otaCode } = request.params as { otaCode: string };
      const { tenant_id: tenantId } = request.query as { tenant_id?: string };
      if (!tenantId) {
        return reply.status(422).send({ error: "tenant_id is required" });
      }

      const body = request.body as Record<string, unknown> & { __rawBody: Buffer };
      const rawBody = body.__rawBody;
      const { __rawBody: _discarded, ...payload } = body;

      const parsed = OtaReservationIntakeRequestSchema.safeParse(payload);
      if (!parsed.success) {
        return reply
          .status(422)
          .send({ error: `Invalid channel payload: ${parsed.error.message}` });
      }
      const { property_id: propertyId, reservations } = parsed.data;

      // The channel's own signing secret, scoped to this tenant and property.
      // An unconfigured channel is a 401 rather than a 404: an unauthenticated
      // caller learns nothing about which channels a property has wired up.
      const { rows: configRows } = await query<{ id: string; api_secret: string | null }>(
        `SELECT id, api_secret
           FROM ota_configurations
          WHERE tenant_id = $1 AND property_id = $2 AND ota_code = $3
            AND is_active = TRUE AND is_deleted = FALSE`,
        [tenantId, propertyId, otaCode],
      );
      const otaConfig = configRows[0];
      if (!otaConfig?.api_secret) {
        return reply.status(401).send({ error: "Channel not configured for tenant" });
      }

      const signature = (request.headers[CHANNEL_SIGNATURE_HEADER] as string) ?? "";
      if (!verifyWebhookSignature(rawBody, signature, otaConfig.api_secret)) {
        return reply.status(401).send({ error: "Signature verification failed" });
      }

      const results: OtaReservationIntakeResult[] = [];
      for (const booking of reservations) {
        // Idempotent at the database, not in the drain loop.
        // `idx_ota_queue_ota_reservation_id` is unique on
        // (tenant, channel, the channel's reservation id), so a redelivery
        // cannot become a second queue row and there is no race for a later
        // duplicate check to lose.
        const { rows } = await query<{ id: string }>(
          `INSERT INTO ota_reservations_queue (
             tenant_id, property_id, ota_configuration_id,
             ota_reservation_id, ota_booking_reference,
             guest_name, guest_email, guest_phone,
             check_in_date, check_out_date, room_type, number_of_guests,
             total_amount, currency_code, special_requests, raw_payload,
             status
           ) VALUES (
             $1, $2, $3,
             $4, $5,
             $6, $7, $8,
             $9, $10, $11, $12,
             $13, $14, $15, $16::jsonb,
             'PENDING'
           )
           ON CONFLICT (tenant_id, ota_configuration_id, ota_reservation_id) DO NOTHING
           RETURNING id`,
          [
            tenantId,
            propertyId,
            otaConfig.id,
            booking.ota_reservation_id,
            booking.ota_booking_reference ?? null,
            booking.guest_name,
            booking.guest_email ?? null,
            booking.guest_phone ?? null,
            booking.check_in_date,
            booking.check_out_date,
            booking.room_type,
            booking.number_of_guests ?? null,
            booking.total_amount,
            booking.currency_code ?? null,
            booking.special_requests ?? null,
            JSON.stringify(booking.raw_payload ?? booking),
          ],
        );

        if (rows[0]?.id) {
          results.push({
            ota_reservation_id: booking.ota_reservation_id,
            queue_id: rows[0].id,
            duplicate: false,
          });
          continue;
        }

        // Already ingested. Answer with the row it produced the first time —
        // a channel told "duplicate" as an error keeps retrying.
        const { rows: existing } = await query<{ id: string }>(
          `SELECT id FROM ota_reservations_queue
            WHERE tenant_id = $1 AND ota_configuration_id = $2
              AND ota_reservation_id = $3`,
          [tenantId, otaConfig.id, booking.ota_reservation_id],
        );
        results.push({
          ota_reservation_id: booking.ota_reservation_id,
          queue_id: existing[0]?.id ?? "",
          duplicate: true,
        });
      }

      const duplicates = results.filter((r) => r.duplicate).length;
      logger.info(
        { otaCode, propertyId, received: results.length, duplicates },
        "Channel reservations queued",
      );

      // 202, not 200: the booking is recorded, not applied. The drain turns it
      // into a reservation.create command, which can still be refused by a
      // restriction or a stop-sell — and that refusal is a fact about the
      // booking, not about this request.
      return reply.status(202).send({
        accepted: results.length - duplicates,
        duplicates,
        results,
      });
    },
  );
};
