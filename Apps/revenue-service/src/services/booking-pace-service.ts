import type { BookingPaceItem, BookingPaceRow } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toNumber } from "../lib/row-mappers.js";
import { BOOKING_PACE_REPORT_SQL, BOOKING_PACE_SNAPSHOT_SQL } from "../sql/pace-queries.js";

// ============================================================================
// BOOKING PACE ANALYSIS (R11)
// ============================================================================

const mapRowToPaceItem = (row: BookingPaceRow): BookingPaceItem => {
  const otbRooms = toNumber(row.otb_rooms);
  const lyOtbRooms = row.ly_otb_rooms != null ? toNumber(row.ly_otb_rooms) : null;

  return {
    calendar_date: toDateString(row.calendar_date) ?? "",
    day_of_week: toNumber(row.day_of_week),
    otb_rooms: otbRooms,
    otb_revenue: row.otb_revenue != null ? toNumber(row.otb_revenue) : null,
    ly_otb_rooms: lyOtbRooms,
    ly_otb_revenue: row.ly_otb_revenue != null ? toNumber(row.ly_otb_revenue) : null,
    pace_diff_rooms: lyOtbRooms != null ? otbRooms - lyOtbRooms : null,
    pace_diff_revenue:
      row.otb_revenue != null && row.ly_otb_revenue != null
        ? toNumber(row.otb_revenue) - toNumber(row.ly_otb_revenue)
        : null,
    pickup_last_7_days: row.pickup_last_7_days != null ? toNumber(row.pickup_last_7_days) : null,
    pickup_last_30_days: row.pickup_last_30_days != null ? toNumber(row.pickup_last_30_days) : null,
    pace_status:
      lyOtbRooms == null || lyOtbRooms === 0
        ? null
        : otbRooms >= lyOtbRooms * 1.05
          ? "ahead"
          : otbRooms >= lyOtbRooms * 0.95
            ? "on_track"
            : otbRooms >= lyOtbRooms * 0.8
              ? "behind"
              : "significantly_behind",
    rooms_available: row.rooms_available != null ? toNumber(row.rooms_available) : null,
    occupancy_forecast_percent:
      row.occupancy_forecast_percent != null ? toNumber(row.occupancy_forecast_percent) : null,
  };
};

/**
 * Get booking pace report for a date range.
 * Returns OTB rooms/revenue vs last year for each date.
 */
export const getBookingPaceReport = async (opts: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<BookingPaceItem[]> => {
  const { rows } = await query<BookingPaceRow>(BOOKING_PACE_REPORT_SQL, [
    opts.tenantId,
    opts.propertyId,
    opts.startDate,
    opts.endDate,
  ]);
  return rows.map(mapRowToPaceItem);
};

/**
 * Snapshot current booking pace into demand_calendar.
 * Called by the `revenue.booking_pace.snapshot` command.
 */
export const snapshotBookingPace = async (opts: {
  tenantId: string;
  propertyId: string;
  horizonDays: number;
  actorId: string;
}): Promise<{ daysUpdated: number }> => {
  const startDate = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + opts.horizonDays);

  const result = await query(BOOKING_PACE_SNAPSHOT_SQL, [
    opts.tenantId,
    opts.propertyId,
    startDate,
    endDate.toISOString().slice(0, 10),
    opts.actorId,
  ]);

  return { daysUpdated: result.rowCount ?? 0 };
};
