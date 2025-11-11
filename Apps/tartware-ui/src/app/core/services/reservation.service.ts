import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Reservation } from '../models/reservation.model';

export interface ReservationFilters {
  propertyId?: string;
  status?: string;
  search?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getReservations(tenantId: string, filters: ReservationFilters = {}): Observable<Reservation[]> {
    let params = new HttpParams().set('tenant_id', tenantId);

    if (filters.propertyId && filters.propertyId !== 'all') {
      params = params.set('property_id', filters.propertyId);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations`, { params });
  }
}
