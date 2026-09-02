import { buildValuesRows, chunkForBatch } from "@tartware/config/sql-batch";
import type { ResolvedStayPlan, ResolvedStayRoom } from "@tartware/schemas";
import type { PoolClient } from "pg";

/**
 * Persistence for the stay tables — `reservation_rooms`, `reservation_nights`
 * and `reservation_occupants`.
 *
 * These three carry what `reservations` cannot: a booking of more than one
 * room, a rate that changes mid-stay, and the people actually sleeping in each
 * room. Everything here takes a `PoolClient` because a stay is only ever
 * written inside the same transaction as the reservation row itself — a room
 * with no nights, or nights with no room, is not a state any reader should
 * ever observe.
 */

/** Column count of the `reservation_nights` insert, for batch chunking. */
const NIGHT_COLUMNS = 12;

/**
 * Per-row placeholder count of the `reservation_occupants` insert.
 *
 * Must equal the highest `p(n)` the render below uses. Get it wrong and every
 * row binds the wrong number of parameters — Postgres rejects the whole
 * statement with 08P01 rather than silently mis-binding, but only at runtime.
 */
const OCCUPANT_COLUMNS = 8;

type StayRoomIdentity = {
  reservationRoomId: string;
  roomSequence: number;
};

type WriteStayParams = {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  plan: ResolvedStayPlan;
  /** Per-room lifecycle status; mirrors the reservation's own on create. */
  status?: string;
  actorId?: string;
};

/**
 * Insert one `reservation_rooms` row per room in the plan, returning the ids
 * the night and occupant inserts hang off.
 *
 * Re-delivery safe: a room already present for this `(reservation, sequence)`
 * is updated rather than duplicated, so a replayed `reservation.created`
 * converges instead of raising a unique violation.
 */
const upsertReservationRooms = async (
  client: PoolClient,
  params: WriteStayParams,
): Promise<StayRoomIdentity[]> => {
  const rooms = params.plan.rooms;
  if (rooms.length === 0) {
    return [];
  }

  const scalars: unknown[] = [
    params.tenantId,
    params.propertyId,
    params.reservationId,
    params.status ?? "PENDING",
    params.actorId ?? null,
  ];
  const values: unknown[] = [];
  for (const room of rooms) {
    values.push(
      room.reservation_room_id ?? null,
      room.room_sequence,
      room.room_type_id,
      room.room_id ?? null,
      room.room_number ?? null,
      room.guest_id ?? null,
      room.adults,
      room.children,
      room.infants,
      room.do_not_move,
    );
  }

  const rowsSql = buildValuesRows({
    rowCount: rooms.length,
    columnsPerRow: 10,
    scalarCount: scalars.length,
    render: (p) =>
      `($1::uuid, $2::uuid, $3::uuid, COALESCE(${p(1)}::uuid, uuid_generate_v4()), ${p(2)}::int, ${p(3)}::uuid, ${p(4)}::uuid, ${p(5)}, ${p(6)}::uuid, ${p(7)}::int, ${p(8)}::int, ${p(9)}::int, ${p(10)}::boolean, $4, $5::uuid)`,
  });

  const { rows } = await client.query<{
    reservation_room_id: string;
    room_sequence: number;
  }>(
    `
      INSERT INTO reservation_rooms (
        tenant_id, property_id, reservation_id, reservation_room_id,
        room_sequence, room_type_id, room_id, room_number, guest_id,
        adults, children, infants, do_not_move, status, created_by
      ) VALUES
        ${rowsSql}
      ON CONFLICT (reservation_id, room_sequence) DO UPDATE
        SET room_type_id = EXCLUDED.room_type_id,
            room_id = COALESCE(EXCLUDED.room_id, reservation_rooms.room_id),
            room_number = COALESCE(EXCLUDED.room_number, reservation_rooms.room_number),
            guest_id = COALESCE(EXCLUDED.guest_id, reservation_rooms.guest_id),
            adults = EXCLUDED.adults,
            children = EXCLUDED.children,
            infants = EXCLUDED.infants,
            do_not_move = EXCLUDED.do_not_move,
            updated_at = NOW()
      RETURNING reservation_room_id, room_sequence
    `,
    [...scalars, ...values],
  );

  return rows.map((row) => ({
    reservationRoomId: row.reservation_room_id,
    roomSequence: row.room_sequence,
  }));
};

