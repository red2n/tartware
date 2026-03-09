import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { forEachDateInRange } from "../../lib/date-range.js";
import {
  removeRateRestriction,
  upsertRateRestriction,
} from "../../services/restriction-service.js";

export const handleRestrictionSet = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ upserted: number; restrictionType: unknown }> => {
  const upserted = await forEachDateInRange(
    payload.start_date as string,
    payload.end_date as string,
    async (dateStr) => {
      await upsertRateRestriction(
        metadata.tenantId,
        payload.property_id as string,
        {
          roomTypeId: (payload.room_type_id as string) ?? null,
          ratePlanId: (payload.rate_plan_id as string) ?? null,
          restrictionDate: dateStr,
          restrictionType: payload.restriction_type as string,
          restrictionValue: (payload.restriction_value as number) ?? 1,
          isActive: (payload.is_active as boolean) ?? true,
          source: (payload.source as string) ?? "manual",
          reason: (payload.reason as string) ?? null,
          metadata: (payload.metadata as Record<string, unknown>) ?? null,
        },
        actorId,
      );
    },
  );
  return { upserted, restrictionType: payload.restriction_type };
};

export const handleRestrictionRemove = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ removed: number; restrictionType: unknown }> => {
  let removed = 0;
  await forEachDateInRange(
    payload.start_date as string,
    payload.end_date as string,
    async (dateStr) => {
      const result = await removeRateRestriction(
        metadata.tenantId,
        payload.property_id as string,
        dateStr,
        payload.restriction_type as string,
        actorId,
      );
      if (result) removed++;
    },
  );
  return { removed, restrictionType: payload.restriction_type };
};

export const handleRestrictionBulkSet = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ restrictions: number; totalUpserted: number }> => {
  const restrictions = payload.restrictions as Array<{
    room_type_id?: string;
    rate_plan_id?: string;
    start_date: string;
    end_date: string;
    restriction_type: string;
    restriction_value?: number;
    reason?: string;
  }>;
  let totalUpserted = 0;
  for (const restriction of restrictions) {
    const count = await forEachDateInRange(
      restriction.start_date,
      restriction.end_date,
      async (dateStr) => {
        await upsertRateRestriction(
          metadata.tenantId,
          payload.property_id as string,
          {
            roomTypeId: restriction.room_type_id ?? null,
            ratePlanId: restriction.rate_plan_id ?? null,
            restrictionDate: dateStr,
            restrictionType: restriction.restriction_type,
            restrictionValue: restriction.restriction_value ?? 1,
            isActive: (payload.is_active as boolean) ?? true,
            source: (payload.source as string) ?? "manual",
            reason: restriction.reason ?? null,
            metadata: (payload.metadata as Record<string, unknown>) ?? null,
          },
          actorId,
        );
      },
    );
    totalUpserted += count;
  }
  return { restrictions: restrictions.length, totalUpserted };
};
