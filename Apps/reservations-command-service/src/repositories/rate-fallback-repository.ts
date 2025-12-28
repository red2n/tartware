import type { PoolClient } from "pg";

type RateFallbackRecord = {
  tenantId: string;
  reservationId: string;
  propertyId: string;
  requestedRateCode?: string;
  appliedRateCode: string;
  reason?: string;
  actor: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export const insertRateFallbackRecord = async (
  client: PoolClient,
  record: RateFallbackRecord,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO reservation_rate_fallbacks (
        tenant_id,
        reservation_id,
        property_id,
        requested_rate_code,
        applied_rate_code,
        reason,
        actor,
        correlation_id,
        metadata
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        COALESCE($9::jsonb, '{}'::jsonb)
      )
    `,
    [
      record.tenantId,
      record.reservationId,
      record.propertyId,
      record.requestedRateCode ?? null,
      record.appliedRateCode,
      record.reason ?? null,
      record.actor,
      record.correlationId ?? null,
      record.metadata ? JSON.stringify(record.metadata) : null,
    ],
  );
};
