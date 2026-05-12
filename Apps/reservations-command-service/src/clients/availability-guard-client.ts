import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  type Client,
  credentials,
  loadPackageDefinition,
  Metadata,
  type ServiceError,
} from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { createReferenceCache } from "@tartware/fastify-server/reference-cache";
import type {
  BulkReleaseRequest,
  BulkReleaseResponse,
  LockRoomRequest,
  LockRoomResponse,
  ReleaseRoomRequest,
  ReleaseRoomResponse,
} from "@tartware/proto-types";
import type { AvailabilityGuardMetadata } from "@tartware/schemas";

import { availabilityGuardConfig } from "../config.js";
import {
  observeAvailabilityGuardDuration,
  recordAvailabilityGuardRequest,
} from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";

type AvailabilityGuardGrpcClient = Client & {
  lockRoom(
    request: LockRoomRequest,
    callback: (error: ServiceError | null, response: LockRoomResponse) => void,
  ): void;
  releaseRoom(
    request: ReleaseRoomRequest,
    callback: (error: ServiceError | null, response: ReleaseRoomResponse) => void,
  ): void;
  bulkRelease(
    request: BulkReleaseRequest,
    callback: (error: ServiceError | null, response: BulkReleaseResponse) => void,
  ): void;
};

type GrpcMethodMap = {
  lockRoom: [LockRoomRequest, LockRoomResponse];
  releaseRoom: [ReleaseRoomRequest, ReleaseRoomResponse];
  bulkRelease: [BulkReleaseRequest, BulkReleaseResponse];
};

type LockReservationInput = {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  roomTypeId: string;
  roomId?: string | null;
  stayStart: Date;
  stayEnd: Date;
  reason: string;
  correlationId?: string;
  ttlSeconds?: number;
};

export type { AvailabilityGuardMetadata };

