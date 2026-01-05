import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { UserWithTenants } from '@tartware/schemas/core/users';
import { firstValueFrom } from 'rxjs';
import { SystemAdminApiService } from '../services/system-admin-api.service';
import { extractErrorMessage } from '../services/error-utils';

@Component({
  standalone: true,
  selector: 'app-users',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="panel" aria-label="Users">
      <header class="panel__head">
        <div>
          <h1>Users</h1>
          <p>Manage system users and tenant associations.</p>
        </div>
        <button type="button" class="primary" (click)="showCreateForm.set(!showCreateForm())">
          {{ showCreateForm() ? 'Cancel' : '+ Create User' }}
        </button>
      </header>

      <!-- Create User Form -->
      <div class="form-panel" *ngIf="showCreateForm()">
        <h2>Create New User</h2>
        <form [formGroup]="createForm" (ngSubmit)="createUser()" class="create-form" novalidate>
          <div class="form-row">
            <label>
              Username *
              <input type="text" formControlName="username" placeholder="johndoe" required />
            </label>
            <label>
              Email *
              <input type="email" formControlName="email" placeholder="john@example.com" required />
            </label>
          </div>
          <div class="form-row">
            <label>
              First Name *
              <input type="text" formControlName="first_name" placeholder="John" required />
            </label>
            <label>
              Last Name *
              <input type="text" formControlName="last_name" placeholder="Doe" required />
            </label>
          </div>
          <div class="form-row">
            <label>
              Password *
              <input type="password" formControlName="password" placeholder="Min 8 characters" required />
            </label>
            <label>
              Phone
              <input type="tel" formControlName="phone" placeholder="+1234567890" />
            </label>
          </div>
          <div class="form-row">
            <label>
              Tenant ID (optional)
              <input type="text" formControlName="tenant_id" placeholder="UUID" />
            </label>
            <label>
              Role (if tenant provided)
              <select formControlName="role">
                <option value="">Select role</option>
                <option value="VIEWER">Viewer</option>
                <option value="STAFF">Staff</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary" [disabled]="createForm.invalid || creating()">
              {{ creating() ? 'Creating...' : 'Create User' }}
            </button>
            <button type="button" class="ghost" (click)="resetCreateForm()">Reset</button>
          </div>
        </form>
        <div class="banner banner--success" *ngIf="createSuccessMessage()">
          {{ createSuccessMessage() }}
        </div>
        <div class="banner banner--error" *ngIf="createErrorMessage()">
          {{ createErrorMessage() }}
        </div>
      </div>

      <!-- Filters -->
      <div class="controls">
        <form [formGroup]="filterForm" (ngSubmit)="refresh()" class="filters" novalidate>
          <label>
            Page size
            <input type="number" formControlName="limit" min="1" max="500" />
          </label>
          <label>
            Tenant ID (optional)
            <input type="text" formControlName="tenant_id" placeholder="tenant uuid" />
          </label>
          <button type="submit" class="ghost" [disabled]="loading()">Reload</button>
        </form>
        <div class="status" *ngIf="statusMessage()">{{ statusMessage() }}</div>
        <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      </div>

      <!-- Users Table -->
      <div class="table" role="table" aria-label="Users list">
        <div class="table__head" role="row">
          <div role="columnheader">User</div>
          <div role="columnheader">Email</div>
          <div role="columnheader">Phone</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Tenants</div>
        </div>
        <div class="table__row" role="row" *ngFor="let u of users()">
          <div role="cell">
            <div class="title">{{ u.username }}</div>
            <div class="muted">{{ u.first_name }} {{ u.last_name }}</div>
          </div>
          <div role="cell">{{ u.email }}</div>
          <div role="cell">{{ u.phone || '—' }}</div>
          <div role="cell">
            <span class="badge" [class.badge--success]="u.is_active" [class.badge--inactive]="!u.is_active">
              {{ u.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div role="cell">
            <div class="chip-list">
              <div class="chip" *ngFor="let t of u.tenants || []">
                <span class="chip__name">{{ t.tenant_name || t.tenant_id }}</span>
                <span class="chip__role">{{ t.role }}</span>
                <span class="chip__status" [class.inactive]="!t.is_active">
                  {{ t.is_active ? 'active' : 'inactive' }}
                </span>
              </div>
              <span *ngIf="!u.tenants || u.tenants.length === 0" class="muted">No tenants</span>
            </div>
          </div>
        </div>
        <div class="empty-state" *ngIf="users().length === 0 && !loading()">
          <p>No users found. Create your first user above.</p>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit {
  private readonly api = inject(SystemAdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<UserWithTenants[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');
  readonly createErrorMessage = signal('');
  readonly createSuccessMessage = signal('');
  readonly showCreateForm = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    limit: 50,
    tenant_id: ['', [Validators.minLength(8)]],
  });

  readonly createForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    first_name: ['', [Validators.required, Validators.minLength(1)]],
    last_name: ['', [Validators.required, Validators.minLength(1)]],
    phone: [''],
    tenant_id: ['', [Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)]],
    role: [''],
  });

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const limit = this.filterForm.value.limit ?? 50;
      const tenant = this.filterForm.value.tenant_id?.trim() || undefined;
      const res = await firstValueFrom(this.api.listUsers(limit, tenant));
      this.users.set(res);
      this.statusMessage.set(`${res.length} users fetched`);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load users'));
    } finally {
      this.loading.set(false);
    }
  }

  async createUser() {
    if (this.createForm.invalid) return;

    this.creating.set(true);
    this.createErrorMessage.set('');
    this.createSuccessMessage.set('');

    try {
      const formValue = this.createForm.value;
      const data = {
        username: formValue.username!,
        email: formValue.email!,
        password: formValue.password!,
        first_name: formValue.first_name!,
        last_name: formValue.last_name!,
        phone: formValue.phone || undefined,
        tenant_id: formValue.tenant_id || undefined,
        role: (formValue.role as any) || undefined,
      };

      const result = await firstValueFrom(this.api.createUser(data));
      this.createSuccessMessage.set(result.message);
      this.resetCreateForm();
      void this.refresh(); // Reload the list

      // Auto-close form after 2 seconds
      setTimeout(() => {
        this.showCreateForm.set(false);
        this.createSuccessMessage.set('');
      }, 2000);
    } catch (err) {
      this.createErrorMessage.set(extractErrorMessage(err, 'Failed to create user'));
    } finally {
      this.creating.set(false);
    }
  }

  resetCreateForm() {
    this.createForm.reset({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      tenant_id: '',
      role: '',
    });
    this.createErrorMessage.set('');
    this.createSuccessMessage.set('');
  }
}
