import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
import type { UserWithTenants } from '@tartware/schemas/core/users';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

type TenantListResponse = {
  tenants: TenantWithRelations[];
  count: number;
};

@Injectable({ providedIn: 'root' })
export class SystemAdminApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  listTenants(limit = 50): Observable<TenantListResponse> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<TenantListResponse>(`${this.api}/system/tenants`, { params });
  }

  listUsers(limit = 50, tenantId?: string): Observable<UserWithTenants[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (tenantId) {
      params = params.set('tenant_id', tenantId);
    }
    return this.http.get<UserWithTenants[]>(`${this.api}/system/users`, { params });
  }
}