type ReleaseReservationInput = {
  tenantId: string;
  lockId: string;
  reservationId?: string;
  reason: string;
  correlationId?: string;
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

type HealthCheckClient = Client & {
  check(
    request: { service: string },
    callback: (error: ServiceError | null, response: { status: string }) => void,
  ): void;
};

const packageDefinition = protoLoader.loadSync(PROTO_PATH, loaderOptions);
const descriptor = loadPackageDefinition(packageDefinition) as unknown as {
  availabilityguard: {
    v1: {
      AvailabilityGuard: {
        new (
          address: string,
          connectionCredentials: ReturnType<typeof credentials.createInsecure>,
        ): AvailabilityGuardGrpcClient;
        service: unknown;
      };
      Health: {
        new (
          address: string,
          connectionCredentials: ReturnType<typeof credentials.createInsecure>,
        ): HealthCheckClient;
        service: unknown;
      };
    };
  };
};

/**
 * Connection pool configuration to maximize gRPC/HTTP2 throughput.
 * Single connections can hit window limits or I/O thread bottlenecks at 20K ops/sec.
 */
const POOL_SIZE = 4;
const clientPool: AvailabilityGuardGrpcClient[] = [];
let nextPoolIndex = 0;

/**
 * Short-term L1 cache for successful locks to prevent redundant gRPC calls
 * during rapid retries or duplicate UI submissions.
 */
const LOCK_CACHE = createReferenceCache<string, AvailabilityGuardMetadata>({
  name: "availability-lock-l1",
  maxSize: 10000,
  ttlMs: 5000, // 5 second "hot" cache
  loader: async () => null,
});

/**
 * Simple circuit breaker state to prevent "retry storms" when the guard is down.
 */
const BREAKER = {
  tripped: false,
  trippedAt: 0,
  failureCount: 0,
  THRESHOLD: 5,
  RESET_TIMEOUT_MS: 30000,
};

const getClient = (): AvailabilityGuardGrpcClient | null => {
  if (!availabilityGuardConfig.enabled) {
    return null;
  }

  // Check if breaker should reset
  if (BREAKER.tripped && Date.now() - BREAKER.trippedAt > BREAKER.RESET_TIMEOUT_MS) {
    reservationsLogger.info("Availability Guard circuit breaker resetting to closed");
    BREAKER.tripped = false;
    BREAKER.failureCount = 0;
  }

  if (BREAKER.tripped) {
    return null; // Fast-fail (fail-open) while breaker is open
  }

  if (clientPool.length < POOL_SIZE) {
    const ctor = descriptor.availabilityguard.v1.AvailabilityGuard;
    for (let i = clientPool.length; i < POOL_SIZE; i++) {
      clientPool.push(new ctor(availabilityGuardConfig.address, credentials.createInsecure()));
    }
  }

  const selected = clientPool[nextPoolIndex];
  nextPoolIndex = (nextPoolIndex + 1) % POOL_SIZE;
  return selected;
};

const callGrpc = <TMethod extends keyof GrpcMethodMap>(
  method: TMethod,
  request: GrpcMethodMap[TMethod][0],
): Promise<GrpcMethodMap[TMethod][1]> => {
  const grpcClient = getClient();
  if (!grpcClient) {
    return Promise.reject(
      new Error(
        BREAKER.tripped
          ? "Availability Guard circuit breaker is OPEN"
          : "Availability Guard client disabled",
      ),
    );
  }

  const meta = new Metadata();
  if (availabilityGuardConfig.grpcAuthToken) {
    meta.set("authorization", `Bearer ${availabilityGuardConfig.grpcAuthToken}`);
  }

  const deadline = Date.now() + availabilityGuardConfig.timeoutMs;

  return new Promise<GrpcMethodMap[TMethod][1]>((resolve, reject) => {
    const handler = grpcClient[method].bind(grpcClient) as unknown as (
      grpcRequest: GrpcMethodMap[TMethod][0],
      grpcMeta: Metadata,
      grpcOptions: { deadline: number },
      callback: (error: ServiceError | null, response: GrpcMethodMap[TMethod][1]) => void,
    ) => void;

    handler(request, meta, { deadline }, (error: ServiceError | null, response) => {
      if (error) {
        // Track failures to trip breaker
        BREAKER.failureCount++;
        if (BREAKER.failureCount >= BREAKER.THRESHOLD && !BREAKER.tripped) {
          BREAKER.tripped = true;
          BREAKER.trippedAt = Date.now();
          reservationsLogger.error(
            { failureCount: BREAKER.failureCount, method },
            "Availability Guard circuit breaker TRIPPED — entering fail-open mode",
          );
        }
        reject(error);
        return;
      }

      // Success resets failure count
      BREAKER.failureCount = 0;
      resolve(response);
    });
  });
};

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  onFailedAttempt?: (error: unknown, attempt: number) => void;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const runWithRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const { retries = 0, baseDelayMs = 200, onFailedAttempt } = options;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      onFailedAttempt?.(error, attempt + 1);
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
};

const secondsSince = (startedAt: number): number => (performance.now() - startedAt) / 1000;

const isGuardRequired = (): boolean => {
  const env = (process.env.NODE_ENV ?? "development").toLowerCase();
  return env === "production" || env === "staging";
};

