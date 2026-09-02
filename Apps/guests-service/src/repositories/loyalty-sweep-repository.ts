/**
 * DEV DOC
 * Module: loyalty-sweep-repository.ts
 * Purpose: The tenant scan driving the loyalty point expiry sweep.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `jobs/loyalty-expiry-sweep.ts`.
 */

import type { PoolClient } from "pg";

const LIST_TENANTS_WITH_EXPIRING_POINTS_SQL = `SELECT DISTINCT tenant_id
       FROM loyalty_point_transactions
       WHERE expired = FALSE
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()
         AND transaction_type IN ('earn', 'bonus', 'adjust', 'transfer_in')
         AND points > 0`;

/**
 * Tenants holding point transactions due to expire, so the sweep only
 * visits tenants that have work.
 */
export const listTenantsWithExpiringPoints = (client: PoolClient) =>
  client.query<{ tenant_id: string }>(LIST_TENANTS_WITH_EXPIRING_POINTS_SQL);
