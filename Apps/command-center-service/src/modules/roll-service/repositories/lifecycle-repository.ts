import { query } from "../lib/db.js";
import type { LifecycleRow } from "../services/roll-ledger-builder.js";

type LifecycleRowRecord = {
  event_id: string;
  tenant_id: string;
  reservation_id: string | null;
  command_name: string;
  current_state: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const toLifecycleRow = (row: LifecycleRowRecord): LifecycleRow => ({
  event_id: row.event_id,
  tenant_id: row.tenant_id,
  reservation_id: row.reservation_id,
  command_name: row.command_name,
  current_state: row.current_state,
  metadata: row.metadata ?? {},
  created_at: new Date(row.created_at),
});

export const fetchLifecycleRowsByReservation = async (
  reservationId: string,
): Promise<LifecycleRow[]> => {
  const result = await query<LifecycleRowRecord>(
    `
      SELECT
        event_id,
        tenant_id,
        reservation_id,
        command_name,
        current_state,
        metadata,
        created_at
      FROM reservation_command_lifecycle
      WHERE reservation_id = $1::uuid
      ORDER BY created_at ASC
    `,
    [reservationId],
  );

  return result.rows.map(toLifecycleRow);
};
