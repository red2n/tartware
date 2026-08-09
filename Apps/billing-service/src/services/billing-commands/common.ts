import type { CommandContext } from "@tartware/schemas";
import { query } from "../../lib/db.js";

export type { CommandContext };

export class BillingCommandError extends Error {
  code: string;
  /**
   * When true the command consumer will retry this error rather than routing
   * immediately to the DLQ. Set to true only for transient failures (e.g.
   * unexpected DB write failures) that may succeed on a subsequent attempt.
   * Business-logic validation errors (wrong status, missing FK) should leave
   * this false — retrying them wastes attempts and delays DLQ diagnosis.
   */
  retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }

  toJSON() {
    return { code: this.code, message: this.message, name: this.name, retryable: this.retryable };
  }
}

export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

export const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  asUuid(initiatedBy?.userId) ?? SYSTEM_ACTOR_ID;

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
