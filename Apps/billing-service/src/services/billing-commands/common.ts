import {
  asUuid,
  CommandError,
  resolveActorId,
  resolveActorRole,
  SYSTEM_ACTOR_ID,
} from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import { query } from "../../lib/db.js";

export type { CommandContext };

// Actor resolution is shared infrastructure — re-exported here so billing's
// command modules keep importing it from one place.
export { asUuid, resolveActorId, resolveActorRole, SYSTEM_ACTOR_ID };

/**
 * Billing command failure. `retryable` defaults to false — see
 * {@link CommandError} for why a retried business rejection is worse than an
 * immediate DLQ routing.
 */
export class BillingCommandError extends CommandError {}

/**
 * Resolves the folio a charge for this reservation should post to.
 *
 * A reservation can accumulate several folios over its life — reopen/close
 * cycles, house-account splits, merges and express checkout all leave extra
 * rows behind. Ordering by created_at alone picks whichever folio happened to
 * be created last, which is frequently a CLOSED one; charges then post to a
 * settled folio where the operator never sees them, and because the DB does
 * not reject postings to a closed folio the command still reports success.
 *
 * An OPEN folio therefore always wins. The created_at tiebreak only decides
 * between equally-valid candidates, and the fallback to a closed folio is kept
 * so callers that legitimately post to a settled folio (corrections, reversals)
 * still resolve one — those callers are expected to check folio_status
 * themselves.
 */
export const resolveFolioId = async (
  tenantId: string,
  reservationId: string,
): Promise<string | null> => {
  const { rows } = await query<{ folio_id: string }>(
    `
      SELECT folio_id
      FROM public.folios
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY (folio_status = 'OPEN') DESC, created_at DESC
      LIMIT 1
    `,
    [tenantId, reservationId],
  );
  return rows[0]?.folio_id ?? null;
};

/**
 * Resolves the OPEN folio for a reservation, or null if none is open.
 *
 * Separate from resolveFolioId rather than a flag on it: a caller either
 * requires a postable folio or it does not, and returning a closed folio to a
 * caller that cannot use one is what let penalty charges land on settled
 * folios unnoticed.
 */
export const resolveOpenFolioId = async (
  tenantId: string,
  reservationId: string,
): Promise<string | null> => {
  const { rows } = await query<{ folio_id: string }>(
    `
      SELECT folio_id
      FROM public.folios
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND folio_status = 'OPEN'
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, reservationId],
  );
  return rows[0]?.folio_id ?? null;
};

export const resolveInvoiceId = async (
  tenantId: string,
  reservationId: string | null | undefined,
): Promise<string | null> => {
  if (!reservationId) {
    return null;
  }
  const { rows } = await query<{ id: string }>(
    `
      SELECT id
      FROM public.invoices
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, reservationId],
  );
  return rows[0]?.id ?? null;
};
