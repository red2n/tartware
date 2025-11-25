import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface PortalEngagementMetricDto {
  key: 'activeMembers' | 'statementViews' | 'paymentCompletion' | 'autoRouting';
  label: string;
  unit: 'count' | 'percent';
  current: number;
  previous: number;
}

export interface PortalRequestQueueDto {
  key: 'maintenance' | 'paymentDisputes' | 'documentSigning' | 'ownerInquiries';
  label: string;
  pending: number;
  avg_response_minutes: number | null;
  sla_percent: number | null;
}

export interface PortalChannelStatusDto {
  key: string;
  label: string;
  adoption_percent: number;
  monthly_volume: number;
  completion_rate: number;
  status: 'healthy' | 'watch';
}

export interface PortalExperienceResponseDto {
  engagement: PortalEngagementMetricDto[];
  requestQueues: PortalRequestQueueDto[];
  channels: PortalChannelStatusDto[];
}

export interface PortalExperienceQuery {
  tenantId: string;
  propertyId?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TenantOwnerPortalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getExperienceSummary(query: PortalExperienceQuery): Observable<PortalExperienceResponseDto> {
    const params = this.buildParams(query);
    return this.http.get<PortalExperienceResponseDto>(`${this.apiUrl}/portal/experience`, {
      params,
    });
  }

  private buildParams(query: PortalExperienceQuery): HttpParams {
    let params = new HttpParams().set('tenant_id', query.tenantId);
    if (query.propertyId && query.propertyId !== 'all') {
      params = params.set('property_id', query.propertyId);
    }
    return params;
  }
}
