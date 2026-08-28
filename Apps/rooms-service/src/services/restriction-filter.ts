import { evaluateRestrictions, type RestrictionRefusal } from "@tartware/schemas";

import {
  loadPropertyWideRestrictions,
  loadSearchRestrictions,
} from "../repositories/restriction-repository.js";

/**
 * Drops room types an availability search may not offer.
 *
 * The booking path refuses a stay that breaks CTA, CTD, min/max LOS, an advance
 * window or a sell limit. A search that still listed those room types would
 * send a guest to a booking that cannot succeed, so it runs the same
 * `evaluateRestrictions` over the same rules and removes them — reporting why,
 * because "no rooms available" and "closed to arrival on the 10th" are very
 * different things to a front desk.
 */

type RoomLike = { room_type_id?: string | null; room_type_name?: string | null };

type FilterInput<T extends RoomLike> = {
  tenantId: string;
  propertyId: string;
  arrival: Date;
  departure: Date;
  rooms: T[];
};

export type RestrictedRoomType = {
  room_type_id: string;
  room_type_name?: string;
  refusals: RestrictionRefusal[];
};

export const filterRestrictedRoomTypes = async <T extends RoomLike>(
  input: FilterInput<T>,
): Promise<{ rooms: T[]; restricted: RestrictedRoomType[] }> => {
  if (input.rooms.length === 0) {
    return { rooms: input.rooms, restricted: [] };
  }

  const window = {
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    arrival: input.arrival,
    departure: input.departure,
  };

  const [byRoomType, propertyWide] = await Promise.all([
    loadSearchRestrictions(window),
    loadPropertyWideRestrictions(window),
  ]);

  // Nothing configured anywhere: skip the per-type work entirely. This is the
  // common case for a property that has never published a restriction, and it
  // keeps the search cost where it was.
  if (byRoomType.size === 0 && propertyWide.length === 0) {
    return { rooms: input.rooms, restricted: [] };
  }

  // The search has no rate and no booking channel, so advance windows are
  // measured from today. A property whose business date has not rolled sees at
  // most a day's difference here, and the booking path re-checks against the
  // real business date before anything is held.
  const bookingDate = new Date();

  const verdictByType = new Map<string, RestrictionRefusal[]>();
  const restricted: RestrictedRoomType[] = [];
  const sellable: T[] = [];

  for (const room of input.rooms) {
    const roomTypeId = room.room_type_id;
    if (!roomTypeId) {
      sellable.push(room);
      continue;
    }

    let refusals = verdictByType.get(roomTypeId);
    if (refusals === undefined) {
      const scoped = byRoomType.get(roomTypeId);
      const verdict = evaluateRestrictions(
        {
          arrival: input.arrival,
          departure: input.departure,
          booking_date: bookingDate,
          rooms_requested: 1,
        },
        [...(scoped?.rules ?? []), ...(scoped ? [] : propertyWide)],
        scoped?.inventory ?? [],
      );
      refusals = verdict.refusals;
      verdictByType.set(roomTypeId, refusals);

      if (refusals.length > 0) {
        restricted.push({
          room_type_id: roomTypeId,
          ...(room.room_type_name ? { room_type_name: room.room_type_name } : {}),
          refusals,
        });
      }
    }

    if (refusals.length === 0) {
      sellable.push(room);
    }
  }

  return { rooms: sellable, restricted };
};
