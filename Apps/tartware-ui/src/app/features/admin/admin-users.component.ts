import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  AdminApiService,
  type AdminTenantMembership,
  type AdminUser,
} from '../../core/services/admin-api.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);

  readonly form = this.fb.nonNullable.group({
    username: ['admin', [Validators.required]],
    password: ['', [Validators.required]],
    limit: [100, [Validators.required, Validators.min(1), Validators.max(500)]],
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly isAuthenticated = computed(() => this.users().length > 0 && !this.error());

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password, limit } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.adminApi
      .fetchUsers(username, password, limit)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.users.set(response);
        },
        error: (err) => {
          const message = err?.message ?? 'Invalid admin credentials.';
          this.error.set(message);
          this.users.set([]);
        },
      });
  }

  trackUser(index: number, user: AdminUser): string {
    return user.id ?? String(index);
  }

  trackTenant(_index: number, tenant: AdminTenantMembership): string {
    return tenant.tenant_id;
  }
}
