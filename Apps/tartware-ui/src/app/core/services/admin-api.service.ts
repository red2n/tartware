import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AdminUser,
  SystemAdminLoginRequest,
  SystemAdminLoginResponse,
  SystemAdminTenantResponse,
  SystemImpersonationRequest,
  SystemImpersonationResponse,
} from '../schemas/system-admin.schema';

@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly baseEndpoint = `${environment.apiUrl}/system`;
  private readonly http = inject(HttpClient);

  loginSystemAdministrator(payload: SystemAdminLoginRequest): Observable<SystemAdminLoginResponse> {
    return this.http.post<SystemAdminLoginResponse>(`${this.baseEndpoint}/auth/login`, payload);
  }

  fetchSystemUsers(
    token: string,
    options: { limit: number; tenantId?: string | null }
  ): Observable<AdminUser[]> {
    let params = new HttpParams().set('limit', String(options.limit));
    if (options.tenantId) {
      params = params.set('tenant_id', options.tenantId);
    }
    return this.http.get<AdminUser[]>(`${this.baseEndpoint}/users`, {
      headers: this.authHeaders(token),
      params,
    });
  }

  fetchSystemTenants(token: string, limit: number): Observable<SystemAdminTenantResponse> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<SystemAdminTenantResponse>(`${this.baseEndpoint}/tenants`, {
      headers: this.authHeaders(token),
      params,
    });
  }

  startImpersonation(
    token: string,
    payload: SystemImpersonationRequest
  ): Observable<SystemImpersonationResponse> {
    return this.http.post<SystemImpersonationResponse>(
      `${this.baseEndpoint}/impersonate`,
      payload,
      { headers: this.authHeaders(token) }
    );
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
