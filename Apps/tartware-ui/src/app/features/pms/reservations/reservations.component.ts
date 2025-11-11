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
import type { Reservation } from '../../../core/models/reservation.model';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-reservations',
  standalone: true,
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
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private reservationService = inject(ReservationService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'confirmation',
    'guest',
    'room',
    'checkIn',
    'checkOut',
    'nights',
    'status',
    'total',
    'actions',
  ];

  dataSource = new MatTableDataSource<Reservation>([]);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  private reservations = signal<Reservation[]>([]);
  private searchTerm = signal<string>('');
  statusFilter = signal<string>('all');

  statusOptions = [
    { value: 'all', label: 'All Reservations' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'pending', label: 'Pending' },
    { value: 'checked_in', label: 'Checked In' },
    { value: 'checked_out', label: 'Checked Out' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ];

  constructor() {
    this.dataSource.filterPredicate = (data, filter) => {
      const { status, term } = JSON.parse(filter) as { status: string; term: string };
      const matchesStatus = status === 'all' || data.status === status;
      if (!matchesStatus) {
        return false;
      }
      if (!term) {
        return true;
      }

      const normalized = term.toLowerCase();
      return (
        data.confirmation_number.toLowerCase().includes(normalized) ||
        data.guest_name.toLowerCase().includes(normalized) ||
        data.guest_email.toLowerCase().includes(normalized) ||
        (data.room_number ?? '').toLowerCase().includes(normalized) ||
        (data.property_name ?? '').toLowerCase().includes(normalized)
      );
    };

    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();

        if (!tenant) {
          return;
        }

        this.fetchReservations(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  loadReservations(): void {
    const tenant = this.tenantContext.activeTenant();
    if (!tenant) {
      return;
    }

    const propertyId = this.propertyContext.selectedPropertyId();
    this.fetchReservations(tenant.id, propertyId);
  }

  private fetchReservations(tenantId: string, propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.reservationService
      .getReservations(tenantId, { propertyId, limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reservations) => {
          this.reservations.set(reservations);
          this.updateTableData();
          this.isLoading.set(false);
        },
        error: (error) => {
          const message =
            error?.error?.message ?? error?.message ?? 'Failed to load reservations. Please retry.';
          this.errorMessage.set(message);
          this.reservations.set([]);
          this.updateTableData();
          this.isLoading.set(false);
        },
      });
  }

  private updateTableData(): void {
    const status = this.statusFilter();
    const term = this.searchTerm().trim().toLowerCase();

    this.dataSource.data = this.reservations();

    const filterPayload = JSON.stringify({ status, term });
    this.dataSource.filter = filterPayload;

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchTerm.set(filterValue);
    this.updateTableData();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  filterByStatus(status: string): void {
    this.statusFilter.set(status);
    this.updateTableData();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      confirmed: 'status-confirmed',
      pending: 'status-pending',
      checked_in: 'status-checked-in',
      checked_out: 'status-checked-out',
      cancelled: 'status-cancelled',
      no_show: 'status-no-show',
    };
    return classes[status] || 'status-default';
  }

  getStatusLabel(reservation: Reservation): string {
    return reservation.status_display ?? reservation.status;
  }

  viewReservation(reservation: Reservation): void {
    console.log('View reservation:', reservation);
  }

  editReservation(reservation: Reservation): void {
    console.log('Edit reservation:', reservation);
  }

  cancelReservation(reservation: Reservation): void {
    console.log('Cancel reservation:', reservation);
  }
}
