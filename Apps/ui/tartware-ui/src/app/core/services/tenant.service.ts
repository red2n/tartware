import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Tenant } from '../models/tenant.model';

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  // Inject dependencies using modern inject() function
  private http = inject(HttpClient);

  private readonly API_URL = 'http://localhost:3000/v1';

  getTenants(limit = 50): Observable<Tenant[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<Tenant[]>(`${this.API_URL}/tenants`, { params });
  }

  getTenantById(tenantId: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.API_URL}/tenants/${tenantId}`);
  }
}
