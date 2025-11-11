import { z } from "zod";

import { query } from "../lib/db.js";
import {
  RESERVATION_SOURCE_SUMMARY_SQL,
  RESERVATION_STATUS_SUMMARY_SQL,
  REVENUE_SUMMARY_SQL,
} from "../sql/report-queries.js";
import { toNonNegativeInt, toNumberOrFallback } from "../utils/numbers.js";

export const ReservationStatusSummarySchema = z.object({
  confirmed: z.number().nonnegative().default(0),
  pending: z.number().nonnegative().default(0),
  checked_in: z.number().nonnegative().default(0),
  checked_out: z.number().nonnegative().default(0),
  cancelled: z.number().nonnegative().default(0),
  no_show: z.number().nonnegative().default(0),
});

export const RevenueSummarySchema = z.object({
  today: z.number().nonnegative(),
  monthToDate: z.number().nonnegative(),
  yearToDate: z.number().nonnegative(),
  currency: z.string(),
});

export const ReservationSourceSchema = z.object({
  source: z.string(),
  reservations: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
});

export const PerformanceReportSchema = z.object({
  statusSummary: ReservationStatusSummarySchema,
  revenueSummary: RevenueSummarySchema,
  topSources: z.array(ReservationSourceSchema),
});

export type PerformanceReport = z.infer<typeof PerformanceReportSchema>;

type ReservationStatusRow = {
  status: string | null;
  count: string | number | null;
};

type RevenueSummaryRow = {
  revenue_today: string | number | null;
  revenue_month: string | number | null;
  revenue_year: string | number | null;
};

type ReservationSourceRow = {
  source: string | null;
  reservations: string | number | null;
  total_amount: string | number | null;
};

const normalizeStatusKey = (
  value: string | null,
): keyof z.infer<typeof ReservationStatusSummarySchema> | null => {
  const key = value?.toLowerCase();
  switch (key) {
    case "confirmed":
    case "pending":
    case "checked_in":
    case "checked_out":
    case "cancelled":
    case "no_show":
      return key;
    default:
      return null;
  }
};

const normalizeSource = (value: string | null): string => {
  if (!value) {
    return "unknown";
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export const getPerformanceReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PerformanceReport> => {
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const startDate = options.startDate ?? null;
  const endDate = options.endDate ?? null;

  const [statusResult, revenueResult, sourcesResult] = await Promise.all([
    query<ReservationStatusRow>(RESERVATION_STATUS_SUMMARY_SQL, [
      tenantId,
      propertyId,
      startDate,
      endDate,
    ]),
    query<RevenueSummaryRow>(REVENUE_SUMMARY_SQL, [tenantId, propertyId]),
    query<ReservationSourceRow>(RESERVATION_SOURCE_SUMMARY_SQL, [
      tenantId,
      propertyId,
      startDate,
      endDate,
    ]),
  ]);

  const statusSummary = {
    confirmed: 0,
    pending: 0,
    checked_in: 0,
    checked_out: 0,
    cancelled: 0,
    no_show: 0,
  };

  for (const row of statusResult.rows) {
    const key = normalizeStatusKey(row.status);
    if (!key) {
      continue;
    }
    statusSummary[key] = (statusSummary[key] ?? 0) + toNonNegativeInt(row.count, 0);
  }

  const revenueRow = revenueResult.rows.at(0);
  const revenueSummary = {
    today: toNumberOrFallback(revenueRow?.revenue_today, 0),
    monthToDate: toNumberOrFallback(revenueRow?.revenue_month, 0),
    yearToDate: toNumberOrFallback(revenueRow?.revenue_year, 0),
    currency: "USD",
  };

  const topSources = sourcesResult.rows.map((row) =>
    ReservationSourceSchema.parse({
      source: normalizeSource(row.source),
      reservations: toNonNegativeInt(row.reservations, 0),
      total_amount: toNumberOrFallback(row.total_amount, 0),
    }),
  );

  return PerformanceReportSchema.parse({
    statusSummary,
    revenueSummary,
    topSources,
  });
};
