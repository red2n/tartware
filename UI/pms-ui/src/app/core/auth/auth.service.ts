import { computed, Injectable, signal } from '@angular/core';

import type { AuthMembership, LoginResponse } from '@tartware/schemas';

import { ApiService } from '../api/api.service';

export type UserInfo = Pick<LoginResponse, 'id' | 'username' | 'email' | 'first_name' | 'last_name'>;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<UserInfo | null>(null);
  private readonly _tenantId = signal<string | null>(null);
  private readonly _memberships = signal<AuthMembership[]>([]);

  readonly user = this._user.asReadonly();
  readonly tenantId = this._tenantId.asReadonly();
  readonly memberships = this._memberships.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private readonly api: ApiService) {
    this.restoreSession();
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/auth/login', { username, password });

    const userInfo: UserInfo = {
      id: response.id,
      username: response.username,
      email: response.email,
      first_name: response.first_name,
      last_name: response.last_name,
    };

    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('user_info', JSON.stringify(userInfo));
    this._user.set(userInfo);
    this._memberships.set(response.memberships ?? []);

    // Auto-select first tenant
    const firstTenant = response.memberships?.[0];
    if (firstTenant) {
      this._tenantId.set(firstTenant.tenant_id);
      localStorage.setItem('tenant_id', firstTenant.tenant_id);
    }

    return response;
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('user_info');
    this._user.set(null);
    this._tenantId.set(null);
    this._memberships.set([]);
  }

  selectTenant(tenantId: string): void {
    this._tenantId.set(tenantId);
    localStorage.setItem('tenant_id', tenantId);
  }

  private restoreSession(): void {
    const token = localStorage.getItem('access_token');
    if (!token || this.isTokenExpired(token)) {
      this.logout();
      return;
    }

    const stored = localStorage.getItem('user_info');
    if (stored) {
      try {
        this._user.set(JSON.parse(stored) as UserInfo);
      } catch {
        this.logout();
        return;
      }
    }

    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId) {
      this._tenantId.set(tenantId);
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (typeof payload.exp !== 'number') return true;
      // expired if less than 30s remaining
      return payload.exp * 1000 < Date.now() + 30_000;
    } catch {
      return true;
    }
  }
}
