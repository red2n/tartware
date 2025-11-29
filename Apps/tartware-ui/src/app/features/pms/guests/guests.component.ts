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
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import type { Guest } from '../../../core/models/guest.model';
import { GuestService } from '../../../core/services/guest.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-guests',
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
  ],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestsComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private guestService = inject(GuestService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'guest',
    'contact',
    'loyalty',
    'stats',
    'lastStay',
    'status',
    'actions',
  ];

  dataSource = new MatTableDataSource<Guest>([]);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  private guests = signal<Guest[]>([]);
  private searchTerm = signal<string>('');

  constructor() {
    this.dataSource.filterPredicate = (data, filter) => {
      if (!filter) {
        return true;
      }
      const normalized = filter.toLowerCase();
      return (
        `${data.first_name} ${data.last_name}`.toLowerCase().includes(normalized) ||
        data.email.toLowerCase().includes(normalized) ||
        (data.phone ?? '').toLowerCase().includes(normalized)
      );
    };

    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();

        if (!tenant) {
          return;
        }

        this.fetchGuests(tenant.id, propertyId ?? undefined);
      },
      { allowSignalWrites: true }
    );
  }

  loadGuests(): void {
    const tenant = this.tenantContext.activeTenant();
    const propertyId = this.propertyContext.selectedPropertyId();
    if (!tenant) {
      return;
    }

    this.fetchGuests(tenant.id, propertyId ?? undefined);
  }

  private fetchGuests(tenantId: string, propertyId?: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.guestService
      .getGuests(tenantId, propertyId, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guests) => {
          this.guests.set(guests);
          this.updateTableData();
          this.isLoading.set(false);
        },
        error: (error) => {
          const message = error?.error?.message ?? error?.message ?? 'Failed to load guests.';
          this.errorMessage.set(message);
          this.guests.set([]);
          this.updateTableData();
          this.isLoading.set(false);
        },
      });
  }

  private updateTableData(): void {
    this.dataSource.data = this.guests();
    this.dataSource.filter = this.searchTerm().trim().toLowerCase();

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

  isVip(guest: Guest): boolean {
    return guest.vip_status ?? false;
  }

  isBlacklisted(guest: Guest): boolean {
    return guest.is_blacklisted ?? false;
  }

  viewGuest(guest: Guest): void {
    console.log('View guest profile', guest);
  }

  messageGuest(guest: Guest): void {
    console.log('Message guest', guest);
  }
}
