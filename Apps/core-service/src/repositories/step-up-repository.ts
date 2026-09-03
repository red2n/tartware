/**
 * DEV DOC
 * Module: repositories/step-up-repository.ts
 * Purpose: The only SQL that writes `override_step_up_grants` from core-service.
 * Ownership: core-service
 *
 * Minting is the whole of core-service's involvement. The grant is *claimed*
 * by the gateway, in its own repository, because claiming is a conditional
 * UPDATE that has to happen on the accept path — see
 * `Apps/command-center-shared/src/repositories/step-up-grants.ts`.
 */

import type { OverrideStepUpGrantRow } from "@tartware/schemas";

import { query } from "../lib/db.js";

const INSERT_GRANT_SQL = `
  INSERT INTO public.override_step_up_grants (
    tenant_id, property_id, command_name, entity_id,
    supervisor_id, supervisor_role, requested_by, expires_at
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4::uuid,
    $5::uuid, $6, $7, NOW() + ($8 || ' seconds')::interval
  )
  RETURNING grant_id, tenant_id, property_id, command_name, entity_id,
            supervisor_id, supervisor_role, requested_by,
            created_at, expires_at, consumed_at, consumed_command_id
`;

export type InsertStepUpGrantInput = {
  tenantId: string;
  propertyId: string | null;
  commandName: string;
  entityId: string | null;
  supervisorId: string;
  supervisorRole: string;
  requestedBy: string;
  ttlSeconds: number;
};

/** Record a verified supervisor's authority for one command on one record. */
export const insertStepUpGrant = async (
  input: InsertStepUpGrantInput,
): Promise<OverrideStepUpGrantRow | null> => {
  const { rows } = await query<OverrideStepUpGrantRow>(INSERT_GRANT_SQL, [
    input.tenantId,
    input.propertyId,
    input.commandName,
    input.entityId,
    input.supervisorId,
    input.supervisorRole,
    input.requestedBy,
    String(input.ttlSeconds),
  ]);
  return rows[0] ?? null;
};
