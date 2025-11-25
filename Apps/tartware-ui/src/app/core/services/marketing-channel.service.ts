import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ChannelPerformanceDto {
  id: string;
  name: string;
  type: string | null;
  average_daily_rate: number | null;
  pickup_change_percent: number | null;
  next_sync_eta_minutes: number | null;
  last_sync_at: string | null;
  status: 'synced' | 'attention';
  total_bookings: number;
  total_revenue: number;
}

export interface CampaignSummaryDto {
  id: string;
  name: string;
  audience: string | null;
  status: string;
  click_through_rate: number | null;
  budget_amount: number | null;
  actual_spend: number | null;
  budget_currency: string | null;
  budget_utilization_percent: number | null;
}

export interface LeadSourceSummaryDto {
  source: string;
  leads: number;
  conversion_rate: number | null;
  average_booking_value: number | null;
  quality: 'great' | 'ok' | 'watch';
}

export interface MarketingQuery {
  tenantId: string;
  propertyId?: string | null;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MarketingChannelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getChannelPerformance(query: MarketingQuery): Observable<ChannelPerformanceDto[]> {
    const params = this.buildParams(query);
    return this.http.get<ChannelPerformanceDto[]>(`${this.apiUrl}/marketing/channels`, {
      params,
    });
  }

  getCampaignSummaries(query: MarketingQuery): Observable<CampaignSummaryDto[]> {
    const params = this.buildParams(query);
    return this.http.get<CampaignSummaryDto[]>(`${this.apiUrl}/marketing/campaigns`, {
      params,
    });
  }

  getLeadSources(query: MarketingQuery): Observable<LeadSourceSummaryDto[]> {
    const params = this.buildParams(query);
    return this.http.get<LeadSourceSummaryDto[]>(`${this.apiUrl}/marketing/lead-sources`, {
      params,
    });
  }

  private buildParams(query: MarketingQuery): HttpParams {
    let params = new HttpParams()
      .set('tenant_id', query.tenantId)
      .set('limit', (query.limit ?? 8).toString());

    if (query.propertyId && query.propertyId !== 'all') {
      params = params.set('property_id', query.propertyId);
    }

    return params;
  }
}
