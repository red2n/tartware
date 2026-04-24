import { fileURLToPath } from "node:url";

import {
  status as GrpcStatus,
  type handleUnaryCall,
  loadPackageDefinition,
  Server,
  ServerCredentials,
  type ServerUnaryCall,
  type ServiceDefinition,
  type sendUnaryData,
} from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import type {
  BulkReleaseRequest,
  BulkReleaseResponse,
  GrpcInventoryLock,
  HealthCheckRequest,
  HealthCheckResponse,
  LockRoomRequest,
  LockRoomResponse,
  ReleaseRoomRequest,
  ReleaseRoomResponse,
} from "@tartware/proto-types";
import { HealthCheckResponse_ServingStatus, LockRoomResponse_Status } from "@tartware/proto-types";
import type { FastifyBaseLogger } from "fastify";
import { ZodError } from "zod";

import { config } from "../config.js";
import { checkDatabaseHealth } from "../lib/health-checks.js";
import type { InventoryLock } from "../repositories/lock-repository.js";
import { lockRoom, releaseLock, releaseLocksInBulk } from "../services/lock-service.js";
import { bulkReleaseSchema, lockRoomSchema, releaseLockSchema } from "../types/lock-types.js";

type AvailabilityGuardHandlers = {
  lockRoom: ReturnType<typeof buildLockRoomHandler>;
  releaseRoom: ReturnType<typeof buildReleaseRoomHandler>;
  bulkRelease: ReturnType<typeof buildBulkReleaseHandler>;
};

const PROTO_PATH = fileURLToPath(
  new URL("../../../../proto/availability-guard.proto", import.meta.url),
);

const loaderOptions: protoLoader.Options = {
  defaults: true,
  longs: String,
  enums: String,
  keepCase: false,
  oneofs: true,
};

const packageDefinition = protoLoader.loadSync(PROTO_PATH, loaderOptions);
const grpcDescriptor = loadPackageDefinition(packageDefinition) as unknown as {
  availabilityguard: {
    v1: {
      AvailabilityGuard: {
        service: Record<string, unknown>;
      };
      Health: {
        service: Record<string, unknown>;
      };
    };
  };
};

const mapInventoryLock = (lock: InventoryLock | null): GrpcInventoryLock | undefined => {
  if (!lock) {
    return undefined;
  }
  return {
    id: lock.id,
    tenantId: lock.tenant_id,
    reservationId: lock.reservation_id ?? "",
    roomTypeId: lock.room_type_id,
    roomId: lock.room_id ?? "",
    stayStart: lock.stay_start.toISOString(),
    stayEnd: lock.stay_end.toISOString(),
    expiresAt: lock.expires_at ? lock.expires_at.toISOString() : "",
    status: lock.status,
    createdAt: lock.created_at.toISOString(),
    updatedAt: lock.updated_at.toISOString(),
  };
};

/**
 * Map a caught error to the most specific gRPC status code.
 */
const grpcStatusFromError = (error: unknown): GrpcStatus => {
  if (error instanceof ZodError) return GrpcStatus.INVALID_ARGUMENT;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("not found") || msg.includes("not_found")) return GrpcStatus.NOT_FOUND;
    if (msg.includes("already exists") || msg.includes("duplicate"))
      return GrpcStatus.ALREADY_EXISTS;
  }
  return GrpcStatus.INTERNAL;
};

const grpcErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return error instanceof Error ? error.message : fallback;
};

const mapLockResponseStatus = (status: "LOCKED" | "CONFLICT"): LockRoomResponse_Status => {
  if (status === "LOCKED") {
    return LockRoomResponse_Status.STATUS_LOCKED;
  }
  if (status === "CONFLICT") {
    return LockRoomResponse_Status.STATUS_CONFLICT;
  }
  return LockRoomResponse_Status.STATUS_UNKNOWN;
};

const buildLockRoomHandler =
  (logger: FastifyBaseLogger): handleUnaryCall<LockRoomRequest, LockRoomResponse> =>
  async (call, callback) => {
    try {
      const parsedInput = lockRoomSchema.parse({
        tenantId: call.request.tenantId,
        reservationId: call.request.reservationId,
        roomTypeId: call.request.roomTypeId,
        roomId: call.request.roomId ?? null,
        stayStart: call.request.stayStart,
        stayEnd: call.request.stayEnd,
        reason: call.request.reason ?? "RESERVATION_CREATE",
        correlationId: call.request.correlationId,
        idempotencyKey: call.request.idempotencyKey,
        ttlSeconds: call.request.ttlSeconds,
        metadata: call.request.metadata,
      });

      const result = await lockRoom({
        ...parsedInput,
        metadata: {
          ...(parsedInput.metadata ?? {}),
          source: "grpc",
        },
      });

      callback(null, {
        status: mapLockResponseStatus(result.status),
        lock: mapInventoryLock(result.status === "LOCKED" ? result.lock : null),
        conflict: mapInventoryLock(result.status === "CONFLICT" ? result.conflict : null),
      });
    } catch (error) {
      const code = grpcStatusFromError(error);
      logger.error({ err: error, grpcCode: code }, "lockRoom gRPC call failed");
      callback({ code, message: grpcErrorMessage(error, "lockRoom error") }, null);
    }
  };

