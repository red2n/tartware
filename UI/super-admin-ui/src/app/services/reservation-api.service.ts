import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { Reservations } from '@tartware/schemas/bookings/reservations';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class ReservationApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  listReservations(options: {
    tenantId: string;
    propertyId?: string;
    status?: string;
    search?: string;
    limit?: number;
  }): Observable<Reservations[]> {
    let params = new HttpParams().set('tenant_id', options.tenantId);
    if (options.propertyId) params = params.set('property_id', options.propertyId);
    if (options.status) params = params.set('status', options.status);
    if (options.search) params = params.set('search', options.search);
    if (options.limit) params = params.set('limit', options.limit.toString());

    return this.http.get<Reservations[]>(`${this.api}/reservations`, { params });
  }
}
