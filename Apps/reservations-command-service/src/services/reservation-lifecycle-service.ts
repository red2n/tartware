import type { ReservationCommandLifecycle } from "@tartware/schemas";
import { ReservationCommandLifecycleSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";

type LifecycleRow = ReservationCommandLifecycle & {
  created_at: Date;
  updated_at: Date;
};

export const listReservationLifecycle = async (
  tenantId: string,
  reservationId: string,
): Promise<ReservationCommandLifecycle[]> => {
  const result = await query<LifecycleRow>(
    `
      SELECT
        event_id,
        tenant_id,
        reservation_id,
        command_name,
        correlation_id,
        partition_key,
        current_state,
        state_transitions,
        metadata,
        created_at,
        updated_at
      FROM reservation_command_lifecycle
      WHERE tenant_id = $1
        AND reservation_id = $2
      ORDER BY created_at DESC
    `,
    [tenantId, reservationId],
  );

  return result.rows.map((row) =>
    ReservationCommandLifecycleSchema.parse({
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }),
  );
};