type NightWriteParams = {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  reservationRoomId: string;
  room: ResolvedStayRoom;
  actorId?: string;
};

/**
 * Replace the night rows of one room with the plan's.
 *
 * A stay change is a diff, not an overwrite of a scalar: nights the new plan
 * no longer covers are deleted (shorten), nights it adds are inserted
 * (extend), and nights present in both take the new price. Doing it as
 * delete-outside + upsert-inside keeps extend, shorten and re-price on one
 * code path.
 */
const replaceReservationNights = async (
  client: PoolClient,
  params: NightWriteParams,
): Promise<void> => {
  const nights = params.room.nights;
  const keptDates = nights.map((night) => night.stay_date);

  await client.query(
    `
      DELETE FROM reservation_nights
      WHERE tenant_id = $1::uuid
        AND reservation_room_id = $2::uuid
        AND NOT (stay_date = ANY($3::date[]))
    `,
    [params.tenantId, params.reservationRoomId, keptDates],
  );

  if (nights.length === 0) {
    return;
  }

  const scalars: unknown[] = [
    params.tenantId,
    params.propertyId,
    params.reservationId,
    params.reservationRoomId,
    params.actorId ?? null,
  ];

  for (const chunk of chunkForBatch(nights, NIGHT_COLUMNS, scalars.length)) {
    const values: unknown[] = [];
    for (const night of chunk) {
      values.push(
        night.stay_date,
        night.rate_id ?? null,
        night.rate_code ?? null,
        night.rate_amount,
        night.currency,
        night.adults,
        night.children,
        night.is_complimentary,
        night.is_rate_override,
        night.rate_override_reason ?? null,
        null,
        null,
      );
    }

    const rowsSql = buildValuesRows({
      rowCount: chunk.length,
      columnsPerRow: NIGHT_COLUMNS,
      scalarCount: scalars.length,
      render: (p) =>
        `($1::uuid, $2::uuid, $3::uuid, $4::uuid, ${p(1)}::date, ${p(2)}::uuid, ${p(3)}, ${p(4)}::decimal, ${p(5)}, ${p(6)}::int, ${p(7)}::int, ${p(8)}::boolean, ${p(9)}::boolean, ${p(10)}, $5::uuid, COALESCE(${p(11)}::jsonb, '{}'::jsonb), COALESCE(${p(12)}::timestamp, CURRENT_TIMESTAMP))`,
    });

    await client.query(
      `
        INSERT INTO reservation_nights (
          tenant_id, property_id, reservation_id, reservation_room_id,
          stay_date, rate_id, rate_code, rate_amount, currency,
          adults, children, is_complimentary, is_rate_override,
          rate_override_reason, created_by, metadata, created_at
        ) VALUES
          ${rowsSql}
        ON CONFLICT (reservation_room_id, stay_date) DO UPDATE
          SET rate_id = EXCLUDED.rate_id,
              rate_code = EXCLUDED.rate_code,
              rate_amount = EXCLUDED.rate_amount,
              currency = EXCLUDED.currency,
              adults = EXCLUDED.adults,
              children = EXCLUDED.children,
              is_complimentary = EXCLUDED.is_complimentary,
              is_rate_override = EXCLUDED.is_rate_override,
              rate_override_reason = EXCLUDED.rate_override_reason,
              updated_at = NOW()
      `,
      [...scalars, ...values],
    );
  }
};

type OccupantWriteParams = {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  reservationRoomId: string;
  room: ResolvedStayRoom;
  /** Used as the primary occupant when the room names nobody. */
  fallbackName: string;
  fallbackEmail?: string;
  fallbackPhone?: string;
  actorId?: string;
};

