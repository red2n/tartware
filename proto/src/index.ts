/**
 * @tartware/proto-types — TypeScript types generated from proto definitions.
 *
 * Re-exports all message and enum types from the availability-guard proto.
 * Run `pnpm --filter @tartware/proto-types generate` to regenerate after
 * proto changes.
 */
export type {
  InventoryLock as GrpcInventoryLock,
  LockRoomRequest,
  LockRoomResponse,
  ReleaseRoomRequest,
  ReleaseRoomResponse,
  BulkReleaseRequest,
  BulkReleaseResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from "./gen/availability-guard.js";

export {
  LockRoomResponse_Status,
  HealthCheckResponse_ServingStatus,
} from "./gen/availability-guard.js";
