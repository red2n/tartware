import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import type { GuestRegisterCommand } from "../schemas/guest-commands.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const guestCommandLogger = appLogger.child({
  module: "guest-command-service",
});

type RegisterGuestOptions = {
  tenantId: string;
  payload: GuestRegisterCommand;
  correlationId?: string;
  initiatedBy?: {
    userId?: string;
    role?: string;
  } | null;
};

export const registerGuestProfile = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: RegisterGuestOptions): Promise<string | undefined> => {
  const normalizedPhone = normalizePhoneNumber(payload.phone ?? undefined);
  const address = payload.address ?? {};
  const preferences =
    payload.preferences !== undefined
      ? JSON.stringify(payload.preferences)
      : null;

  const createdBy = initiatedBy?.userId ?? "COMMAND_CENTER";

  const result = await query<{ guest_id: string }>(
    `
      SELECT upsert_guest(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12
      ) AS guest_id
    `,
    [
      tenantId,
      payload.email,
      payload.first_name,
      payload.last_name,
      normalizedPhone ?? null,
      address?.street ?? null,
      address?.city ?? null,
      address?.state ?? null,
      address?.country ?? null,
      address?.postal_code ?? null,
      preferences,
      createdBy,
    ],
  );

  const guestId = result.rows[0]?.guest_id;
  guestCommandLogger.info(
    {
      tenantId,
      guestId,
      correlationId,
      initiatedBy,
    },
    "guest.register command applied",
  );
  return guestId;
};
