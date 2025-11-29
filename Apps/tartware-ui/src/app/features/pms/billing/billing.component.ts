import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import type { BillingPayment } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-billing',
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private billingService = inject(BillingService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'reference',
    'reservation',
    'guest',
    'transaction',
    'status',
    'amount',
    'processed',
  ];

  dataSource = new MatTableDataSource<BillingPayment>([]);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  private payments = signal<BillingPayment[]>([]);
  private searchTerm = signal<string>('');
  statusFilter = signal<string>('all');
  methodFilter = signal<string>('all');

  statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'partially_refunded', label: 'Partially Refunded' },
  ];

  methodOptions = [
    { value: 'all', label: 'All Methods' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'digital_wallet', label: 'Digital Wallet' },
    { value: 'check', label: 'Check' },
    { value: 'cryptocurrency', label: 'Crypto' },
  ];

  constructor() {
    this.dataSource.filterPredicate = (data, filter) => {
      const { status, method, term } = JSON.parse(filter) as {
        status: string;
        method: string;
        term: string;
      };

      const matchesStatus = status === 'all' || data.status === status;
      const matchesMethod = method === 'all' || data.payment_method === method;
      if (!matchesStatus || !matchesMethod) {
        return false;
      }

      if (!term) {
        return true;
      }

      const normalized = term.toLowerCase();
      return (
        data.payment_reference.toLowerCase().includes(normalized) ||
        (data.confirmation_number ?? '').toLowerCase().includes(normalized) ||
        (data.guest_name ?? '').toLowerCase().includes(normalized)
      );
    };

    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();

        if (!tenant) {
          return;
        }

        this.fetchPayments(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  loadPayments(): void {
    const tenant = this.tenantContext.activeTenant();
    if (!tenant) {
      return;
    }

    const propertyId = this.propertyContext.selectedPropertyId();
    this.fetchPayments(tenant.id, propertyId);
  }

  private fetchPayments(tenantId: string, propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.billingService
      .getPayments(tenantId, {
        propertyId,
        status: this.statusFilter(),
        paymentMethod: this.methodFilter(),
        limit: 200,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payments) => {
          this.payments.set(payments);
          this.updateTableData();
          this.isLoading.set(false);
        },
        error: (error) => {
          const message = error?.error?.message ?? error?.message ?? 'Failed to load payments.';
          this.errorMessage.set(message);
          this.payments.set([]);
          this.updateTableData();
          this.isLoading.set(false);
        },
      });
  }

  private updateTableData(): void {
    const filterPayload = JSON.stringify({
      status: this.statusFilter(),
      method: this.methodFilter(),
      term: this.searchTerm().trim().toLowerCase(),
    });

    this.dataSource.data = this.payments();
    this.dataSource.filter = filterPayload;

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  applySearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.searchTerm.set(value);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  setMethodFilter(value: string): void {
    this.methodFilter.set(value);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  getStatusChip(status: string): string {
    const classes: Record<string, string> = {
      completed: 'status-completed',
      pending: 'status-pending',
      processing: 'status-processing',
      failed: 'status-failed',
      cancelled: 'status-cancelled',
      refunded: 'status-refunded',
      partially_refunded: 'status-partial',
    };
    return classes[status] || 'status-default';
  }
}
