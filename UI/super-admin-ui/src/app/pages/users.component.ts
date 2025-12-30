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
          <p>Fetches /v1/system/users with optional tenant filter.</p>
        </div>
      </header>

      <div class="controls">
        <form [formGroup]="form" (ngSubmit)="refresh()" class="filters" novalidate>
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

      <div class="table" role="table" aria-label="Users list">
        <div class="table__head" role="row">
          <div role="columnheader">User</div>
          <div role="columnheader">Email</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Tenants</div>
        </div>
        <div class="table__row" role="row" *ngFor="let u of users()">
          <div role="cell">
            <div class="title">{{ u.username }}</div>
            <div class="muted">{{ u.first_name }} {{ u.last_name }}</div>
          </div>
          <div role="cell">{{ u.email }}</div>
          <div role="cell">{{ u.is_active ? 'Active' : 'Inactive' }}</div>
          <div role="cell">
            <div class="chip" *ngFor="let t of u.tenants || []">
              <span class="chip__name">{{ t.tenant_name || t.tenant_id }}</span>
              <span class="chip__role">{{ t.role }}</span>
              <span class="chip__status" [class.inactive]="!t.is_active">{{ t.is_active ? 'active' : 'inactive' }}</span>
            </div>
          </div>
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
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    limit: 50,
    tenant_id: ['', [Validators.minLength(8)]],
  });

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const limit = this.form.value.limit ?? 50;
      const tenant = this.form.value.tenant_id?.trim() || undefined;
      const res = await firstValueFrom(this.api.listUsers(limit, tenant));
      this.users.set(res);
      this.statusMessage.set(`${res.length} users fetched`);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load users'));
    } finally {
      this.loading.set(false);
    }
  }
}
