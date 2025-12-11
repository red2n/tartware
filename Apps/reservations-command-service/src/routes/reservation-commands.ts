import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  ReservationCancelCommandSchema,
  ReservationCreateCommandSchema,
  ReservationUpdateCommandSchema,
} from "../schemas/reservation-command.js";
import {
  cancelReservation,
  createReservation,
  updateReservation,
} from "../services/reservation-command-service.js";
import {
  createPendingIdempotencyRecord,
  findIdempotencyRecord,
  markIdempotencyRecordAcked,
  markIdempotencyRecordFailed,
} from "../services/idempotency-service.js";

const TenantParamSchema = z.object({
  tenantId: z.string().uuid(),
});

const ReservationParamSchema = TenantParamSchema.extend({
  reservationId: z.string().uuid(),
});

export const registerReservationCommandRoutes = (
  app: FastifyInstance,
): void => {
  app.post("/v1/tenants/:tenantId/reservations", async (request, reply) => {
    const { tenantId } = TenantParamSchema.parse(request.params);
    const payload = ReservationCreateCommandSchema.parse(request.body);

    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ?? undefined;
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.status(400).send({
        message: "Missing x-idempotency-key header",
      });
    }

    const replayed = await sendIfIdempotentExists(reply, tenantId, idempotencyKey);
    if (replayed) {
      return;
    }

    const idempotencyRecord = await createPendingIdempotencyRecord({
      tenantId,
      key: idempotencyKey,
      commandType: "reservation.create",
      payload,
      correlationId,
    });

    try {
      const result = await createReservation(tenantId, payload, {
        correlationId,
      });
      const responsePayload = {
        status: result.status,
        eventId: result.eventId,
        correlationId: result.correlationId,
      };
      await markIdempotencyRecordAcked(
        idempotencyRecord.id,
        result.eventId,
        responsePayload,
      );
      reply.code(202).send(responsePayload);
    } catch (error) {
      await markIdempotencyRecordFailed(idempotencyRecord, error);
      throw error;
    }
  });

  app.patch(
    "/v1/tenants/:tenantId/reservations/:reservationId",
    async (request, reply) => {
      const { tenantId, reservationId } = ReservationParamSchema.parse(
        request.params,
      );
      const payload = ReservationUpdateCommandSchema.parse(request.body);

      const correlationId =
        (request.headers["x-correlation-id"] as string | undefined) ??
        undefined;
      const idempotencyKey = getIdempotencyKey(request);
      if (!idempotencyKey) {
        return reply.status(400).send({
          message: "Missing x-idempotency-key header",
        });
      }

      const replayed = await sendIfIdempotentExists(reply, tenantId, idempotencyKey);
      if (replayed) {
        return;
      }

      const idempotencyRecord = await createPendingIdempotencyRecord({
        tenantId,
        key: idempotencyKey,
        commandType: "reservation.update",
        payload,
        correlationId,
        resourceId: reservationId,
      });

      try {
        const result = await updateReservation(
          tenantId,
          reservationId,
          payload,
          {
            correlationId,
          },
        );
        const responsePayload = {
          status: result.status,
          eventId: result.eventId,
          correlationId: result.correlationId,
        };
        await markIdempotencyRecordAcked(
          idempotencyRecord.id,
          result.eventId,
          responsePayload,
        );
        reply.code(202).send(responsePayload);
      } catch (error) {
        await markIdempotencyRecordFailed(idempotencyRecord, error);
        throw error;
      }
    },
  );

  app.post(
    "/v1/tenants/:tenantId/reservations/:reservationId/cancel",
    async (request, reply) => {
      const { tenantId, reservationId } = ReservationParamSchema.parse(
        request.params,
      );
      const payload = ReservationCancelCommandSchema.parse(request.body ?? {});

      const correlationId =
        (request.headers["x-correlation-id"] as string | undefined) ??
        undefined;
      const idempotencyKey = getIdempotencyKey(request);
      if (!idempotencyKey) {
        return reply.status(400).send({
          message: "Missing x-idempotency-key header",
        });
      }

      const replayed = await sendIfIdempotentExists(reply, tenantId, idempotencyKey);
      if (replayed) {
        return;
      }

      const idempotencyRecord = await createPendingIdempotencyRecord({
        tenantId,
        key: idempotencyKey,
        commandType: "reservation.cancel",
        payload,
        correlationId,
        resourceId: reservationId,
      });

      try {
        const result = await cancelReservation(
          tenantId,
          reservationId,
          payload,
          {
            correlationId,
          },
        );
        const responsePayload = {
          status: result.status,
          eventId: result.eventId,
          correlationId: result.correlationId,
        };
        await markIdempotencyRecordAcked(
          idempotencyRecord.id,
          result.eventId,
          responsePayload,
        );
        reply.code(202).send(responsePayload);
      } catch (error) {
        await markIdempotencyRecordFailed(idempotencyRecord, error);
        throw error;
      }
    },
  );
};

const getIdempotencyKey = (request: {
  headers: Record<string, unknown>;
}): string | null => {
  const raw =
    (request.headers["x-idempotency-key"] ??
      request.headers["idempotency-key"]) ?? null;
  if (!raw) {
    return null;
  }
  if (Array.isArray(raw)) {
    return typeof raw[0] === "string" && raw[0].trim().length > 0
      ? raw[0].trim()
      : null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sendIfIdempotentExists = async (
  reply: FastifyReply,
  tenantId: string,
  key: string,
): Promise<boolean> => {
  const record = await findIdempotencyRecord(tenantId, key);
  if (!record) {
    return false;
  }

  if (record.status === "ACKED" && record.response) {
    reply.status(200).send({
      ...record.response,
      replayed: true,
    });
    return true;
  }

  if (record.status === "PENDING") {
    reply.status(202).send({
      status: "pending",
      eventId: record.event_id,
      correlationId: record.correlation_id,
      replayed: true,
    });
    return true;
  }

  if (record.status === "FAILED") {
    const terminal = record.attempt_count >= record.max_attempts;
    if (terminal) {
      reply.status(409).send({
        status: "exhausted",
        attempts: record.attempt_count,
        maxAttempts: record.max_attempts,
        lastError: record.last_error,
        correlationId: record.correlation_id,
        replayed: true,
      });
      return true;
    }

    reply.status(202).send({
      status: "retrying",
      attempts: record.attempt_count,
      maxAttempts: record.max_attempts,
      nextRetryAt: record.next_retry_at,
      correlationId: record.correlation_id,
      replayed: true,
    });
    return true;
  }

  return false;
};
