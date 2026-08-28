/**
 * DEV DOC
 * Module: sql/stay-night-basis.ts
 * Purpose: The nightly amounts penalties and fees are calculated from, read off
 *          `reservation_nights` rather than the flat `reservations.room_rate`.
 * Ownership: billing-service
 *
 * "One night's rate" is the basis for a no-show charge, a cancellation penalty
 * and a late-checkout fee. `reservations.room_rate` answered that with a single
 * scalar, which is wrong twice over once a stay has per-night rows: it cannot
 * tell the first night from the last, and it describes one room even when the
 * booking holds several. A guest who no-shows on a two-room booking forfeits
 * two rooms.
 *
 * These are scalar subqueries meant to be embedded in a SELECT over
 * `reservations r`. They fall back to nothing — the caller decides what to do
 * with NULL, which is normally to fall back to `r.room_rate` for a reservation
 * that predates the nights table.
 */

/**
 * Total charged across every room for the stay's first night — the basis for a
 * no-show charge and a one-night cancellation penalty.
 *
 * `reservationAlias` is the alias of the `reservations` row in the caller's
 * query. Binds no parameters of its own.
 */
export const firstNightTotalSql = (reservationAlias = "r"): string => `(
      SELECT SUM(n.rate_amount)
      FROM public.reservation_nights n
      WHERE n.reservation_id = ${reservationAlias}.id
        AND n.tenant_id = ${reservationAlias}.tenant_id
        AND n.is_complimentary = false
        AND COALESCE(n.is_deleted, false) = false
        AND n.stay_date = (
          SELECT MIN(n2.stay_date)
          FROM public.reservation_nights n2
          WHERE n2.reservation_id = ${reservationAlias}.id
            AND n2.tenant_id = ${reservationAlias}.tenant_id
            AND COALESCE(n2.is_deleted, false) = false
        )
    )`;

/**
 * Total charged across every room for the stay's last night — the basis for a
 * late-checkout fee, which is a proportion of the night the guest is
 * overstaying.
 */
export const lastNightTotalSql = (reservationAlias = "r"): string => `(
      SELECT SUM(n.rate_amount)
      FROM public.reservation_nights n
      WHERE n.reservation_id = ${reservationAlias}.id
        AND n.tenant_id = ${reservationAlias}.tenant_id
        AND n.is_complimentary = false
        AND COALESCE(n.is_deleted, false) = false
        AND n.stay_date = (
          SELECT MAX(n2.stay_date)
          FROM public.reservation_nights n2
          WHERE n2.reservation_id = ${reservationAlias}.id
            AND n2.tenant_id = ${reservationAlias}.tenant_id
            AND COALESCE(n2.is_deleted, false) = false
        )
    )`;
