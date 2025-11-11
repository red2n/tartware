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
import type { Room } from '../../../core/models/room.model';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { RoomService } from '../../../core/services/room.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-rooms',
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
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomsComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private roomService = inject(RoomService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'roomNumber',
    'type',
    'location',
    'status',
    'housekeeping',
    'maintenance',
    'expectedReady',
    'notes',
  ];

  dataSource = new MatTableDataSource<Room>([]);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  private rooms = signal<Room[]>([]);
  private searchTerm = signal<string>('');
  roomStatusFilter = signal<string>('all');
  housekeepingFilter = signal<string>('all');
  maintenanceFilter = signal<string>('all');

  roomStatusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'available', label: 'Available' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'dirty', label: 'Dirty' },
    { value: 'clean', label: 'Clean' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'out_of_order', label: 'Out of Order' },
    { value: 'out_of_service', label: 'Out of Service' },
  ];

  housekeepingStatusOptions = [
    { value: 'all', label: 'All Housekeeping' },
    { value: 'clean', label: 'Clean' },
    { value: 'dirty', label: 'Dirty' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'do_not_disturb', label: 'Do Not Disturb' },
  ];

  maintenanceStatusOptions = [
    { value: 'all', label: 'All Maintenance' },
    { value: 'operational', label: 'Operational' },
    { value: 'needs_repair', label: 'Needs Repair' },
    { value: 'under_maintenance', label: 'Under Maintenance' },
    { value: 'out_of_order', label: 'Out of Order' },
  ];

  constructor() {
    this.dataSource.filterPredicate = (data, filter) => {
      const { roomStatus, housekeepingStatus, maintenanceStatus, term } = JSON.parse(filter) as {
        roomStatus: string;
        housekeepingStatus: string;
        maintenanceStatus: string;
        term: string;
      };

      const matchesRoomStatus = roomStatus === 'all' || data.status === roomStatus;
      const matchesHousekeeping =
        housekeepingStatus === 'all' || data.housekeeping_status === housekeepingStatus;
      const matchesMaintenance =
        maintenanceStatus === 'all' || data.maintenance_status === maintenanceStatus;

      if (!matchesRoomStatus || !matchesHousekeeping || !matchesMaintenance) {
        return false;
      }

      if (!term) {
        return true;
      }

      const normalized = term.toLowerCase();
      return (
        data.room_number.toLowerCase().includes(normalized) ||
        (data.room_name ?? '').toLowerCase().includes(normalized) ||
        (data.room_type_name ?? '').toLowerCase().includes(normalized) ||
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

        this.fetchRooms(tenant.id, propertyId);
      },
      { allowSignalWrites: true },
    );
  }

  loadRooms(): void {
    const tenant = this.tenantContext.activeTenant();
    if (!tenant) {
      return;
    }

    const propertyId = this.propertyContext.selectedPropertyId();
    this.fetchRooms(tenant.id, propertyId);
  }

  private fetchRooms(tenantId: string, propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.roomService
      .getRooms(tenantId, {
        propertyId,
        status: this.roomStatusFilter(),
        housekeepingStatus: this.housekeepingFilter(),
        limit: 300,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          this.rooms.set(rooms);
          this.updateTableData();
          this.isLoading.set(false);
        },
        error: (error) => {
          const message =
            error?.error?.message ?? error?.message ?? 'Failed to load rooms. Please retry.';
          this.errorMessage.set(message);
          this.rooms.set([]);
          this.updateTableData();
          this.isLoading.set(false);
        },
      });
  }

  private updateTableData(): void {
    const filterPayload = JSON.stringify({
      roomStatus: this.roomStatusFilter(),
      housekeepingStatus: this.housekeepingFilter(),
      maintenanceStatus: this.maintenanceFilter(),
      term: this.searchTerm().trim().toLowerCase(),
    });

    this.dataSource.data = this.rooms();
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

  setRoomStatusFilter(status: string): void {
    this.roomStatusFilter.set(status);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  setHousekeepingFilter(status: string): void {
    this.housekeepingFilter.set(status);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  setMaintenanceFilter(status: string): void {
    this.maintenanceFilter.set(status);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  getStatusChipClass(status: string): string {
    const classes: Record<string, string> = {
      available: 'status-available',
      occupied: 'status-occupied',
      dirty: 'status-dirty',
      clean: 'status-clean',
      inspected: 'status-inspected',
      out_of_order: 'status-out',
      out_of_service: 'status-out',
    };
    return classes[status] || 'status-default';
  }

  getHousekeepingChipClass(status: string): string {
    const classes: Record<string, string> = {
      clean: 'hk-clean',
      dirty: 'hk-dirty',
      inspected: 'hk-inspected',
      in_progress: 'hk-progress',
      do_not_disturb: 'hk-dnd',
    };
    return classes[status] || 'hk-default';
  }

  getMaintenanceChipClass(status: string): string {
    const classes: Record<string, string> = {
      operational: 'mt-operational',
      needs_repair: 'mt-repair',
      under_maintenance: 'mt-maintenance',
      out_of_order: 'mt-out',
    };
    return classes[status] || 'mt-default';
  }
}
