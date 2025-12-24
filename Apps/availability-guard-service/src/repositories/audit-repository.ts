import type { PoolClient } from "pg";

import { query } from "../lib/db.js";

export type LockAuditRecord = {
  id: string;
  lock_id: string;
  tenant_id: string;
  action: string;
  performed_by_id: string;
  performed_by_name: string;
  performed_by_email: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

type LockAuditInput = {
  lockId: string;
  tenantId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorEmail?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export const insertLockAuditRecord = async (
  client: PoolClient,
  input: LockAuditInput,
): Promise<LockAuditRecord> => {
  const result = await client.query<LockAuditRecord>(
    `
      INSERT INTO inventory_lock_audits (
        lock_id,
        tenant_id,
        action,
        performed_by_id,
        performed_by_name,
        performed_by_email,
        reason,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `,
    [
      input.lockId,
      input.tenantId,
      input.action,
      input.actorId,
      input.actorName,
      input.actorEmail ?? null,
      input.reason ?? null,
      input.metadata ?? {},
    ],
  );

  const record = result.rows[0];
  if (!record) {
    throw new Error("Failed to insert inventory lock audit record");
  }
  return record;
};

type ListLockAuditInput = {
  lockId?: string;
  tenantId?: string;
  limit?: number;
};

export const listLockAuditRecords = async (
  input: ListLockAuditInput,
): Promise<LockAuditRecord[]> => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.lockId) {
    params.push(input.lockId);
    conditions.push(`lock_id = $${params.length}::uuid`);
  }

  if (input.tenantId) {
    params.push(input.tenantId);
    conditions.push(`tenant_id = $${params.length}::uuid`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const result = await query<LockAuditRecord>(
    `
      SELECT *
      FROM inventory_lock_audits
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `,
    params,
  );

  return result.rows;
};
