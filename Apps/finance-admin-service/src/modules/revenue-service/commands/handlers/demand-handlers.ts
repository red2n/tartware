import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { forEachDateInRange } from "../../lib/date-range.js";
import { upsertDemandCalendarEntry } from "../../services/demand-calendar-service.js";

export const handleDemandUpdate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ count: number }> => {
  const dates = payload.dates as string[];
  const demandLevel = payload.demand_level as string;
  const notes = (payload.notes as string) ?? null;
  for (const date of dates) {
    await upsertDemandCalendarEntry(
      metadata.tenantId,
      payload.property_id as string,
      date,
      demandLevel,
      notes,
      actorId,
    );
  }
  return { count: dates.length };
};

export const handleDemandImportEvents = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ events: number; upserted: number }> => {
  const events = payload.events as Array<{
    event_name: string;
    start_date: string;
    end_date: string;
    demand_level?: string;
    notes?: string;
  }>;
  let upserted = 0;
  for (const evt of events) {
    const count = await forEachDateInRange(evt.start_date, evt.end_date, async (dateStr) => {
      await upsertDemandCalendarEntry(
        metadata.tenantId,
        payload.property_id as string,
        dateStr,
        evt.demand_level ?? "HIGH",
        evt.notes ?? evt.event_name,
        actorId,
      );
    });
    upserted += count;
  }
  return { events: events.length, upserted };
};