/**
 * Write the named occupants of one room.
 *
 * A room always ends up with a primary occupant: when the caller names nobody,
 * the booker is recorded, because a registration card with no name on it is
 * useless. `is_primary` is unique per room, so the fallback only fires while
 * no primary exists.
 */
const insertReservationOccupants = async (
  client: PoolClient,
  params: OccupantWriteParams,
): Promise<void> => {
  const supplied = params.room.occupants;
  const occupants =
    supplied.length > 0
      ? supplied
      : [
          {
            guest_id: params.room.guest_id,
            full_name: params.fallbackName,
            occupant_type: "ADULT" as const,
            email: params.fallbackEmail,
            phone: params.fallbackPhone,
            is_primary: true,
          },
        ];

  // Exactly one primary: honour an explicit flag, else promote the first.
  const primaryIndex = Math.max(
    0,
    occupants.findIndex((occupant) => occupant.is_primary === true),
  );
  const marked = occupants.map((occupant, index) => ({
    ...occupant,
    is_primary: index === primaryIndex,
  }));

  const scalars: unknown[] = [
    params.tenantId,
    params.propertyId,
    params.reservationId,
    params.reservationRoomId,
    params.actorId ?? null,
  ];

  for (const chunk of chunkForBatch(marked, OCCUPANT_COLUMNS, scalars.length)) {
    const values: unknown[] = [];
    for (const occupant of chunk) {
      values.push(
        occupant.guest_id ?? null,
        occupant.full_name,
        occupant.occupant_type ?? "ADULT",
        occupant.age ?? null,
        occupant.email ?? null,
        occupant.phone ?? null,
        occupant.is_primary,
        null, // metadata
      );
    }

    const rowsSql = buildValuesRows({
      rowCount: chunk.length,
      columnsPerRow: OCCUPANT_COLUMNS,
      scalarCount: scalars.length,
      render: (p) =>
        `($1::uuid, $2::uuid, $3::uuid, $4::uuid, ${p(1)}::uuid, ${p(2)}, ${p(3)}, ${p(4)}::int, ${p(5)}, ${p(6)}, ${p(7)}::boolean, $5::uuid, COALESCE(${p(8)}::jsonb, '{}'::jsonb))`,
    });

    await client.query(
      `
        INSERT INTO reservation_occupants (
          tenant_id, property_id, reservation_id, reservation_room_id,
          guest_id, full_name, occupant_type, age, email, phone,
          is_primary, created_by, metadata
        ) VALUES
          ${rowsSql}
        ON CONFLICT DO NOTHING
      `,
      [...scalars, ...values],
    );
  }
};

/**
 * Write a whole stay — rooms, their nights and their occupants — inside the
 * caller's transaction.
 *
 * Returns the room ids in plan order so a caller can react to them (room
 * assignment, key issue) without re-reading.
 */
export const writeReservationStay = async (
  client: PoolClient,
  params: WriteStayParams & {
    fallbackName: string;
    fallbackEmail?: string;
    fallbackPhone?: string;
  },
): Promise<StayRoomIdentity[]> => {
  const identities = await upsertReservationRooms(client, params);
  const bySequence = new Map(
    identities.map((identity) => [identity.roomSequence, identity.reservationRoomId]),
  );

  for (const room of params.plan.rooms) {
    const reservationRoomId = bySequence.get(room.room_sequence);
    if (!reservationRoomId) {
      continue;
    }
    await replaceReservationNights(client, {
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      reservationId: params.reservationId,
      reservationRoomId,
      room,
      actorId: params.actorId,
    });
    await insertReservationOccupants(client, {
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      reservationId: params.reservationId,
      reservationRoomId,
      room,
      fallbackName: params.fallbackName,
      fallbackEmail: params.fallbackEmail,
      fallbackPhone: params.fallbackPhone,
      actorId: params.actorId,
    });
  }

  return identities;
};

type StayWindowParams = {
  tenantId: string;
  reservationId: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
};

