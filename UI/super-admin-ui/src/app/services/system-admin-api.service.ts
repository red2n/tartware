import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
import type { UserWithTenants } from '@tartware/schemas/core/users';
import { TenantTypeEnum } from '@tartware/schemas/enums';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

type TenantListResponse = {
  tenants: TenantWithRelations[];
  count: number;
};

type CreateUserRequest = {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tenant_id?: string;
  role?: 'VIEWER' | 'STAFF' | 'MANAGER' | 'ADMIN' | 'OWNER';
};

type CreateUserResponse = {
  id: string;
  username: string;
  email: string;
  message: string;
};

type TenantType = (typeof TenantTypeEnum.options)[number];

type CreateTenantRequest = {
  name: string;
  slug: string;
  type?: TenantType;
  email: string;
  phone?: string;
  website?: string;
};

type CreateTenantResponse = {
  id: string;
  name: string;
  slug: string;
  message: string;
};

@Injectable({ providedIn: 'root' })
export class SystemAdminApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  listTenants(limit = 50): Observable<TenantListResponse> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<TenantListResponse>(`${this.api}/system/tenants`, { params });
  }

  createTenant(data: CreateTenantRequest): Observable<CreateTenantResponse> {
    return this.http.post<CreateTenantResponse>(`${this.api}/system/tenants`, data);
  }

  listUsers(limit = 50, tenantId?: string): Observable<UserWithTenants[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (tenantId) {
      params = params.set('tenant_id', tenantId);
    }
    return this.http.get<UserWithTenants[]>(`${this.api}/system/users`, { params });
  }

  createUser(data: CreateUserRequest): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(`${this.api}/system/users`, data);
  }
}
