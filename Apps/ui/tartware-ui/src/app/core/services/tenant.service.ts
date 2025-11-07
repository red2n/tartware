import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant } from '../models/tenant.model';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly API_URL = 'http://localhost:3000/v1';

  constructor(private http: HttpClient) {}

  getTenants(limit: number = 50): Observable<Tenant[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<Tenant[]>(`${this.API_URL}/tenants`, { params });
  }

  getTenantById(tenantId: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.API_URL}/tenants/${tenantId}`);
  }
}
