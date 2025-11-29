import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import type {
  AdminTenantMembership,
  AdminUser,
  SystemAdminLoginResponse,
  SystemImpersonationResponse,
  SystemTenantOverview,
} from '../../core/schemas/system-admin.schema';
import { AdminApiService } from '../../core/services/admin-api.service';

const MFA_PATTERN = /^(\d{6})?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-admin-users',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DecimalPipe],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);

  readonly loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(16)]],
    mfa_code: ['', [Validators.pattern(MFA_PATTERN)]],
  });

  readonly userFilterForm = this.fb.nonNullable.group({
    limit: [50, [Validators.required, Validators.min(1), Validators.max(500)]],
    tenant_id: ['', [Validators.pattern(new RegExp(`^$|${UUID_PATTERN.source}$`, 'i'))]],
  });

  readonly impersonationForm = this.fb.nonNullable.group({
    tenant_id: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    user_id: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(10)]],
    ticket_id: ['', [Validators.required, Validators.minLength(5)]],
  });

  readonly deviceFingerprint = signal(this.ensureDeviceFingerprint());

  readonly loginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly session = signal<SystemAdminLoginResponse | null>(null);

  readonly tenants = signal<SystemTenantOverview[]>([]);
  readonly tenantsLoading = signal(false);
  readonly tenantsError = signal<string | null>(null);

  readonly users = signal<AdminUser[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);

  readonly impersonationToken = signal<SystemImpersonationResponse | null>(null);
  readonly impersonationLoading = signal(false);
  readonly impersonationError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => Boolean(this.session()));

  handleLogin(): void {
    if (this.loginForm.invalid || this.loginLoading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.loginForm.getRawValue(),
      device_fingerprint: this.deviceFingerprint(),
    };

    this.loginLoading.set(true);
    this.loginError.set(null);
    this.adminApi
      .loginSystemAdministrator(payload)
      .pipe(finalize(() => this.loginLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.session.set(response);
          this.loginError.set(null);
          this.impersonationToken.set(null);
          this.loadTenants();
          this.loadUsers();
        },
        error: (error) => {
          const message =
            error?.error?.message ??
            error?.message ??
            'Unable to authenticate system administrator.';
          this.loginError.set(message);
          this.session.set(null);
          this.tenants.set([]);
          this.users.set([]);
        },
      });
  }

  logout(): void {
    this.session.set(null);
    this.users.set([]);
    this.tenants.set([]);
    this.impersonationToken.set(null);
    this.loginForm.reset({
      username: 'sysadmin',
      password: '',
      mfa_code: '',
    });
  }

  loadTenants(): void {
    const session = this.requireSession();
    this.tenantsLoading.set(true);
    this.tenantsError.set(null);
    this.adminApi
      .fetchSystemTenants(session.access_token, 25)
      .pipe(finalize(() => this.tenantsLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.tenants.set(response.tenants);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Unable to load tenants.';
          this.tenantsError.set(message);
        },
      });
  }

  loadUsers(): void {
    const session = this.requireSession();
    if (this.userFilterForm.invalid) {
      this.userFilterForm.markAllAsTouched();
      return;
    }

    const { limit, tenant_id } = this.userFilterForm.getRawValue();
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.adminApi
      .fetchSystemUsers(session.access_token, {
        limit,
        tenantId: tenant_id?.trim() ? tenant_id.trim() : null,
      })
      .pipe(finalize(() => this.usersLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.users.set(response);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Unable to load users.';
          this.usersError.set(message);
        },
      });
  }

  startImpersonation(): void {
    const session = this.requireSession();
    if (this.impersonationForm.invalid) {
      this.impersonationForm.markAllAsTouched();
      return;
    }
    const payload = this.impersonationForm.getRawValue();
    this.impersonationLoading.set(true);
    this.impersonationError.set(null);
    this.adminApi
      .startImpersonation(session.access_token, payload)
      .pipe(finalize(() => this.impersonationLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.impersonationToken.set(response);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Unable to start impersonation session.';
          this.impersonationError.set(message);
          this.impersonationToken.set(null);
        },
      });
  }

  prefillImpersonation(user: AdminUser): void {
    const firstTenant = user.tenants?.[0];
    this.impersonationForm.patchValue({
      user_id: user.id,
      tenant_id: firstTenant?.tenant_id ?? '',
      reason: '',
      ticket_id: '',
    });
  }

  trackUser(index: number, user: AdminUser): string {
    return user.id ?? String(index);
  }

  trackTenant(_index: number, tenant: SystemTenantOverview): string {
    return tenant.id;
  }

  trackMembership(_index: number, membership: AdminTenantMembership): string {
    return `${membership.tenant_id}:${membership.role}`;
  }

  copyToClipboard(value: string): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(value).catch(() => {
      // Clipboard failures are ignored to keep the UI responsive.
    });
  }

  private requireSession(): SystemAdminLoginResponse {
    const session = this.session();
    if (!session) {
      throw new Error('System administrator session not established');
    }
    return session;
  }

  private ensureDeviceFingerprint(): string {
    const storageKey = 'tartware:device-fingerprint';
    if (typeof window === 'undefined') {
      return 'dev-device';
    }
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const entropy =
      window.crypto?.randomUUID?.() ??
      `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const generated = `${entropy}-sys`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  }
}
