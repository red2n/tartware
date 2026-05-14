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
  CheckRequest,
  CheckResponse,
} from "./gen/availabilityguard/v1/availability_guard.js";

export {
  LockRoomResponse_Status,
  CheckResponse_ServingStatus,
} from "./gen/availabilityguard/v1/availability_guard.js";
