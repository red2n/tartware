import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Room } from '../models/room.model';

export interface RoomFilters {
  propertyId?: string;
  status?: string;
  housekeepingStatus?: string;
  search?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRooms(tenantId: string, filters: RoomFilters = {}): Observable<Room[]> {
    let params = new HttpParams().set('tenant_id', tenantId);

    if (filters.propertyId && filters.propertyId !== 'all') {
      params = params.set('property_id', filters.propertyId);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.housekeepingStatus && filters.housekeepingStatus !== 'all') {
      params = params.set('housekeeping_status', filters.housekeepingStatus);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<Room[]>(`${this.apiUrl}/rooms`, { params });
  }
}
