import { fileURLToPath } from "node:url";

import {
  type ServerUnaryCall,
  type sendUnaryData,
  status as GrpcStatus,
  type handleUnaryCall,
  loadPackageDefinition,
  Server,
  ServerCredentials,
  type ServiceDefinition,
} from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import type { FastifyBaseLogger } from "fastify";

import { config } from "../config.js";
import type { InventoryLock } from "../repositories/lock-repository.js";
import { lockRoom, releaseLock, releaseLocksInBulk } from "../services/lock-service.js";
import { bulkReleaseSchema, lockRoomSchema, releaseLockSchema } from "../types/lock-types.js";

type GrpcInventoryLock = {
  id?: string;
  tenantId?: string;
  reservationId?: string;
  roomTypeId?: string;
  roomId?: string;
  stayStart?: string;
  stayEnd?: string;
  expiresAt?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LockRoomRequestMessage = {
  tenantId: string;
  reservationId: string;
  roomTypeId: string;
  roomId?: string | null;
  stayStart: string;
  stayEnd: string;
  reason?: string;
  correlationId?: string;
  idempotencyKey?: string;
  ttlSeconds?: number;
  metadata?: Record<string, string>;
};

type LockRoomResponseMessage = {
  status: number;
  lock?: GrpcInventoryLock | null;
  conflict?: GrpcInventoryLock | null;
};

type ReleaseRoomRequestMessage = {
  tenantId: string;
  lockId: string;
  reservationId?: string;
  reason?: string;
  correlationId?: string;
  metadata?: Record<string, string>;
};

type ReleaseRoomResponseMessage = {
  released: boolean;
  lock?: GrpcInventoryLock | null;
};

type BulkReleaseRequestMessage = {
  tenantId: string;
  lockIds: string[];
  reason?: string;
  correlationId?: string;
};

type BulkReleaseResponseMessage = {
  released: number;
};

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

const mapLockResponseStatus = (status: "LOCKED" | "CONFLICT"): number => {
  if (status === "LOCKED") {
    return 1;
  }
  if (status === "CONFLICT") {
    return 2;
  }
  return 0;
};

const buildLockRoomHandler =
  (logger: FastifyBaseLogger): handleUnaryCall<LockRoomRequestMessage, LockRoomResponseMessage> =>
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
      logger.error({ err: error }, "lockRoom gRPC call failed");
      callback(
        {
          code: GrpcStatus.INTERNAL,
          message: error instanceof Error ? error.message : "lockRoom error",
        },
        null,
      );
    }
  };

const buildReleaseRoomHandler =
  (
    logger: FastifyBaseLogger,
  ): handleUnaryCall<ReleaseRoomRequestMessage, ReleaseRoomResponseMessage> =>
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
      logger.error({ err: error }, "releaseRoom gRPC call failed");
      callback(
        {
          code: GrpcStatus.INTERNAL,
          message: error instanceof Error ? error.message : "releaseRoom error",
        },
        null,
      );
    }
  };

const buildBulkReleaseHandler =
  (
    logger: FastifyBaseLogger,
  ): handleUnaryCall<BulkReleaseRequestMessage, BulkReleaseResponseMessage> =>
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
      logger.error({ err: error }, "bulkRelease gRPC call failed");
      callback(
        {
          code: GrpcStatus.INTERNAL,
          message: error instanceof Error ? error.message : "bulkRelease error",
        },
        null,
      );
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
      const token = headerValue.startsWith("Bearer ")
        ? headerValue.slice(7)
        : headerValue;

      if (token !== authToken) {
        logger.warn(
          { peer: call.getPeer() },
          "gRPC call rejected: invalid or missing auth token",
        );
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