export const lockReservationHold = async (
  input: LockReservationInput,
): Promise<AvailabilityGuardMetadata> => {
  if (!availabilityGuardConfig.enabled) {
    if (isGuardRequired()) {
      throw new Error("Availability Guard is disabled in a non-dev environment");
    }
    return { status: "SKIPPED" };
  }

  const method = "lockRoom";
  const startedAt = performance.now(); // L1 Cache Check: Key by full lock scope (room + dates, not just reservationId)
  const cacheKey = `${input.reservationId}:${input.roomId ?? "any"}:${input.stayStart.toISOString()}:${input.stayEnd.toISOString()}`;
  const cached = await LOCK_CACHE.get(cacheKey);
  if (cached) {
    recordAvailabilityGuardRequest(method, "L1_CACHE_HIT");
    return cached;
  }

  try {
    const response = await runWithRetry(
      () =>
        callGrpc("lockRoom", {
          tenantId: input.tenantId,
          propertyId: input.propertyId,
          reservationId: input.reservationId,
          roomTypeId: input.roomTypeId,
          roomId: input.roomId ?? "",
          stayStart: input.stayStart.toISOString(),
          stayEnd: input.stayEnd.toISOString(),
          reason: input.reason,
          correlationId: input.correlationId ?? "",
          idempotencyKey: input.reservationId,
          ttlSeconds: input.ttlSeconds ?? 0,
          metadata: {},
        }),
      {
        retries: 2,
        onFailedAttempt: (error, attempt) => {
          reservationsLogger.warn(
            { err: error, attempt, reservationId: input.reservationId },
            "Availability Guard lockRoom failed; retrying",
          );
        },
      },
    );

    let status: AvailabilityGuardMetadata["status"] = "ERROR";
    if (response.status === "STATUS_LOCKED") {
      status = "LOCKED";
    } else if (response.status === "STATUS_CONFLICT") {
      status = "CONFLICT";
    }

    // Cache successful locks only
    if (status === "LOCKED") {
      const result: AvailabilityGuardMetadata = {
        status,
        lockId: response.lock?.id ?? input.reservationId,
      };
      // Populate L1 cache for 5 seconds with full scope key
      LOCK_CACHE.primeMany([[cacheKey, result]]);
      return result;
    }

    const result: AvailabilityGuardMetadata = {
      status,
      message: "Availability Guard reported a conflict or error",
    };
    return result;
  } catch (error) {
    recordAvailabilityGuardRequest(method, "ERROR");
    observeAvailabilityGuardDuration(method, secondsSince(startedAt));
    if (availabilityGuardConfig.failOpen) {
      reservationsLogger.error(
        { err: error, method },
        "Availability Guard lockRoom failed; continuing due to fail-open",
      );
      return { status: "ERROR", message: (error as Error).message };
    }
    throw error;
  }
};

export const releaseReservationHold = async (input: ReleaseReservationInput): Promise<void> => {
  if (!availabilityGuardConfig.enabled) {
    if (isGuardRequired()) {
      reservationsLogger.warn(
        { reservationId: input.reservationId },
        "Availability Guard disabled; skipping release in non-dev environment",
      );
    }
    return;
  }

  const method = "releaseRoom";
  const startedAt = performance.now();
  try {
    await callGrpc("releaseRoom", {
      tenantId: input.tenantId,
      lockId: input.lockId,
      reservationId: input.reservationId ?? "",
      reason: input.reason,
      correlationId: input.correlationId ?? "",
      metadata: {},
    });
    recordAvailabilityGuardRequest(method, "SUCCESS");
  } catch (error) {
    recordAvailabilityGuardRequest(method, "ERROR");
    if (availabilityGuardConfig.failOpen) {
      reservationsLogger.error(
        { err: error, method },
        "Availability Guard releaseRoom failed; continuing due to fail-open",
      );
    } else {
      throw error;
    }
  } finally {
    observeAvailabilityGuardDuration(method, secondsSince(startedAt));
  }
};

let healthClient: HealthCheckClient | null = null;

/**
 * Probes the Availability Guard gRPC Health service.
 * Returns `true` if SERVING, `false` otherwise.
 */
export const checkGuardHealth = async (): Promise<boolean> => {
  if (!availabilityGuardConfig.enabled) {
    return false;
  }

  if (!healthClient) {
    const ctor = descriptor.availabilityguard.v1.Health;
    healthClient = new ctor(availabilityGuardConfig.address, credentials.createInsecure());
  }

  return new Promise<boolean>((resolve) => {
    const deadline = Date.now() + 3000;
    const handler = healthClient?.check.bind(healthClient) as unknown as (
      req: { service: string },
      opts: { deadline: number },
      cb: (error: ServiceError | null, response: { status: string }) => void,
    ) => void;

    handler({ service: "" }, { deadline }, (error, response) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(response.status === "SERVING");
    });
  });
};

export const shutdownAvailabilityGuardClient = async (): Promise<void> => {
  for (const c of clientPool) {
    c.close();
  }
  clientPool.length = 0;

  if (healthClient) {
    healthClient.close();
    healthClient = null;
  }
};
