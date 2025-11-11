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
import type { HousekeepingTask } from '../../../core/models/housekeeping.model';
import { HousekeepingService } from '../../../core/services/housekeeping.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-housekeeping',
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
  templateUrl: './housekeeping.component.html',
  styleUrl: './housekeeping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HousekeepingComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private housekeepingService = inject(HousekeepingService);
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'room',
    'task',
    'priority',
    'status',
    'schedule',
    'assigned',
    'notes',
  ];

  dataSource = new MatTableDataSource<HousekeepingTask>([]);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  private tasks = signal<HousekeepingTask[]>([]);
  scheduledDate = signal<string>('');
  statusFilter = signal<string>('all');
  searchTerm = signal<string>('');

  statusOptions = [
    { value: 'all', label: 'All Tasks' },
    { value: 'clean', label: 'Clean' },
    { value: 'dirty', label: 'Dirty' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'do_not_disturb', label: 'Do Not Disturb' },
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
        data.room_number.toLowerCase().includes(normalized) ||
        data.task_type.toLowerCase().includes(normalized) ||
        (data.notes ?? '').toLowerCase().includes(normalized)
      );
    };

    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();

        if (!tenant) {
          return;
        }

        this.fetchTasks(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  loadTasks(): void {
    const tenant = this.tenantContext.activeTenant();
    if (!tenant) {
      return;
    }

    const propertyId = this.propertyContext.selectedPropertyId();
    this.fetchTasks(tenant.id, propertyId);
  }

  private fetchTasks(tenantId: string, propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.housekeepingService
      .getTasks(tenantId, {
        propertyId,
        status: this.statusFilter(),
        scheduledDate: this.scheduledDate() || undefined,
        limit: 200,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tasks) => {
          this.tasks.set(tasks);
          this.updateTableData();
          this.isLoading.set(false);
        },
        error: (error) => {
          const message =
            error?.error?.message ?? error?.message ?? 'Failed to load housekeeping tasks.';
          this.errorMessage.set(message);
          this.tasks.set([]);
          this.updateTableData();
          this.isLoading.set(false);
        },
      });
  }

  private updateTableData(): void {
    const filterPayload = JSON.stringify({
      status: this.statusFilter(),
      term: this.searchTerm().trim().toLowerCase(),
    });

    this.dataSource.data = this.tasks();
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

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.updateTableData();
    this.paginator?.firstPage();
  }

  onScheduledDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.setScheduledDate(value);
  }

  private setScheduledDate(date: string): void {
    this.scheduledDate.set(date);
    this.loadTasks();
  }

  clearScheduledDate(): void {
    this.scheduledDate.set('');
    this.loadTasks();
  }

  getStatusChip(status: string): string {
    const classes: Record<string, string> = {
      clean: 'hk-clean',
      dirty: 'hk-dirty',
      inspected: 'hk-inspected',
      in_progress: 'hk-progress',
      do_not_disturb: 'hk-dnd',
    };
    return classes[status] || 'hk-default';
  }

  getPriorityChip(priority?: string): string {
    if (!priority) {
      return 'priority-normal';
    }
    const normalized = priority.toLowerCase();
    const classes: Record<string, string> = {
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low',
    };
    return classes[normalized] || 'priority-normal';
  }
}
