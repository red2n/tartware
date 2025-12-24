import type { PoolClient } from "pg";

import { serviceConfig } from "../config.js";
import { query } from "../lib/db.js";

const ACTOR = serviceConfig.serviceId;

export type ReservationCommandLifecycleState =
  | "RECEIVED"
  | "PERSISTED"
  | "IN_PROGRESS"
  | "PUBLISHED"
  | "CONSUMED"
  | "APPLIED"
  | "FAILED"
  | "DLQ";

type LifecycleInsertInput = {
  eventId: string;
  tenantId: string;
  reservationId?: string;
  commandName: string;
  correlationId?: string;
  partitionKey?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const toJson = (value?: Record<string, unknown>): string => {
  return JSON.stringify(value ?? {});
};

export const recordLifecyclePersisted = async (
  client: PoolClient,
  input: LifecycleInsertInput,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO reservation_command_lifecycle (
        event_id,
        tenant_id,
        reservation_id,
        command_name,
        correlation_id,
        partition_key,
        current_state,
        state_transitions,
        metadata
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'PERSISTED',
        jsonb_build_array(
          jsonb_build_object(
            'state',
            'RECEIVED',
            'timestamp',
            NOW(),
            'actor',
            $7,
            'details',
            COALESCE($8::jsonb, '{}'::jsonb)
          ),
          jsonb_build_object(
            'state',
            'PERSISTED',
            'timestamp',
            NOW(),
            'actor',
            $7,
            'details',
            COALESCE($8::jsonb, '{}'::jsonb)
          )
        ),
        COALESCE($9::jsonb, '{}'::jsonb)
      )
      ON CONFLICT (event_id) DO UPDATE
      SET
        current_state = 'PERSISTED',
        updated_at = NOW(),
        state_transitions = reservation_command_lifecycle.state_transitions || jsonb_build_array(
          jsonb_build_object(
            'state',
            'PERSISTED',
            'timestamp',
            NOW(),
            'actor',
            $7,
            'details',
            COALESCE($8::jsonb, '{}'::jsonb)
          )
        ),
        metadata = COALESCE(reservation_command_lifecycle.metadata, '{}'::jsonb) || COALESCE($9::jsonb, '{}'::jsonb),
        reservation_id = COALESCE(reservation_command_lifecycle.reservation_id, EXCLUDED.reservation_id)
    `,
    [
      input.eventId,
      input.tenantId,
      input.reservationId ?? null,
      input.commandName,
      input.correlationId ?? null,
      input.partitionKey ?? null,
      ACTOR,
      toJson(input.details),
      toJson({
        source: serviceConfig.serviceId,
        commandName: input.commandName,
        ...(input.metadata ?? {}),
      }),
    ],
  );
};

type LifecycleUpdateInput = {
  eventId: string;
  state: ReservationCommandLifecycleState;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const updateLifecycleState = async (
  input: LifecycleUpdateInput,
): Promise<void> => {
  const result = await query(
    `
      UPDATE reservation_command_lifecycle
      SET
        current_state = $2::reservation_command_lifecycle_state,
        updated_at = NOW(),
        state_transitions = state_transitions || jsonb_build_array(
          jsonb_build_object(
            'state',
            $2,
            'timestamp',
            NOW(),
            'actor',
            $3,
            'details',
            COALESCE($4::jsonb, '{}'::jsonb)
          )
        ),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($5::jsonb, '{}'::jsonb)
      WHERE event_id = $1
    `,
    [
      input.eventId,
      input.state,
      ACTOR,
      toJson(input.details),
      toJson(input.metadata),
    ],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error(
      `reservation_command_lifecycle missing for event ${input.eventId}`,
    );
  }
};
