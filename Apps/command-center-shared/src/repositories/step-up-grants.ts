/**
 * DEV DOC
 * Module: repositories/step-up-grants.ts
 * Purpose: Spend a supervisor's step-up grant, once.
 * Ownership: command-center-shared
 *
 * Minting lives in core-service, which owns password verification. This is the
 * other end: the accept path claims the row and the command carries the
 * supervisor's authority onward as `metadata.stepUp`.
 */

import type { OverrideStepUpGrantRow } from "@tartware/schemas";

const GRANT_COLUMNS = `grant_id, tenant_id, property_id, command_name, entity_id,
       supervisor_id, supervisor_role, requested_by,
       created_at, expires_at, consumed_at, consumed_command_id`;

/**
 * Read the grant as it stands, then claim it.
 *
 * Two statements rather than one, for a reason found the hard way: an
 * `UPDATE … RETURNING` hands back the row *after* the update, so the caller
 * evaluating it sees the `consumed_at` this very claim just wrote and refuses
 * the first legitimate spend as a replay. The read supplies the pre-claim truth
 * the rules are written against.
 *
 * The claim is still the authority. Its WHERE clause carries the same
 * unconsumed and unexpired tests, so single use holds under a race — two
 * commands arriving with one grant id in the same millisecond both run the
 * UPDATE and exactly one of them updates a row. The read is for the message;
 * the UPDATE is for the control.
 *
 * `expires_at` is compared against the database clock, not the caller's: a
 * short-lived authorisation whose window depends on the requesting host's clock
 * is a short-lived authorisation with a long tail.
 *
 * The tenant is matched in both. It cannot differ through the API, and it is
 * matched anyway, because the cost of being wrong once is a cross-tenant
 * override.
 */
const FIND_GRANT_SQL = `
  SELECT ${GRANT_COLUMNS}
    FROM public.override_step_up_grants
   WHERE grant_id = $1::uuid
     AND tenant_id = $2::uuid
   LIMIT 1
`;

const CLAIM_GRANT_SQL = `
  UPDATE public.override_step_up_grants
     SET consumed_at = NOW(),
         consumed_command_id = $3::uuid
   WHERE grant_id = $1::uuid
     AND tenant_id = $2::uuid
     AND consumed_at IS NULL
     AND expires_at > NOW()
  RETURNING grant_id
`;

export type ClaimStepUpGrantInput = {
  grantId: string;
  tenantId: string;
  commandId: string;
};

/**
 * The grant as it stood before this claim, and whether this caller won it.
 *
 * `claimed: false` means the row exists but was not claimable — already spent,
 * or expired. The caller reports which from `grant`, whose values are the
 * pre-claim ones.
 */
export type ClaimStepUpGrantResult = {
  grant: OverrideStepUpGrantRow;
  claimed: boolean;
};

export type StepUpQueryExecutor = <T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
) => Promise<{ rows: T[] }>;

/**
 * Build the claim against a given executor.
 *
 * Takes the executor rather than importing a pool so the gateway can pass the
 * transaction-scoped client its accept path already holds — the claim has to
 * unwind with the dispatch, or a duplicate request that loses the race would
 * burn a supervisor's authorisation on a command that was never accepted.
 */
export const createStepUpGrantRepository = (query: StepUpQueryExecutor) => ({
  claimStepUpGrant: async (
    input: ClaimStepUpGrantInput,
  ): Promise<ClaimStepUpGrantResult | null> => {
    const found = await query<OverrideStepUpGrantRow>(FIND_GRANT_SQL, [
      input.grantId,
      input.tenantId,
    ]);
    const grant = found.rows[0];
    if (!grant) return null;

    const claim = await query<{ grant_id: string }>(CLAIM_GRANT_SQL, [
      input.grantId,
      input.tenantId,
      input.commandId,
    ]);
    return { grant, claimed: claim.rows.length > 0 };
  },
});
