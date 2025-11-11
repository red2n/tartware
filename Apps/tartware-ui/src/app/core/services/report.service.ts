import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PerformanceReport } from '../models/report.model';

export interface ReportFilters {
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPerformanceReport(
    tenantId: string,
    filters: ReportFilters = {}
  ): Observable<PerformanceReport> {
    let params = new HttpParams().set('tenant_id', tenantId);

    if (filters.propertyId && filters.propertyId !== 'all') {
      params = params.set('property_id', filters.propertyId);
    }

    if (filters.startDate) {
      params = params.set('start_date', filters.startDate);
    }

    if (filters.endDate) {
      params = params.set('end_date', filters.endDate);
    }

    return this.http.get<PerformanceReport>(`${this.apiUrl}/reports/performance`, { params });
  }
}
