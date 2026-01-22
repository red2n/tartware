import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  AdminUser as SchemaAdminUser,
  SystemAdminBreakGlassRequest,
  SystemAdminBreakGlassResponse,
  SystemAdminImpersonationRequest,
  SystemAdminImpersonationResponse,
  SystemAdminLoginRequest,
  SystemAdminLoginResponse,
} from '@tartware/schemas';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

export type LoginRequest = SystemAdminLoginRequest;
export type LoginResponse = SystemAdminLoginResponse;
export type BreakGlassRequest = SystemAdminBreakGlassRequest;
export type BreakGlassResponse = SystemAdminBreakGlassResponse;
export type ImpersonationRequest = SystemAdminImpersonationRequest;
export type ImpersonationResponse = SystemAdminImpersonationResponse;
export type AdminUser = SchemaAdminUser;

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