/**
 * Fit every room's nights to a new stay window.
 *
 * Extend and shorten are the same operation seen from two sides: nights that
 * fall outside the new window go, nights the window gained appear. Prices on
 * the nights that survive are left alone — a guest who extends by a day does
 * not get re-quoted for the days they already booked. A new night inherits its
 * price from the nearest night the room already has, which is what a front
 * desk means by "same rate, one more night"; with no nights to copy from it
 * lands at zero and the caller is expected to price it.
 */
export const resyncStayWindow = async (
  client: PoolClient,
  params: StayWindowParams,
): Promise<void> => {
  await client.query(
    `
      DELETE FROM reservation_nights
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND (stay_date < $3::date OR stay_date >= $4::date)
    `,
    [params.tenantId, params.reservationId, params.checkInDate, params.checkOutDate],
  );

  await client.query(
    `
      INSERT INTO reservation_nights (
        tenant_id, property_id, reservation_id, reservation_room_id,
        stay_date, rate_id, rate_code, rate_amount, currency, adults, children
      )
      SELECT rr.tenant_id,
             rr.property_id,
             rr.reservation_id,
             rr.reservation_room_id,
             d.stay_date::date,
             template.rate_id,
             template.rate_code,
             COALESCE(template.rate_amount, 0),
             COALESCE(template.currency, 'USD'),
             rr.adults,
             rr.children
      FROM reservation_rooms rr
      CROSS JOIN LATERAL generate_series(
        $3::date, ($4::date - 1), INTERVAL '1 day'
      ) AS d(stay_date)
      LEFT JOIN LATERAL (
        SELECT n.rate_id, n.rate_code, n.rate_amount, n.currency
        FROM reservation_nights n
        WHERE n.reservation_room_id = rr.reservation_room_id
          AND COALESCE(n.is_deleted, FALSE) = FALSE
        -- Chargeable nights first: a comped night carries 0.00, and copying
        -- that onto an extension would hand the guest a free night they did
        -- not negotiate. Distance decides between equally chargeable nights.
        ORDER BY n.is_complimentary, ABS(n.stay_date - d.stay_date::date)
        LIMIT 1
      ) AS template ON TRUE
      WHERE rr.tenant_id = $1::uuid
        AND rr.reservation_id = $2::uuid
        AND COALESCE(rr.is_deleted, FALSE) = FALSE
      ON CONFLICT (reservation_room_id, stay_date) DO NOTHING
    `,
    [params.tenantId, params.reservationId, params.checkInDate, params.checkOutDate],
  );
};

/**
 * Push the nightly ledger back onto the deprecated scalars.
 *
 * `reservations.total_amount` and `room_rate` are what most readers still use.
 * Until they move to `reservation_nights` the two have to agree, or an
 * extended stay shows the old price on every screen that has not migrated.
 */
export const syncReservationTotalsFromNights = async (
  client: PoolClient,
  tenantId: string,
  reservationId: string,
): Promise<void> => {
  await client.query(
    `
      UPDATE reservations r
      SET total_amount = COALESCE(stay.total_amount, r.total_amount),
          room_rate = COALESCE(stay.first_night_rate, r.room_rate),
          check_in_date = COALESCE(stay.first_night, r.check_in_date),
          check_out_date = COALESCE(stay.last_night + 1, r.check_out_date),
          updated_at = NOW()
      FROM (
        SELECT SUM(n.rate_amount) FILTER (WHERE NOT n.is_complimentary) AS total_amount,
               MIN(n.stay_date) AS first_night,
               MAX(n.stay_date) AS last_night,
               (ARRAY_AGG(n.rate_amount ORDER BY n.stay_date))[1] AS first_night_rate
        FROM reservation_nights n
        WHERE n.tenant_id = $1::uuid
          AND n.reservation_id = $2::uuid
          AND COALESCE(n.is_deleted, FALSE) = FALSE
      ) AS stay
      WHERE r.id = $2::uuid AND r.tenant_id = $1::uuid
    `,
    [tenantId, reservationId],
  );
};
