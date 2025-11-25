import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface EnterpriseIntegrationStatusDto {
  name: string;
  type: string | null;
  entity: string | null;
  status: 'healthy' | 'warning';
  latency_ms: number | null;
  last_sync_at: string | null;
  next_sync_eta_minutes: number | null;
}

export interface EnterpriseApiUsageDto {
  api_calls_24h: number;
  success_rate: number;
  p95_latency_ms: number | null;
  webhook_calls_24h: number;
}

export interface EnterpriseSecurityEventDto {
  title: string;
  timestamp: string | null;
  action: string;
  severity: 'info' | 'warning';
}

export interface EnterpriseInsightsDto {
  integrations: EnterpriseIntegrationStatusDto[];
  apiUsage: EnterpriseApiUsageDto;
  securityLog: EnterpriseSecurityEventDto[];
}

export interface EnterpriseInsightsQuery {
  tenantId: string;
  propertyId?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class EnterpriseApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getInsights(query: EnterpriseInsightsQuery): Observable<EnterpriseInsightsDto> {
    const params = this.buildParams(query);
    return this.http.get<EnterpriseInsightsDto>(`${this.apiUrl}/enterprise/insights`, {
      params,
    });
  }

  private buildParams(query: EnterpriseInsightsQuery): HttpParams {
    let params = new HttpParams().set('tenant_id', query.tenantId);
    if (query.propertyId && query.propertyId !== 'all') {
      params = params.set('property_id', query.propertyId);
    }
    return params;
  }
}
