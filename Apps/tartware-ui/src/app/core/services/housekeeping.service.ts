import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { HousekeepingTask } from '../models/housekeeping.model';

export interface HousekeepingFilters {
  propertyId?: string;
  status?: string;
  scheduledDate?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class HousekeepingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTasks(tenantId: string, filters: HousekeepingFilters = {}): Observable<HousekeepingTask[]> {
    let params = new HttpParams().set('tenant_id', tenantId);

    if (filters.propertyId && filters.propertyId !== 'all') {
      params = params.set('property_id', filters.propertyId);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.scheduledDate) {
      params = params.set('scheduled_date', filters.scheduledDate);
    }

    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<HousekeepingTask[]>(`${this.apiUrl}/housekeeping/tasks`, { params });
  }
}
