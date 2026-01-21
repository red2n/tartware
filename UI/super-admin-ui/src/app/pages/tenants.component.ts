import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
import { TenantTypeEnum } from '@tartware/schemas/enums';
import { firstValueFrom } from 'rxjs';
import { SystemAdminApiService } from '../services/system-admin-api.service';
import { extractErrorMessage } from '../services/error-utils';

@Component({
  standalone: true,
  selector: 'app-tenants',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="panel" aria-label="Tenants">
      <header class="panel__head">
        <div>
          <h1>Tenants</h1>
          <p>Manage platform tenants and properties.</p>
        </div>
        <button type="button" class="primary" (click)="showCreateForm.set(!showCreateForm())">
          {{ showCreateForm() ? 'Cancel' : '+ Create Tenant' }}
        </button>
      </header>

      <!-- Create Tenant Form -->
      <div class="form-panel" *ngIf="showCreateForm()">
        <h2>Create New Tenant</h2>
        <form [formGroup]="createForm" (ngSubmit)="createTenant()" class="create-form" novalidate>
          <div class="form-row">
            <label>
              Tenant Name *
              <input type="text" formControlName="name" placeholder="Acme Hotels" required />
            </label>
            <label>
              Slug * (lowercase, hyphens only)
              <input type="text" formControlName="slug" placeholder="acme-hotels" required />
            </label>
          </div>
          <div class="form-row">
            <label>
              Type
              <select formControlName="type">
                <option *ngFor="let type of tenantTypes" [value]="type">
                  {{ formatTenantType(type) }}
                </option>
              </select>
            </label>
            <label>
              Email *
              <input type="email" formControlName="email" placeholder="contact@acme.com" required />
            </label>
          </div>
          <div class="form-row">
            <label>
              Phone
              <input type="tel" formControlName="phone" placeholder="+1234567890" />
            </label>
            <label>
              Website
              <input type="url" formControlName="website" placeholder="https://acme.com" />
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary" [disabled]="createForm.invalid || creating()">
              {{ creating() ? 'Creating...' : 'Create Tenant' }}
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
            <input type="number" formControlName="limit" min="1" max="200" />
          </label>
          <button type="submit" class="ghost" [disabled]="loading()">Reload</button>
        </form>
        <div class="status" *ngIf="statusMessage()">{{ statusMessage() }}</div>
        <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      </div>

      <!-- Tenants Table -->
      <div class="table" role="table" aria-label="Tenants list">
        <div class="table__head" role="row">
          <div role="columnheader">Tenant</div>
          <div role="columnheader">Contact</div>
          <div role="columnheader">Type</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Properties</div>
          <div role="columnheader">Users</div>
        </div>
        <div class="table__row" role="row" *ngFor="let t of tenants()">
          <div role="cell">
            <div class="title">{{ t.name }}</div>
            <div class="muted">{{ t.slug }}</div>
            <div class="muted small">{{ t.id }}</div>
          </div>
          <div role="cell">
            <div>{{ t.email }}</div>
            <div class="muted">{{ t.phone || '—' }}</div>
            <a *ngIf="t.website" [href]="t.website" target="_blank" rel="noopener" class="link">
              {{ t.website }}
            </a>
          </div>
          <div role="cell">
            <span class="badge">{{ t.type }}</span>
          </div>
          <div role="cell">
            <span
              class="badge"
              [class.badge--success]="t.status === 'ACTIVE'"
              [class.badge--warning]="t.status === 'SUSPENDED'"
              [class.badge--error]="t.status === 'INACTIVE'">
              {{ t.status }}
            </span>
          </div>
          <div role="cell">
            <div class="stat">
              <span class="stat__value">{{ t.property_count ?? 0 }}</span>
              <span class="stat__label">total</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ t.active_properties ?? 0 }}</span>
              <span class="stat__label">active</span>
            </div>
          </div>
          <div role="cell">{{ t.user_count ?? '—' }}</div>
        </div>
        <div class="empty-state" *ngIf="tenants().length === 0 && !loading()">
          <p>No tenants found. Create your first tenant above.</p>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./tenants.component.scss'],
})
export class TenantsComponent implements OnInit {
  private readonly api = inject(SystemAdminApiService);
  private readonly fb = inject(FormBuilder);

  readonly tenants = signal<TenantWithRelations[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');
  readonly createErrorMessage = signal('');
  readonly createSuccessMessage = signal('');
  readonly showCreateForm = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    limit: 50,
  });

  readonly tenantTypes = TenantTypeEnum.options;
  private readonly defaultTenantType: (typeof TenantTypeEnum.options)[number] =
    this.tenantTypes[0] ?? 'INDEPENDENT';

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(200)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    type: [this.defaultTenantType],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    website: ['', [Validators.pattern(/^https?:\/\/.+/)]],
  });

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const limit = this.filterForm.value.limit ?? 50;
      const res = await firstValueFrom(this.api.listTenants(limit));
      this.tenants.set(res.tenants);
      this.statusMessage.set(`${res.count} tenants fetched`);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load tenants'));
    } finally {
      this.loading.set(false);
    }
  }

  async createTenant() {
    if (this.createForm.invalid) return;

    this.creating.set(true);
    this.createErrorMessage.set('');
    this.createSuccessMessage.set('');

    try {
      const formValue = this.createForm.value;
      const data = {
        name: formValue.name!,
        slug: formValue.slug!,
        type: (formValue.type ?? this.defaultTenantType) as (typeof TenantTypeEnum.options)[number],
        email: formValue.email!,
        phone: formValue.phone || undefined,
        website: formValue.website || undefined,
      };

      const result = await firstValueFrom(this.api.createTenant(data));
      this.createSuccessMessage.set(result.message);
      this.resetCreateForm();
      void this.refresh(); // Reload the list

      // Auto-close form after 2 seconds
      setTimeout(() => {
        this.showCreateForm.set(false);
        this.createSuccessMessage.set('');
      }, 2000);
    } catch (err) {
      this.createErrorMessage.set(extractErrorMessage(err, 'Failed to create tenant'));
    } finally {
      this.creating.set(false);
    }
  }

  formatTenantType(value: string): string {
    return titleize(value);
  }

  resetCreateForm() {
    this.createForm.reset({
      name: '',
      slug: '',
      type: this.defaultTenantType,
      email: '',
      phone: '',
      website: '',
    });
    this.createErrorMessage.set('');
    this.createSuccessMessage.set('');
  }
}

function titleize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}
