import { Injectable, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import type {
  SystemAdminBreakGlassResponse,
  SystemAdminLoginResponse,
  SystemAdminToken,
  ImpersonationToken,
  TenantContext,
} from '@tartware/schemas';

export type SystemAdminSessionToken = SystemAdminToken;
export type ImpersonationSessionToken = ImpersonationToken;
export type TenantSessionContext = TenantContext;

@Injectable({ providedIn: 'root' })
export class SystemSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'tart.system-admin.session';
  private readonly tenantKey = 'tart.system-admin.tenant-context';
  private readonly impersonationKey = 'tart.system-admin.impersonation';

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

      const rawImpersonation = localStorage.getItem(this.impersonationKey);
      if (rawImpersonation) {
        try {
          const parsed = JSON.parse(rawImpersonation) as ImpersonationToken | null;
          if (parsed?.accessToken) {
            const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : null;
            if (!expiresAt || expiresAt > Date.now()) {
              this.impersonationState.set(parsed);
            } else {
              localStorage.removeItem(this.impersonationKey);
            }
          }
        } catch (err) {
          console.error('Failed to parse impersonation session from localStorage:', err);
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

      effect(() => {
        const impersonation = this.impersonationState();
        try {
          if (impersonation) {
            localStorage.setItem(this.impersonationKey, JSON.stringify(impersonation));
          } else {
            localStorage.removeItem(this.impersonationKey);
          }
        } catch (err) {
          console.error('Failed to save impersonation session to localStorage:', err);
        }
      });
    }
  }

  setAdminSession(res: SystemAdminLoginResponse | SystemAdminBreakGlassResponse) {
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
    const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
    this.impersonationState.set({ ...token, expiresAt });
  }

  setTenantContext(context: TenantContext | null) {
    this.tenantContextState.set(context);
  }
}
