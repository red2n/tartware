/**
 * @tartware/proto-types — TypeScript types generated from proto definitions.
 *
 * Re-exports all message and enum types from the availability-guard proto.
 * Run `pnpm --filter @tartware/proto-types generate` to regenerate after
 * proto changes.
 */
export type {
  BulkReleaseRequest,
  BulkReleaseResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  InventoryLock as GrpcInventoryLock,
  LockRoomRequest,
  LockRoomResponse,
  ReleaseRoomRequest,
  ReleaseRoomResponse,
} from "./gen/availability-guard.js";

export {
  HealthCheckResponse_ServingStatus,
  LockRoomResponse_Status,
} from "./gen/availability-guard.js";
