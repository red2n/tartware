import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TenantContextComponent } from '../components/tenant-context/tenant-context.component';
import { extractErrorMessage } from '../services/error-utils';
import type { Reservations } from '@tartware/schemas/bookings/reservations';
import { ReservationStatusEnum } from '@tartware/schemas/enums';
import type { Tenant } from '@tartware/schemas/core/tenants';
import { ReservationApiService } from '../services/reservation-api.service';
import { SystemSessionService } from '../services/system-session.service';
import { TenantApiService } from '../services/tenant-api.service';

type ReservationView = Reservations & {
  statusLabel: string;
  nights: number;
};

@Component({
  standalone: true,
  selector: 'app-reservations',
  imports: [CommonModule, ReactiveFormsModule, TenantContextComponent],
  template: `
    <section class="panel" aria-label="Reservations">
      <header class="panel__head">
        <div>
          <h1>Support: Tenant reservations</h1>
          <p>Admin/support view to read tenant-scoped reservations via /v1/reservations with tenant and optional property filter.</p>
        </div>
        <div class="hint">Select a tenant (impersonation token preferred), optionally filter by property, status, or keyword.</div>
      </header>

      <div class="controls">
        <form [formGroup]="form" (ngSubmit)="loadReservations()" class="filters" novalidate>
          <div class="full-row">
            <app-tenant-context
              [tenants]="tenants()"
              [selectedTenantId]="selectedTenantId()"
              (tenantChanged)="onTenantChanged($event)"
            />
            <div class="error" *ngIf="form.controls.tenant_id.invalid && form.controls.tenant_id.touched">
              Tenant selection is required.
            </div>
          </div>

          <label>
            Property ID (optional)
            <input type="text" formControlName="property_id" placeholder="property uuid" />
          </label>

          <label>
            Status (optional)
            <select formControlName="status">
              <option value="">Any status</option>
              <option *ngFor="let status of statusFilters" [value]="status.value">{{ status.label }}</option>
            </select>
          </label>

          <label>
            Search (guest or confirmation)
            <input type="text" formControlName="search" placeholder="guest name, email, or confirmation" />
          </label>

          <label>
            Limit
            <input type="number" formControlName="limit" min="1" max="200" />
          </label>

          <div class="actions">
            <button type="submit" class="primary" [disabled]="loading() || !tenants().length" [attr.aria-busy]="loading()">
              {{ loading() ? 'Loading…' : 'Load reservations' }}
            </button>
            <button type="button" class="ghost" (click)="restoreContext()" [disabled]="loading() || !hasContext()">
              Restore saved context
            </button>
          </div>
        </form>

        <div class="status" *ngIf="statusMessage()">{{ statusMessage() }}</div>
        <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      </div>

      <div class="table" role="table" aria-label="Reservations table" *ngIf="reservations().length">
        <div class="table__head" role="row">
          <div role="columnheader">Reservation</div>
          <div role="columnheader">Guest</div>
          <div role="columnheader">Dates</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Totals</div>
        </div>

        <div class="table__row" role="row" *ngFor="let r of reservations()">
          <div role="cell">
            <div class="title">{{ r.confirmation_number }}</div>
            <div class="muted">Tenant {{ r.tenant_id }} · Property {{ r.property_id || '—' }}</div>
          </div>
          <div role="cell">
            <div class="title">{{ r.guest_name }}</div>
            <div class="muted">{{ r.guest_email || '—' }}</div>
          </div>
          <div role="cell">
            <div>{{ formatDate(r.check_in_date) }} → {{ formatDate(r.check_out_date) }}</div>
            <div class="muted">{{ r.nights }} nights</div>
          </div>
          <div role="cell">
            <span class="badge">{{ r.statusLabel }}</span>
            <div class="muted">Updated {{ formatDate(r.updated_at || r.created_at) }}</div>
          </div>
          <div role="cell">
            <div>{{ r.total_amount }} {{ r.currency }}</div>
            <div class="muted">Paid {{ r.paid_amount ?? 0 }} · Balance {{ r.balance_due ?? 0 }}</div>
          </div>
        </div>
      </div>

      <div class="placeholder" *ngIf="!loading() && !reservations().length">No reservations loaded yet.</div>
    </section>
  `,
  styleUrls: ['./reservations.component.scss'],
})
export class ReservationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reservationApi = inject(ReservationApiService);
  private readonly tenantApi = inject(TenantApiService);
  private readonly session = inject(SystemSessionService);

  readonly tenants = signal<Tenant[]>([]);
  readonly reservations = signal<ReservationView[]>([]);
  readonly loading = signal(false);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly selectedTenantId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    tenant_id: ['', Validators.required],
    property_id: [''],
    status: [''],
    search: [''],
    limit: 50,
  });

  readonly statusFilters = ReservationStatusEnum.options.map((value: string) => ({
    value,
    label: this.titleize(value),
  }));

  ngOnInit(): void {
    this.seedFromSession();
    void this.loadTenants();
  }

  hasContext(): boolean {
    const ctx = this.session.tenantContext();
    return Boolean(ctx?.tenantId);
  }

  restoreContext(): void {
    const ctx = this.session.tenantContext();
    if (!ctx) return;
    this.form.patchValue({
      tenant_id: ctx.tenantId,
      property_id: ctx.propertyId ?? '',
    });
    this.selectedTenantId.set(ctx.tenantId);
  }

  async loadTenants(): Promise<void> {
    try {
      const tenantList = await firstValueFrom(this.tenantApi.listTenants());
      this.tenants.set(tenantList);
      if (!this.selectedTenantId() && this.form.value.tenant_id) {
        this.selectedTenantId.set(this.form.value.tenant_id);
      } else if (!this.form.value.tenant_id && tenantList.length === 1) {
        this.form.patchValue({ tenant_id: tenantList[0].id });
        this.selectedTenantId.set(tenantList[0].id);
      }
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load tenants'));
    }
  }

  async loadReservations(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Select a tenant to fetch reservations.');
      return;
    }

    const { tenant_id, property_id, status, search, limit } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    try {
      const results = await firstValueFrom(
        this.reservationApi.listReservations({
          tenantId: tenant_id,
          propertyId: property_id?.trim() || undefined,
          status: status?.trim() || undefined,
          search: search?.trim() || undefined,
          limit: limit ?? 50,
        })
      );

      const mapped = results.map((r) => ({
        ...r,
        statusLabel: this.titleize(r.status),
        nights: this.computeNights(r.check_in_date, r.check_out_date),
      }));

      this.reservations.set(mapped);
      this.statusMessage.set(`${mapped.length} reservations fetched`);
      this.session.setTenantContext({ tenantId: tenant_id, propertyId: property_id?.trim() || undefined });
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load reservations'));
    } finally {
      this.loading.set(false);
    }
  }

  onTenantChanged(tenantId: string): void {
    this.selectedTenantId.set(tenantId);
    this.form.patchValue({ tenant_id: tenantId });
    this.session.setTenantContext({ tenantId, propertyId: this.form.value.property_id?.trim() || undefined });
  }

  private seedFromSession(): void {
    const ctx = this.session.tenantContext();
    if (ctx?.tenantId) {
      this.form.patchValue({ tenant_id: ctx.tenantId });
      this.selectedTenantId.set(ctx.tenantId);
    }
    if (ctx?.propertyId) {
      this.form.patchValue({ property_id: ctx.propertyId });
    }
  }

  private computeNights(checkIn: Date | string | null | undefined, checkOut: Date | string | null | undefined): number {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    if (Number.isNaN(diff) || diff < 0) return 0;
    return Math.round(diff / 86_400_000);
  }

  protected formatDate(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return `${value}`;
    return date.toISOString().slice(0, 10);
  }

  private titleize(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(' ');
  }
}
