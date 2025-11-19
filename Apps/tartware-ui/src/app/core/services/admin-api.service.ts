import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminTenantMembership {
  tenant_id: string;
  tenant_name: string;
  role: string;
  is_active: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at?: string;
  version: string;
  tenants?: AdminTenantMembership[];
}

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly adminEndpoint = `${environment.apiUrl}/admin/users`;

  private readonly http = inject(HttpClient);

  fetchUsers(username: string, password: string, limit: number): Observable<AdminUser[]> {
    const basic = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({
      Authorization: `Basic ${basic}`,
    });
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<AdminUser[]>(this.adminEndpoint, { headers, params });
  }
}
