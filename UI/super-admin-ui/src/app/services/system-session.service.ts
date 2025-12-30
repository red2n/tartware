import { Injectable, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import type { AdminUser, BreakGlassResponse, LoginResponse } from './admin-auth.service';

export type SystemAdminToken = {
  accessToken: string;
  tokenType: 'Bearer';
  scope: 'SYSTEM_ADMIN';
  sessionId: string;
  expiresIn: number;
  admin?: AdminUser;
};

export type ImpersonationToken = {
  accessToken: string;
  tokenType: 'Bearer';
  scope: 'TENANT_IMPERSONATION';
  expiresIn: number;
};

export type TenantContext = {
  tenantId: string;
  propertyId?: string;
};

@Injectable({ providedIn: 'root' })
export class SystemSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'tart.system-admin.session';
  private readonly tenantKey = 'tart.system-admin.tenant-context';

  private readonly adminState: WritableSignal<SystemAdminToken | null> = signal(null);
  private readonly impersonationState: WritableSignal<ImpersonationToken | null> = signal(null);
  private readonly tenantContextState: WritableSignal<TenantContext | null> = signal(null);

  readonly adminSession: Signal<SystemAdminToken | null> = computed(() => this.adminState());
  readonly impersonationSession: Signal<ImpersonationToken | null> = computed(() => this.impersonationState());
  readonly isAuthenticated: Signal<boolean> = computed(() => Boolean(this.adminState()));
  readonly tenantContext: Signal<TenantContext | null> = computed(() => this.tenantContextState());

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SystemAdminToken | null;
          if (parsed && parsed.accessToken && parsed.scope === 'SYSTEM_ADMIN') {
            this.adminState.set(parsed);
          }
        } catch (err) {
          console.error('Failed to parse admin session from localStorage:', err);
        }
      }

      const rawTenant = localStorage.getItem(this.tenantKey);
      if (rawTenant) {
        try {
          const parsed = JSON.parse(rawTenant) as TenantContext | null;
          if (parsed?.tenantId) {
            this.tenantContextState.set(parsed);
          }
        } catch (err) {
          console.error('Failed to parse tenant context from localStorage:', err);
        }
      }

      effect(() => {
        const admin = this.adminState();
        try {
          if (admin) {
            localStorage.setItem(this.storageKey, JSON.stringify(admin));
          } else {
            localStorage.removeItem(this.storageKey);
          }
        } catch (err) {
          console.error('Failed to save admin session to localStorage:', err);
        }
      });

      effect(() => {
        const tenant = this.tenantContextState();
        try {
          if (tenant) {
            localStorage.setItem(this.tenantKey, JSON.stringify(tenant));
          } else {
            localStorage.removeItem(this.tenantKey);
          }
        } catch (err) {
          console.error('Failed to save tenant context to localStorage:', err);
        }
      });
    }
  }

  setAdminSession(res: LoginResponse | BreakGlassResponse) {
    this.adminState.set({
      accessToken: res.access_token,
      tokenType: res.token_type,
      scope: res.scope,
      expiresIn: res.expires_in,
      sessionId: res.session_id,
      admin: res.admin,
    });
  }

  clearAdminSession() {
    this.adminState.set(null);
    this.impersonationState.set(null);
    this.tenantContextState.set(null);
  }

  setImpersonationSession(token: ImpersonationToken) {
    this.impersonationState.set(token);
  }

  setTenantContext(context: TenantContext | null) {
    this.tenantContextState.set(context);
  }
}
