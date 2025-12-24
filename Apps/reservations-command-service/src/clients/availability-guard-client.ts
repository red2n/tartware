import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  type Client,
  credentials,
  loadPackageDefinition,
  type ServiceError,
} from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import { availabilityGuardConfig } from "../config.js";
import {
  observeAvailabilityGuardDuration,
  recordAvailabilityGuardRequest,
} from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";

type LockRoomRequestMessage = {
  tenantId: string;
  reservationId: string;
  roomTypeId: string;
  roomId?: string | null;
  stayStart: string;
  stayEnd: string;
  reason: string;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  ttlSeconds?: number;
  metadata?: Record<string, string>;
};

type LockRoomResponseMessage = {
  status: number;
  lock?: { id?: string } | null;
  conflict?: { id?: string } | null;
};

type ReleaseRoomRequestMessage = {
  tenantId: string;
  lockId: string;
  reservationId?: string | null;
  reason?: string;
  correlationId?: string | null;
  metadata?: Record<string, string>;
};

type ReleaseRoomResponseMessage = {
  released: boolean;
};

type BulkReleaseRequestMessage = {
  tenantId: string;
  lockIds: string[];
  reason?: string;
  correlationId?: string | null;
};

type AvailabilityGuardGrpcClient = Client & {
  lockRoom(
    request: LockRoomRequestMessage,
    callback: (
      error: ServiceError | null,
      response: LockRoomResponseMessage,
    ) => void,
  ): void;
  releaseRoom(
    request: ReleaseRoomRequestMessage,
    callback: (
      error: ServiceError | null,
      response: ReleaseRoomResponseMessage,
    ) => void,
  ): void;
  bulkRelease(
    request: BulkReleaseRequestMessage,
    callback: (
      error: ServiceError | null,
      response: { released: number },
    ) => void,
  ): void;
};

type GrpcMethodMap = {
  lockRoom: [LockRoomRequestMessage, LockRoomResponseMessage];
  releaseRoom: [ReleaseRoomRequestMessage, ReleaseRoomResponseMessage];
  bulkRelease: [BulkReleaseRequestMessage, { released: number }];
};

type LockReservationInput = {
  tenantId: string;
  reservationId: string;
  roomTypeId: string;
  roomId?: string | null;
  stayStart: Date;
  stayEnd: Date;
  reason: string;
  correlationId?: string;
  ttlSeconds?: number;
};

export type AvailabilityGuardMetadata = {
  status: "SKIPPED" | "LOCKED" | "CONFLICT" | "ERROR";
  lockId?: string;
  message?: string;
};

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
    };
  };
};

let client: AvailabilityGuardGrpcClient | null = null;

const getClient = (): AvailabilityGuardGrpcClient | null => {
  if (!availabilityGuardConfig.enabled) {
    return null;
  }
  if (!client) {
    const ctor = descriptor.availabilityguard.v1.AvailabilityGuard;
    client = new ctor(
      availabilityGuardConfig.address,
      credentials.createInsecure(),
    );
  }
  return client;
};

const callGrpc = <TMethod extends keyof GrpcMethodMap>(
  method: TMethod,
  request: GrpcMethodMap[TMethod][0],
): Promise<GrpcMethodMap[TMethod][1]> => {
  const grpcClient = getClient();
  if (!grpcClient) {
    return Promise.reject(new Error("Availability Guard client disabled"));
  }

  return new Promise<GrpcMethodMap[TMethod][1]>((resolve, reject) => {
    const handler = grpcClient[method].bind(grpcClient) as (
      grpcRequest: GrpcMethodMap[TMethod][0],
      callback: (
        error: ServiceError | null,
        response: GrpcMethodMap[TMethod][1],
      ) => void,
    ) => void;

    handler(request, (error: ServiceError | null, response) => {
      if (error) {
        reject(error);
        return;
      }
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

const runWithRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
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

const secondsSince = (startedAt: number): number =>
  (performance.now() - startedAt) / 1000;

export const lockReservationHold = async (
  input: LockReservationInput,
): Promise<AvailabilityGuardMetadata> => {
  if (!availabilityGuardConfig.enabled) {
    return { status: "SKIPPED" };
  }

  const method = "lockRoom";
  const startedAt = performance.now();
  try {
    const response = await runWithRetry(
      () =>
        callGrpc("lockRoom", {
          tenantId: input.tenantId,
          reservationId: input.reservationId,
          roomTypeId: input.roomTypeId,
          roomId: input.roomId ?? undefined,
          stayStart: input.stayStart.toISOString(),
          stayEnd: input.stayEnd.toISOString(),
          reason: input.reason,
          correlationId: input.correlationId ?? null,
          idempotencyKey: input.reservationId,
          ttlSeconds: input.ttlSeconds,
        }),
      {
        retries: 2,
        onFailedAttempt: (error, attempt) => {
          reservationsLogger.warn(
            { err: error, method, attempt },
            "Availability Guard lockRoom attempt failed",
          );
        },
      },
    );

    const status =
      response.status === 1
        ? "LOCKED"
        : response.status === 2
          ? "CONFLICT"
          : "ERROR";

    recordAvailabilityGuardRequest(method, status);
    observeAvailabilityGuardDuration(method, secondsSince(startedAt));

    if (status === "LOCKED") {
      return {
        status,
        lockId: response.lock?.id ?? input.reservationId,
      };
    }

    const message = "Availability Guard reported a conflicting lock";
    if (status === "CONFLICT") {
      if (
        availabilityGuardConfig.shadowMode ||
        availabilityGuardConfig.failOpen
      ) {
        reservationsLogger.warn(
          {
            status,
            reservationId: input.reservationId,
            tenantId: input.tenantId,
          },
          `${message} (shadow mode: ${availabilityGuardConfig.shadowMode}, failOpen: ${availabilityGuardConfig.failOpen})`,
        );
        return {
          status,
          lockId: response.conflict?.id,
          message,
        };
      }
      throw new Error(message);
    }

    throw new Error("Availability Guard lockRoom returned unknown status");
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

export const releaseReservationHold = async (
  input: ReleaseReservationInput,
): Promise<void> => {
  if (!availabilityGuardConfig.enabled) {
    return;
  }

  const method = "releaseRoom";
  const startedAt = performance.now();
  try {
    await callGrpc("releaseRoom", {
      tenantId: input.tenantId,
      lockId: input.lockId,
      reservationId: input.reservationId ?? null,
      reason: input.reason,
      correlationId: input.correlationId ?? null,
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

export const shutdownAvailabilityGuardClient = async (): Promise<void> => {
  if (client) {
    client.close();
    client = null;
  }
};