const buildReleaseRoomHandler =
  (logger: FastifyBaseLogger): handleUnaryCall<ReleaseRoomRequest, ReleaseRoomResponse> =>
  async (call, callback) => {
    try {
      const parsedInput = releaseLockSchema.parse({
        tenantId: call.request.tenantId,
        lockId: call.request.lockId,
        reservationId: call.request.reservationId,
        reason: call.request.reason ?? "RELEASE_REQUEST",
        correlationId: call.request.correlationId,
        metadata: call.request.metadata,
      });

      const releasedLock = await releaseLock(parsedInput);
      callback(null, {
        released: Boolean(releasedLock),
        lock: mapInventoryLock(releasedLock),
      });
    } catch (error) {
      const code = grpcStatusFromError(error);
      logger.error({ err: error, grpcCode: code }, "releaseRoom gRPC call failed");
      callback({ code, message: grpcErrorMessage(error, "releaseRoom error") }, null);
    }
  };

const buildBulkReleaseHandler =
  (logger: FastifyBaseLogger): handleUnaryCall<BulkReleaseRequest, BulkReleaseResponse> =>
  async (call, callback) => {
    try {
      const parsedInput = bulkReleaseSchema.parse({
        tenantId: call.request.tenantId,
        lockIds: call.request.lockIds,
        reason: call.request.reason ?? "BULK_RELEASE",
        correlationId: call.request.correlationId,
      });
      const released = await releaseLocksInBulk(parsedInput);
      callback(null, { released });
    } catch (error) {
      const code = grpcStatusFromError(error);
      logger.error({ err: error, grpcCode: code }, "bulkRelease gRPC call failed");
      callback({ code, message: grpcErrorMessage(error, "bulkRelease error") }, null);
    }
  };

type HealthHandlers = {
  check: ReturnType<typeof buildHealthCheckHandler>;
};

const buildHealthCheckHandler =
  (logger: FastifyBaseLogger): handleUnaryCall<HealthCheckRequest, HealthCheckResponse> =>
  async (_call, callback) => {
    try {
      await checkDatabaseHealth();
      callback(null, { status: HealthCheckResponse_ServingStatus.SERVING });
    } catch (error) {
      logger.warn({ err: error }, "Health check failed: database unreachable");
      callback(null, { status: HealthCheckResponse_ServingStatus.NOT_SERVING });
    }
  };

export const startGrpcServer = async (logger: FastifyBaseLogger) => {
  logger.info("Initializing Availability Guard gRPC server");

  const authToken = config.grpc.authToken;

  /**
   * Wraps a unary gRPC handler with Bearer token authentication.
   * When GRPC_AUTH_TOKEN is configured, every inbound call must include
   * an `authorization` metadata key with value `Bearer <token>`.
   * In dev mode (no token set), auth is skipped.
   */
  const withGrpcAuth = <TReq, TRes>(
    handler: handleUnaryCall<TReq, TRes>,
  ): handleUnaryCall<TReq, TRes> => {
    if (!authToken) {
      return handler;
    }
    return (call: ServerUnaryCall<TReq, TRes>, callback: sendUnaryData<TRes>) => {
      const meta = call.metadata.get("authorization");
      const headerValue = meta.length > 0 ? String(meta[0]) : "";
      const token = headerValue.startsWith("Bearer ") ? headerValue.slice(7) : headerValue;

      if (token !== authToken) {
        logger.warn({ peer: call.getPeer() }, "gRPC call rejected: invalid or missing auth token");
        callback(
          { code: GrpcStatus.UNAUTHENTICATED, message: "GRPC_AUTH_REQUIRED" },
          null as unknown as TRes,
        );
        return;
      }
      handler(call, callback);
    };
  };

  const server = new Server();
  const availabilityGuardService = grpcDescriptor.availabilityguard.v1.AvailabilityGuard
    .service as ServiceDefinition<AvailabilityGuardHandlers>;

  server.addService(availabilityGuardService, {
    lockRoom: withGrpcAuth(buildLockRoomHandler(logger)),
    releaseRoom: withGrpcAuth(buildReleaseRoomHandler(logger)),
    bulkRelease: withGrpcAuth(buildBulkReleaseHandler(logger)),
  });

  const healthService = grpcDescriptor.availabilityguard.v1.Health
    .service as ServiceDefinition<HealthHandlers>;
  server.addService(healthService, {
    check: buildHealthCheckHandler(logger),
  });

  const address = `${config.grpc.host}:${config.grpc.port}`;
  logger.info({ address }, "Binding Availability Guard gRPC server");

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(address, ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        logger.error({ err: error }, "Failed to bind Availability Guard gRPC server");
        reject(error);
        return;
      }
      logger.info({ port }, "Availability Guard gRPC server bound");
      server.start();
      resolve();
    });
  });

  return {
    server,
    async stop() {
      await new Promise<void>((resolve) => {
        server.tryShutdown(() => resolve());
      });
    },
  };
};
