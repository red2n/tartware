import type { SegmentAnalysisItem } from "@tartware/schemas";
import type { SegmentAnalysisRow } from "@tartware/schemas/api/revenue-rows";

import { query } from "../lib/db.js";
import { SEGMENT_ANALYSIS_SQL } from "../sql/segment-queries.js";

const toNumber = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "string" ? Number(v) : v;

/**
 * R17 — Segment performance analytics.
 *
 * Aggregates reservations by reservation_type (market segment) with
 * revenue, ADR, room nights, and year-over-year comparison.
 */
export const getSegmentAnalysis = async (opts: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  compareLy: boolean;
}): Promise<{ items: SegmentAnalysisItem[] }> => {
  const { rows } = await query<SegmentAnalysisRow>(SEGMENT_ANALYSIS_SQL, [
    opts.tenantId,
    opts.propertyId,
    opts.startDate,
    opts.endDate,
  ]);

  const items: SegmentAnalysisItem[] = rows.map((row) => {
    const revenue = toNumber(row.revenue);
    const adr = toNumber(row.adr);
    const lyRevenue = row.ly_revenue != null ? toNumber(row.ly_revenue) : null;
    const lyAdr = row.ly_adr != null ? toNumber(row.ly_adr) : null;

    return {
      segment: row.segment,
      rooms_sold: toNumber(row.rooms_sold),
      room_nights: toNumber(row.room_nights),
      revenue,
      adr,
      pct_of_total_revenue: toNumber(row.pct_of_total_revenue),
      pct_of_total_rooms: toNumber(row.pct_of_total_rooms),
      ly_rooms_sold:
        opts.compareLy && row.ly_rooms_sold != null ? toNumber(row.ly_rooms_sold) : null,
      ly_revenue: opts.compareLy ? lyRevenue : null,
      ly_adr: opts.compareLy ? lyAdr : null,
      revenue_change_pct:
        opts.compareLy && lyRevenue != null && lyRevenue > 0
          ? Math.round(((revenue - lyRevenue) / lyRevenue) * 10000) / 100
          : null,
      adr_change_pct:
        opts.compareLy && lyAdr != null && lyAdr > 0
          ? Math.round(((adr - lyAdr) / lyAdr) * 10000) / 100
          : null,
    };
  });

  return { items };
};
