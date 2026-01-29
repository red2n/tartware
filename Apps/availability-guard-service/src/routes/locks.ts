import {
  buildRouteSchema,
  jsonObjectSchema,
  schemaFromZod,
} from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { z } from "zod";

import { config } from "../config.js";
import { isManualReleaseAuthorized } from "../lib/manual-release-auth.js";
import {
  buildNotificationSummary,
  classifyRecipients,
  dedupeRecipients,
  type ManualReleaseNotification,
  type NotificationSummary,
} from "../lib/manual-release-notification-helpers.js";
import type { LockAuditRecord } from "../repositories/audit-repository.js";
import { listLockAuditRecords } from "../repositories/audit-repository.js";
import {
  lockRoom,
  releaseLock,
  releaseLocksInBulk,
} from "../services/lock-service.js";
import { manualReleaseLock } from "../services/manual-release-service.js";
import {
  bulkReleaseSchema,
  lockRoomSchema,
  type ManualReleaseInput,
  manualReleaseSchema,
  releaseLockSchema,
} from "../types/lock-types.js";

const LockResponseSchema = schemaFromZod(
  z.union([
    z.object({
      status: z.literal("LOCKED"),
      lock: z.object({
        id: z.string().uuid(),
        reservation_id: z.string().uuid().nullable(),
        room_type_id: z.string().uuid(),
        room_id: z.string().uuid().nullable(),
        stay_start: z.string(),
        stay_end: z.string(),
        expires_at: z.string().nullable(),
      }),
    }),
    z.object({
      status: z.literal("CONFLICT"),
      conflict: z.object({
        id: z.string().uuid(),
        reservation_id: z.string().uuid().nullable(),
        room_type_id: z.string().uuid(),
        room_id: z.string().uuid().nullable(),
        stay_start: z.string(),
        stay_end: z.string(),
      }),
    }),
  ]),
  "LockRoomResponse",
);

const extractAdminToken = (
  headerValue: string | string[] | undefined,
): string | undefined => {
  if (!headerValue) {
    return undefined;
  }
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
};

const ensureAdminAuthorized = (
  request: { headers: Record<string, unknown> },
  reply: { code: (statusCode: number) => unknown },
): boolean => {
  const token = extractAdminToken(
    request.headers["x-guard-admin-token"] as string | string[] | undefined,
  );
  if (!isManualReleaseAuthorized(token)) {
    void reply.code(403);
    return false;
  }
  return true;
};

const isAdminTokenConfigured = (): boolean =>
  config.guard.manualRelease.tokens.length > 0;

const ensureHttpAuthorized = (
  request: { headers: Record<string, unknown> },
  reply: {
    code: (statusCode: number) => unknown;
    send: (body: unknown) => unknown;
  },
): boolean => {
  if (!isAdminTokenConfigured()) {
    return true;
  }
  const token = extractAdminToken(
    request.headers["x-guard-admin-token"] as string | string[] | undefined,
  );
  if (!token || !config.guard.manualRelease.tokens.includes(token)) {
    void reply.code(403);
    void reply.send({ error: "admin_token_required" });
    return false;
  }
  return true;
};

const manualReleaseNotificationTestSchema = z.object({
  lockId: z.string().uuid(),
  tenantId: z.string().uuid(),
  reservationId: z.string().uuid().optional().nullable(),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  stayStart: z.coerce.date(),
  stayEnd: z.coerce.date(),
  reason: z.string().min(1),
  actorId: z.string().min(1),
  actorName: z.string().min(1),
  actorEmail: z.string().email().optional(),
  recipients: z.array(z.string().min(3)).nonempty(),
});

