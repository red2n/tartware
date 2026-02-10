import { query } from "../../lib/db.js";

export type CommandContext = {
  tenantId: string;
  initiatedBy?: {
    userId?: string;
  } | null;
};

export class BillingCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const APP_ACTOR = "COMMAND_CENTER";
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const asUuid = (value: string | undefined | null): string | null =>
  value && UUID_REGEX.test(value) ? value : null;

export const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? APP_ACTOR;

export const resolveFolioId = async (tenantId: string, reservationId: string): Promise<string | null> => {
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
