import type { ChannelProfitabilityItem } from "@tartware/schemas";
import type { ChannelProfitabilityRow } from "@tartware/schemas/api/revenue-rows";

import { query } from "../lib/db.js";
import { CHANNEL_PROFITABILITY_SQL } from "../sql/channel-queries.js";

const toNumber = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "string" ? Number(v) : v;

/**
 * Industry-standard commission rates by distribution channel.
 * Direct: 2-5%, GDS: ~10%, OTA: 15-25%, Corporate: 8%, Group: 5%
 */
const COMMISSION_RATES: Record<string, number> = {
  DIRECT: 0.03,
  WEBSITE: 0.03,
  PHONE: 0.02,
  WALKIN: 0.0,
  OTA: 0.2,
  CORPORATE: 0.08,
  GROUP: 0.05,
};

/**
 * R18 — Channel profitability analysis.
 *
 * Computes net revenue by distribution channel using industry-standard
 * commission rates. Shows the true cost of each booking channel.
 */
export const getChannelProfitability = async (opts: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: ChannelProfitabilityItem[] }> => {
  const { rows } = await query<ChannelProfitabilityRow>(CHANNEL_PROFITABILITY_SQL, [
    opts.tenantId,
    opts.propertyId,
    opts.startDate,
    opts.endDate,
  ]);

  const totalGross = rows.reduce((sum, r) => sum + toNumber(r.gross_revenue), 0);

  const items: ChannelProfitabilityItem[] = rows.map((row) => {
    const gross = toNumber(row.gross_revenue);
    const roomNights = toNumber(row.room_nights);
    const commissionPct = COMMISSION_RATES[row.channel] ?? 0.1;
    const commissionAmt = Math.round(gross * commissionPct * 100) / 100;
    const net = Math.round((gross - commissionAmt) * 100) / 100;

    return {
      channel: row.channel,
      booking_count: toNumber(row.booking_count),
      room_nights: roomNights,
      gross_revenue: gross,
      commission_pct: Math.round(commissionPct * 10000) / 100,
      commission_amount: commissionAmt,
      net_revenue: net,
      net_adr: roomNights > 0 ? Math.round((net / roomNights) * 100) / 100 : 0,
      pct_of_total_revenue: totalGross > 0 ? Math.round((gross / totalGross) * 10000) / 100 : 0,
    };
  });

  return { items };
};
