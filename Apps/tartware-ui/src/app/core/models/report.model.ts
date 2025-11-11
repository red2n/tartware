export interface ReservationStatusSummary {
  confirmed: number;
  pending: number;
  checked_in: number;
  checked_out: number;
  cancelled: number;
  no_show: number;
}

export interface RevenueSummary {
  today: number;
  monthToDate: number;
  yearToDate: number;
  currency: string;
}

export interface ReservationSourceSummary {
  source: string;
  reservations: number;
  total_amount: number;
}

export interface PerformanceReport {
  statusSummary: ReservationStatusSummary;
  revenueSummary: RevenueSummary;
  topSources: ReservationSourceSummary[];
}
