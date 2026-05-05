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
