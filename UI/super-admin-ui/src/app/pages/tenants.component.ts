import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
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
          <p>Fetches /v1/system/tenants (SYSTEM_ADMIN scope).</p>
        </div>
      </header>

      <div class="controls">
        <form [formGroup]="form" (ngSubmit)="refresh()" class="filters" novalidate>
          <label>
            Page size
            <input type="number" formControlName="limit" min="1" max="200" />
          </label>
          <button type="submit" class="ghost" [disabled]="loading()">Reload</button>
        </form>
        <div class="status" *ngIf="statusMessage()">{{ statusMessage() }}</div>
        <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      </div>

      <div class="table" role="table" aria-label="Tenants list">
        <div class="table__head" role="row">
          <div role="columnheader">Name</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Type</div>
          <div role="columnheader">Properties</div>
          <div role="columnheader">Users</div>
        </div>
        <div class="table__row" role="row" *ngFor="let t of tenants()">
          <div role="cell">
            <div class="title">{{ t.name }}</div>
            <div class="muted">{{ t.slug }}</div>
          </div>
          <div role="cell">{{ t.status }}</div>
          <div role="cell">{{ t.type }}</div>
          <div role="cell">{{ t.property_count ?? '—' }}</div>
          <div role="cell">{{ t.user_count ?? '—' }}</div>
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
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    limit: 50,
  });

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const limit = this.form.value.limit ?? 50;
      const res = await firstValueFrom(this.api.listTenants(limit));
      this.tenants.set(res.tenants);
      this.statusMessage.set(`${res.count} tenants fetched`);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load tenants'));
    } finally {
      this.loading.set(false);
    }
  }
}
