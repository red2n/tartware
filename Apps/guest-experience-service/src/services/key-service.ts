import { randomUUID } from "node:crypto";

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "key-service" });

// ─── KeyVendor Interface ──────────────────────────────────────

export type MobileKey = {
  keyId: string;
  keyCode: string;
  keyType: "bluetooth" | "nfc" | "qr_code" | "pin";
  status: "pending" | "active" | "expired" | "revoked" | "used";
  validFrom: Date;
  validTo: Date;
};

export type KeyStatus = {
  keyId: string;
  status: MobileKey["status"];
  lastUsedAt: Date | null;
  usageCount: number;
};

/**
 * Vendor interface for key card / mobile key operations.
 * Real implementations connect to ASSA ABLOY Vostio, Salto KS, Dormakaba, etc.
 */
export interface KeyVendor {
  /** Issue a new digital key for a room. */
  issueKey(params: {
    roomId: string;
    guestId: string;
    validFrom: Date;
    validTo: Date;
    keyType?: MobileKey["keyType"];
  }): Promise<MobileKey>;

  /** Revoke an existing key. */
  revokeKey(keyId: string): Promise<void>;

  /** Query the current status of a key. */
  getKeyStatus(keyId: string): Promise<KeyStatus | null>;
}

// ─── ConsoleKeyVendor (dev/test stub) ──────────────────────────

/**
 * Development/test stub that logs key operations to the console.
 * Returns mock key data without connecting to any vendor.
 */
export class ConsoleKeyVendor implements KeyVendor {
  async issueKey(params: {
    roomId: string;
    guestId: string;
    validFrom: Date;
    validTo: Date;
    keyType?: MobileKey["keyType"];
  }): Promise<MobileKey> {
    const key: MobileKey = {
      keyId: randomUUID(),
      keyCode: `KEY-${randomUUID().slice(0, 12).toUpperCase()}`,
      keyType: params.keyType ?? "bluetooth",
      status: "active",
      validFrom: params.validFrom,
      validTo: params.validTo,
    };

    logger.info(
      {
        keyId: key.keyId,
        keyCode: key.keyCode,
        roomId: params.roomId,
        guestId: params.guestId,
        validFrom: key.validFrom.toISOString(),
        validTo: key.validTo.toISOString(),
      },
      "[ConsoleKeyVendor] key issued",
    );

    return key;
  }

  async revokeKey(keyId: string): Promise<void> {
    logger.info({ keyId }, "[ConsoleKeyVendor] key revoked");
  }

  async getKeyStatus(keyId: string): Promise<KeyStatus | null> {
    logger.info({ keyId }, "[ConsoleKeyVendor] getKeyStatus");
    return {
      keyId,
      status: "active",
      lastUsedAt: null,
      usageCount: 0,
    };
  }
}

// ─── Key Persistence ──────────────────────────────────────

const INSERT_KEY_SQL = `
  INSERT INTO mobile_keys (
    key_id, tenant_id, property_id, guest_id, reservation_id, room_id,
    key_code, key_type, status, valid_from, valid_to,
    access_granted_at, created_by
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
  RETURNING key_id, key_code, key_type, status, valid_from, valid_to
`;

const REVOKE_KEYS_SQL = `
  UPDATE mobile_keys
  SET status = 'revoked', updated_at = NOW()
  WHERE reservation_id = $1
    AND status = 'active'
    AND is_deleted = FALSE
`;

const GET_ACTIVE_KEYS_SQL = `
  SELECT
    key_id, key_code, key_type, status,
    valid_from, valid_to, last_used_at, usage_count,
    room_id
  FROM mobile_keys
  WHERE reservation_id = $1
    AND tenant_id = $2
    AND status = 'active'
    AND is_deleted = FALSE
  ORDER BY created_at DESC
`;

type KeyRow = {
  key_id: string;
  key_code: string;
  key_type: string;
  status: string;
  valid_from: string;
  valid_to: string;
  last_used_at: string | null;
  usage_count: number;
  room_id: string;
};

/**
 * Issue a key via the vendor and persist it in the database.
 */
export const issueAndStoreKey = async (
  vendor: KeyVendor,
  params: {
    tenantId: string;
    propertyId: string;
    guestId: string;
    reservationId: string;
    roomId: string;
    validFrom: Date;
    validTo: Date;
    keyType?: MobileKey["keyType"];
    initiatedBy?: string | null;
  },
): Promise<MobileKey> => {
  const key = await vendor.issueKey({
    roomId: params.roomId,
    guestId: params.guestId,
    validFrom: params.validFrom,
    validTo: params.validTo,
    keyType: params.keyType,
  });

  await query(INSERT_KEY_SQL, [
    key.keyId,
    params.tenantId,
    params.propertyId,
    params.guestId,
    params.reservationId,
    params.roomId,
    key.keyCode,
    key.keyType,
    key.status,
    key.validFrom,
    key.validTo,
    params.initiatedBy ?? null,
  ]);

  logger.info(
    { keyId: key.keyId, reservationId: params.reservationId },
    "mobile key issued and stored",
  );

  return key;
};

/**
 * Revoke all active keys for a reservation.
 */
export const revokeKeysForReservation = async (
  vendor: KeyVendor,
  reservationId: string,
  tenantId: string,
): Promise<number> => {
  // Get active keys to revoke via vendor
  const { rows: activeKeys } = await query<KeyRow>(GET_ACTIVE_KEYS_SQL, [reservationId, tenantId]);

  for (const key of activeKeys) {
    await vendor.revokeKey(key.key_id);
  }

  // Bulk revoke in DB
  const result = await query(REVOKE_KEYS_SQL, [reservationId]);
  const revokedCount = result.rowCount ?? 0;

  logger.info({ reservationId, revokedCount }, "mobile keys revoked for reservation");

  return revokedCount;
};

/**
 * Get active mobile keys for a reservation.
 */
export const getActiveKeysForReservation = async (
  reservationId: string,
  tenantId: string,
): Promise<KeyRow[]> => {
  const { rows } = await query<KeyRow>(GET_ACTIVE_KEYS_SQL, [reservationId, tenantId]);
  return rows;
};
