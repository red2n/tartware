import type { GroupEvaluateRow } from "@tartware/schemas/api/revenue-rows";

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { GROUP_EVALUATE_SQL } from "../sql/displacement-queries.js";

const logger = appLogger.child({ module: "group-evaluate-service" });

const toNumber = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "string" ? Number(v) : v;

const toDateString = (v: string | Date): string =>
  typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

/**
 * R19 — Enhanced group displacement evaluation.
 *
 * Provides a comprehensive "should we take this group?" analysis including:
 * - Displaced room revenue (transient ADR × group room nights)
 * - Displaced ancillary revenue (avg transient F&B spend × nights)
 * - Group total contribution (rooms + ancillary)
 * - Denied demand estimation
 * - Occupancy context
 * - Net displacement value with recommendation
 */
export const evaluateGroupBlock = async (opts: {
  tenantId: string;
  propertyId: string;
  groupId: string;
  actorId: string;
}): Promise<{
  evaluation: {
    group_id: string;
    group_name: string;
    group_rooms_booked: number;
    group_room_nights: number;
    group_room_revenue: number;
    group_adr: number;
    block_start: string;
    block_end: string;
    avg_transient_adr: number;
    transient_bookings: number;
    estimated_denied_demand: number;
    group_ancillary_revenue: number;
    avg_transient_ancillary_per_booking: number;
    displaced_room_revenue: number;
    displaced_ancillary_revenue: number;
    group_total_contribution: number;
    net_displacement_value: number;
    occupancy_pct: number;
    recommendation: string;
    recommendation_detail: string;
  } | null;
}> => {
  const { rows } = await query<GroupEvaluateRow>(GROUP_EVALUATE_SQL, [
    opts.tenantId,
    opts.propertyId,
    opts.groupId,
  ]);

  if (rows.length === 0 || !rows[0]) {
    logger.warn({ groupId: opts.groupId }, "No group block data found for evaluation");
    return { evaluation: null };
  }

  const row = rows[0];
  const netVal = toNumber(row.net_displacement_value);
  const occupancy = toNumber(row.occupancy_pct);
  const deniedDemand = toNumber(row.estimated_denied_demand);

  // Generate recommendation based on net displacement + occupancy context
  let recommendation: string;
  let recommendationDetail: string;

  if (netVal > 0) {
    recommendation = "ACCEPT";
    recommendationDetail =
      "Group total contribution exceeds displaced transient + ancillary revenue.";
  } else if (occupancy < 70) {
    recommendation = "ACCEPT";
    recommendationDetail =
      `Net displacement is negative ($${Math.abs(netVal).toFixed(0)}) but occupancy is low (${occupancy}%). ` +
      "Group fills otherwise empty rooms.";
  } else if (deniedDemand > 0 && netVal < -500) {
    recommendation = "DECLINE";
    recommendationDetail =
      `Significant displacement ($${Math.abs(netVal).toFixed(0)}) with ${deniedDemand} ` +
      "estimated denied bookings. Group is displacing higher-value demand.";
  } else if (netVal < -200) {
    recommendation = "NEGOTIATE";
    recommendationDetail =
      `Marginal displacement ($${Math.abs(netVal).toFixed(0)}). ` +
      "Consider negotiating a higher group rate or requiring minimum F&B spend.";
  } else {
    recommendation = "ACCEPT";
    recommendationDetail = "Displacement is minimal. Group contributes to base occupancy.";
  }

  return {
    evaluation: {
      group_id: row.group_id,
      group_name: row.group_name,
      group_rooms_booked: toNumber(row.group_rooms_booked),
      group_room_nights: toNumber(row.group_room_nights),
      group_room_revenue: toNumber(row.group_room_revenue),
      group_adr: toNumber(row.group_adr),
      block_start: toDateString(row.block_start as string),
      block_end: toDateString(row.block_end as string),
      avg_transient_adr: toNumber(row.avg_transient_adr),
      transient_bookings: toNumber(row.transient_bookings),
      estimated_denied_demand: deniedDemand,
      group_ancillary_revenue: toNumber(row.group_ancillary_revenue),
      avg_transient_ancillary_per_booking: toNumber(row.avg_transient_ancillary_per_booking),
      displaced_room_revenue: toNumber(row.displaced_room_revenue),
      displaced_ancillary_revenue: toNumber(row.displaced_ancillary_revenue),
      group_total_contribution: toNumber(row.group_total_contribution),
      net_displacement_value: netVal,
      occupancy_pct: occupancy,
      recommendation,
      recommendation_detail: recommendationDetail,
    },
  };
};