export const locksRoutes = fastifyPlugin(
  (app: FastifyInstance, _opts, done): void => {
    app.addHook("preHandler", async (request, reply) => {
      if (!ensureHttpAuthorized(request, reply)) {
        return reply;
      }
    });

    app.post(
      "/v1/locks",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary: "Create a lock",
          body: schemaFromZod(lockRoomSchema, "LockRoomRequest"),
          response: {
            200: LockResponseSchema,
            409: LockResponseSchema,
          },
        }),
      },
      async (request, reply) => {
        const body = lockRoomSchema.parse(request.body);
        const result = await lockRoom({
          ...body,
          stayStart: new Date(body.stayStart),
          stayEnd: new Date(body.stayEnd),
        });
        if (result.status === "CONFLICT") {
          void reply.code(409);
        }
        return result;
      },
    );

    app.delete(
      "/v1/locks/:lockId",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary: "Release a lock",
          params: schemaFromZod(
            z.object({ lockId: z.string().uuid() }),
            "ReleaseLockParams",
          ),
          body: schemaFromZod(
            releaseLockSchema.omit({ lockId: true }),
            "ReleaseLockRequest",
          ),
          response: {
            200: jsonObjectSchema,
            404: jsonObjectSchema,
          },
        }),
      },
      async (request, reply) => {
        const params = z
          .object({ lockId: z.string().uuid() })
          .parse(request.params);
        const body = releaseLockSchema
          .omit({ lockId: true })
          .parse(request.body);
        const result = await releaseLock({
          ...body,
          lockId: params.lockId,
        });
        if (!result) {
          void reply.code(404);
          return { status: "not_found" };
        }
        return { status: "released", lockId: result.id };
      },
    );

    app.post(
      "/v1/locks/bulk-release",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary: "Bulk release locks",
          body: schemaFromZod(bulkReleaseSchema, "BulkReleaseRequest"),
          response: {
            200: jsonObjectSchema,
          },
        }),
      },
      async (request) => {
        const body = bulkReleaseSchema.parse(request.body);
        const released = await releaseLocksInBulk(body);
        return { status: "released", released };
      },
    );

    app.post(
      "/v1/locks/:lockId/manual-release",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary:
            "Manually release a lock with audit logging and notifications",
          params: schemaFromZod(
            z.object({ lockId: z.string().uuid() }),
            "ManualReleaseParams",
          ),
          body: schemaFromZod(manualReleaseSchema, "ManualReleaseRequest"),
          response: {
            200: jsonObjectSchema,
            403: jsonObjectSchema,
            404: jsonObjectSchema,
            503: jsonObjectSchema,
          },
        }),
      },
      async (request, reply) => {
        if (!config.guard.manualRelease.enabled) {
          void reply.code(503);
          return { error: "manual_release_disabled" };
        }

        if (!ensureAdminAuthorized(request, reply)) {
          return { error: "admin_token_required" };
        }

        const params = z
          .object({ lockId: z.string().uuid() })
          .parse(request.params);
        const body: ManualReleaseInput = manualReleaseSchema.parse(
          request.body,
        );

        const result = await manualReleaseLock(
          {
            tenantId: body.tenantId,
            reservationId: body.reservationId,
            lockId: params.lockId,
            reason: body.reason,
            actorId: body.actorId,
            actorName: body.actorName,
            actorEmail: body.actorEmail,
            correlationId: body.correlationId,
            metadata: body.metadata,
            notify: body.notify,
          },
          request.log,
        );

        if (!result) {
          void reply.code(404);
          return { status: "not_found" };
        }

        return {
          status: "released",
          lockId: result.lock.id,
          auditId: result.auditId,
        };
      },
    );

    const AuditQuerySchema = z.object({
      lockId: z.string().uuid().optional(),
      tenantId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    });

    app.post(
      "/v1/notifications/manual-release/test",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary:
            "Dry-run manual release notification classification (no webhooks called)",
          body: schemaFromZod(
            manualReleaseNotificationTestSchema,
            "ManualReleaseNotificationTest",
          ),
          response: {
            200: jsonObjectSchema,
            403: jsonObjectSchema,
          },
        }),
      },
      async (request, reply) => {
        if (!ensureAdminAuthorized(request, reply)) {
          return { error: "admin_token_required" };
        }

        const body = manualReleaseNotificationTestSchema.parse(request.body);
        const stayStartIso = body.stayStart.toISOString();
        const stayEndIso = body.stayEnd.toISOString();
        const mergedRecipients = dedupeRecipients([
          ...body.recipients,
          ...config.guard.manualRelease.notifications.recipients,
        ]);

        if (mergedRecipients.length === 0) {
          return {
            status: "skipped",
            reason: "no_recipients",
          };
        }

        const payload: ManualReleaseNotification = {
          type: "availability_guard.manual_release",
          lockId: body.lockId,
          tenantId: body.tenantId,
          reservationId: body.reservationId ?? null,
          roomTypeId: body.roomTypeId,
          roomId: body.roomId ?? null,
          stayStart: stayStartIso,
          stayEnd: stayEndIso,
          sentAt: new Date().toISOString(),
          reason: body.reason,
          actor: {
            id: body.actorId,
            name: body.actorName,
            email: body.actorEmail ?? null,
          },
          recipients: mergedRecipients,
        };

        const buckets = classifyRecipients(mergedRecipients);
        const summary: NotificationSummary = buildNotificationSummary(payload);

        return {
          status: "ok",
          dryRun: true,
          recipients: {
            provided: body.recipients,
            merged: mergedRecipients,
            email: buckets.email,
            sms: buckets.sms,
            slack: buckets.slack,
          },
          summary,
        };
      },
    );

    app.get(
      "/v1/locks/:lockId/audit",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary: "List audit records for a specific lock",
          params: schemaFromZod(
            z.object({ lockId: z.string().uuid() }),
            "LockAuditParams",
          ),
          querystring: schemaFromZod(
            z.object({
              limit: z.coerce.number().int().min(1).max(200).optional(),
            }),
            "LockAuditQuery",
          ),
          response: {
            200: jsonObjectSchema,
            403: jsonObjectSchema,
          },
        }),
      },
      async (request, reply) => {
        if (!ensureAdminAuthorized(request, reply)) {
          return { error: "admin_token_required" };
        }

        const params = z
          .object({ lockId: z.string().uuid() })
          .parse(request.params);
        const query = z
          .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
          .parse(request.query);

        const records: LockAuditRecord[] = await listLockAuditRecords({
          lockId: params.lockId,
          limit: query.limit,
        });

        return {
          lockId: params.lockId,
          audits: records,
        };
      },
    );

    app.get(
      "/v1/locks/audit",
      {
        schema: buildRouteSchema({
          tag: "Availability Guard",
          summary: "Search audit records (tenant-wide)",
          querystring: schemaFromZod(AuditQuerySchema, "AuditQuery"),
          response: {
            200: jsonObjectSchema,
            403: jsonObjectSchema,
          },
        }),
      },
      async (request, reply) => {
        if (!ensureAdminAuthorized(request, reply)) {
          return { error: "admin_token_required" };
        }

        const query = AuditQuerySchema.parse(request.query);
        const records: LockAuditRecord[] = await listLockAuditRecords({
          lockId: query.lockId,
          tenantId: query.tenantId,
          limit: query.limit,
        });

        return {
          audits: records,
        };
      },
    );
    done();
  },
);
