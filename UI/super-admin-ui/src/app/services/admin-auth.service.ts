import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

export interface LoginRequest {
  username: string;
  password: string;
  mfa_code?: string | null;
  device_fingerprint: string;
}

export interface AdminUser {
  id?: string;
  username?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: 'SYSTEM_ADMIN';
  session_id: string;
  admin?: AdminUser;
}

export interface BreakGlassRequest {
  username: string;
  break_glass_code: string;
  reason: string;
  ticket_id?: string | null;
  device_fingerprint: string;
}

export interface BreakGlassResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: 'SYSTEM_ADMIN';
  session_id: string;
  admin: AdminUser;
}

export interface ImpersonationRequest {
  tenant_id: string;
  user_id: string;
  reason: string;
  ticket_id: string;
}

export interface ImpersonationResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: 'TENANT_IMPERSONATION';
  expires_in: number;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  login(body: LoginRequest): Observable<LoginResponse> {
    const payload: LoginRequest = { ...body };
    if (typeof payload.mfa_code === 'string') {
      const trimmed = payload.mfa_code.trim();
      if (trimmed.length === 0) {
        delete (payload as Partial<LoginRequest>).mfa_code;
      } else {
        payload.mfa_code = trimmed;
      }
    }
    return this.http.post<LoginResponse>(`${this.api}/system/auth/login`, payload);
  }

  breakGlass(body: BreakGlassRequest): Observable<BreakGlassResponse> {
    return this.http.post<BreakGlassResponse>(`${this.api}/system/auth/break-glass`, body);
  }

  startImpersonation(body: ImpersonationRequest): Observable<ImpersonationResponse> {
    return this.http.post<ImpersonationResponse>(`${this.api}/system/impersonate`, body);
  }
}
