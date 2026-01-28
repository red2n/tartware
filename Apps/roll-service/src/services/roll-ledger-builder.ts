import type { ReservationEvent } from "@tartware/schemas";

import type { RollLedgerEntry } from "../repositories/ledger-repository.js";

/**
 * Lifecycle row shape used to build roll ledger entries.
 */
export type LifecycleRow = {
  event_id: string;
  tenant_id: string;
  reservation_id: string | null;
  command_name: string;
  current_state: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

const toDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const candidate = new Date(String(value));
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const formatDateOnly = (value: Date | null): string => {
  const date = value ?? new Date();
  return date.toISOString().slice(0, 10);
};

const deriveRollType = (
  commandOrEvent: string,
  currentState?: string,
): "EOD" | "CHECKOUT" | "CANCEL" | "UNKNOWN" => {
  const normalized =
    typeof commandOrEvent === "string" ? commandOrEvent.toLowerCase() : "";
  if (normalized.includes("cancel")) {
    return "CANCEL";
  }
  if (normalized.includes("checkout") || currentState === "COMPLETED") {
    return "CHECKOUT";
  }
  if (normalized.includes("complete") || currentState === "APPLIED") {
    return "EOD";
  }
  return "UNKNOWN";
};

/**
 * Build a roll ledger entry from a reservation event.
 */
export const buildLedgerEntryFromReservationEvent = (
  event: ReservationEvent,
): RollLedgerEntry => {
  const checkoutDate =
    "check_out_date" in event.payload
      ? toDate(event.payload.check_out_date)
      : null;
  const cancelledAt =
    "cancelled_at" in event.payload ? toDate(event.payload.cancelled_at) : null;
  const rollDateCandidate = checkoutDate ?? cancelledAt;

  return {
    tenantId: event.metadata.tenantId,
    reservationId:
      "id" in event.payload ? (event.payload.id ?? undefined) : undefined,
    lifecycleEventId: event.metadata.id,
    rollType: deriveRollType(event.metadata.type),
    rollDate: formatDateOnly(
      rollDateCandidate ?? toDate(event.metadata.timestamp),
    ),
    occurredAt: toDate(event.metadata.timestamp) ?? new Date(),
    sourceEventType: event.metadata.type,
    payload: {
      metadata: event.metadata,
      payload: event.payload,
    },
  };
};

/**
 * Build a roll ledger entry from a lifecycle table row.
 */
export const buildLedgerEntryFromLifecycleRow = (
  row: LifecycleRow,
): RollLedgerEntry => {
  const metadata: Record<string, unknown> = row.metadata ?? {};
  const stayEnd =
    (metadata.stayEnd as string | undefined) ??
    (metadata.checkOutDate as string | undefined) ??
    (metadata.check_out_date as string | undefined);
  const rollDateCandidate = toDate(
    stayEnd ?? (metadata.stay_end as string | undefined),
  );
  const occurredAt = row.created_at ?? new Date();
  const sourceEventType =
    (metadata.eventType as string | undefined) ??
    row.command_name.toLowerCase();

  return {
    tenantId: row.tenant_id,
    reservationId: row.reservation_id ?? undefined,
    lifecycleEventId: row.event_id,
    rollType: deriveRollType(sourceEventType, row.current_state),
    rollDate: formatDateOnly(rollDateCandidate ?? occurredAt),
    occurredAt,
    sourceEventType,
    payload: {
      commandName: row.command_name,
      currentState: row.current_state,
      metadata,
    },
  };
};
