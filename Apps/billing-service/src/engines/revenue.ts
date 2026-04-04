/**
 * DEV DOC
 * Module: engines/revenue.ts
 * Purpose: Revenue KPI calculations from CORE.md §4 + industry standard gaps.
 * Ownership: calculation-service
 *
 * Implements STR/USALI KPIs: ADR, RevPAR, TRevPAR, NRevPAR, GOPPAR, occupancy, competitive indices.
 */

import type { KpiDashboardInput, KpiDashboardOutput } from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates full KPI dashboard including industry-standard metrics.
 * CORE.md §4 + STR competitive indices (MPI/ARI/RGI).
 */
export function calculateKpiDashboard(input: KpiDashboardInput): KpiDashboardOutput {
  const roomRevenue = new Decimal(input.room_revenue);
  const totalRevenue = new Decimal(input.total_revenue);
  const available = new Decimal(input.available_rooms);
  const sold = new Decimal(input.rooms_sold);

  // ADR = Room Revenue / Rooms Sold
  const adr = sold.isZero() ? new Decimal(0) : roomRevenue.div(sold);

  // Occupancy % = Rooms Sold / Available Rooms × 100
  const occupancy = available.isZero() ? new Decimal(0) : sold.div(available).times(100);

  // RevPAR = Room Revenue / Available Rooms (or ADR × Occ%)
  const revpar = available.isZero() ? new Decimal(0) : roomRevenue.div(available);

  // TRevPAR = Total Revenue / Available Rooms (STR/USALI)
  const trevpar = available.isZero() ? new Decimal(0) : totalRevenue.div(available);

  const result: KpiDashboardOutput = {
    adr: adr.toDecimalPlaces(2).toNumber(),
    revpar: revpar.toDecimalPlaces(2).toNumber(),
    trevpar: trevpar.toDecimalPlaces(2).toNumber(),
    occupancy_percent: occupancy.toDecimalPlaces(2).toNumber(),
    avg_revenue_per_room: trevpar.toDecimalPlaces(2).toNumber(),
  };

  // NRevPAR = Net Revenue / Available Rooms
  if (input.net_revenue !== undefined) {
    result.nrevpar = available.isZero()
      ? 0
      : new Decimal(input.net_revenue).div(available).toDecimalPlaces(2).toNumber();
  }

  // GOPPAR = Gross Operating Profit / Available Rooms (USALI)
  if (input.gross_operating_profit !== undefined) {
    result.goppar = available.isZero()
      ? 0
      : new Decimal(input.gross_operating_profit).div(available).toDecimalPlaces(2).toNumber();
  }

  // Competitive indices (STR): MPI, ARI, RGI
  if (input.compset) {
    const compOcc = new Decimal(input.compset.occupancy);
    const compAdr = new Decimal(input.compset.adr);
    const compRevpar = new Decimal(input.compset.revpar);

    const mpi = compOcc.isZero() ? new Decimal(0) : occupancy.div(compOcc).times(100);
    const ari = compAdr.isZero() ? new Decimal(0) : adr.div(compAdr).times(100);
    const rgi = compRevpar.isZero() ? new Decimal(0) : revpar.div(compRevpar).times(100);

    result.competitive_indices = {
      occupancy_index: {
        value: mpi.toDecimalPlaces(2).toNumber(),
        label: "Market Penetration Index (MPI)",
        outperforming: mpi.greaterThan(100),
      },
      ari: {
        value: ari.toDecimalPlaces(2).toNumber(),
        label: "Average Rate Index (ARI)",
        outperforming: ari.greaterThan(100),
      },
      rgi: {
        value: rgi.toDecimalPlaces(2).toNumber(),
        label: "Revenue Generation Index (RGI)",
        outperforming: rgi.greaterThan(100),
      },
    };
  }

  return result;
}
