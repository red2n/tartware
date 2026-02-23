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

    localStorage.setItem('access_token', response.access_token);
    this._user.set({
      id: response.id,
      username: response.username,
      email: response.email,
      first_name: response.first_name,
      last_name: response.last_name,
    });
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
    const tenantId = localStorage.getItem('tenant_id');
    if (token) {
      if (tenantId) {
        this._tenantId.set(tenantId);
      }
    }
  }
}
