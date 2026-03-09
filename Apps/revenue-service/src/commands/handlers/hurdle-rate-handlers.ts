import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { forEachDateInRange } from "../../lib/date-range.js";
import { upsertHurdleRate } from "../../services/hurdle-rate-service.js";

export const handleHurdleRateSet = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ upserted: number; roomTypeId: unknown }> => {
  const upserted = await forEachDateInRange(
    payload.start_date as string,
    payload.end_date as string,
    async (dateStr) => {
      await upsertHurdleRate(
        metadata.tenantId,
        payload.property_id as string,
        {
          roomTypeId: payload.room_type_id as string,
          hurdleDate: dateStr,
          hurdleRate: payload.hurdle_rate as number,
          currency: (payload.currency as string) ?? "USD",
          segment: (payload.segment as string) ?? null,
          source: (payload.source as string) ?? "manual",
          isActive: true,
          notes: (payload.notes as string) ?? null,
          metadata: (payload.metadata as Record<string, unknown>) ?? null,
        },
        actorId,
      );
    },
  );
  return { upserted, roomTypeId: payload.room_type_id };
};
