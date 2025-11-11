import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Guest } from '../models/guest.model';

interface GuestApiResponse extends Guest {
  version: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuestService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getGuests(tenantId: string, limit = 100): Observable<Guest[]> {
    const params = new HttpParams().set('tenant_id', tenantId).set('limit', limit.toString());

    return this.http
      .get<GuestApiResponse[]>(`${this.apiUrl}/guests`, { params })
      .pipe(map((guests) => guests.map((guest) => ({ ...guest }))));
  }
}
