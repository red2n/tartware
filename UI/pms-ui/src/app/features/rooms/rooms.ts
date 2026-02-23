import { Component, computed, inject, type OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

type RoomItem = {
  room_id: string;
  room_number: string;
  room_name?: string;
  room_type_name?: string;
  floor?: string;
  building?: string;
  status: string;
  status_display: string;
  housekeeping_status: string;
  housekeeping_display: string;
  maintenance_status: string;
  maintenance_display: string;
  is_blocked: boolean;
  block_reason?: string;
  is_out_of_order: boolean;
  out_of_order_reason?: string;
};

type StatusFilter = 'ALL' | 'SETUP' | 'VACANT' | 'OCCUPIED' | 'OUT_OF_ORDER' | 'BLOCKED';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './rooms.html',
  styleUrl: './rooms.scss',
})
export class RoomsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly rooms = signal<RoomItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly activeFilter = signal<StatusFilter>('ALL');

  readonly statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'SETUP', label: 'Setup' },
    { key: 'VACANT', label: 'Vacant' },
    { key: 'OCCUPIED', label: 'Occupied' },
    { key: 'OUT_OF_ORDER', label: 'Out of order' },
    { key: 'BLOCKED', label: 'Blocked' },
  ];

  readonly filteredRooms = computed(() => {
    let list = this.rooms();
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (filter === 'SETUP') {
      list = list.filter((r) => r.status === 'setup');
    } else if (filter === 'VACANT') {
      list = list.filter((r) => r.status === 'available');
    } else if (filter === 'OCCUPIED') {
      list = list.filter((r) => r.status === 'occupied');
    } else if (filter === 'OUT_OF_ORDER') {
      list = list.filter((r) => r.is_out_of_order);
    } else if (filter === 'BLOCKED') {
      list = list.filter((r) => r.is_blocked);
    }

    if (query) {
      list = list.filter(
        (r) =>
          r.room_number.toLowerCase().includes(query) ||
          (r.room_name?.toLowerCase().includes(query) ?? false) ||
          (r.room_type_name?.toLowerCase().includes(query) ?? false) ||
          (r.floor?.toLowerCase().includes(query) ?? false),
      );
    }

    return list;
  });

  readonly filterCounts = computed(() => {
    const all = this.rooms();
    return {
      ALL: all.length,
      SETUP: all.filter((r) => r.status === 'setup').length,
      VACANT: all.filter((r) => r.status === 'available').length,
      OCCUPIED: all.filter((r) => r.status === 'occupied').length,
      OUT_OF_ORDER: all.filter((r) => r.is_out_of_order).length,
      BLOCKED: all.filter((r) => r.is_blocked).length,
    };
  });

  ngOnInit(): void {
    this.loadRooms();
  }

  setFilter(filter: StatusFilter): void {
    this.activeFilter.set(filter);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  viewRoom(roomId: string): void {
    this.router.navigate(['/rooms', roomId]);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'setup':
        return 'badge-muted';
      case 'available':
        return 'badge-success';
      case 'occupied':
        return 'badge-accent';
      case 'out_of_order':
      case 'out_of_service':
        return 'badge-danger';
      case 'blocked':
        return 'badge-warning';
      default:
        return '';
    }
  }

  hkClass(status: string): string {
    switch (status) {
      case 'CLEAN':
      case 'INSPECTED':
        return 'badge-success';
      case 'DIRTY':
        return 'badge-danger';
      case 'IN_PROGRESS':
        return 'badge-warning';
      default:
        return '';
    }
  }

  async loadRooms(): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const rooms = await this.api.get<RoomItem[]>('/rooms', { tenant_id: tenantId });
      this.rooms.set(rooms);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load rooms');
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog(): void {
    import('./create-room-dialog/create-room-dialog').then(({ CreateRoomDialogComponent }) => {
      const ref = this.dialog.open(CreateRoomDialogComponent, {
        width: '520px',
        disableClose: true,
      });
      ref.afterClosed().subscribe((created: boolean) => {
        if (created) {
          this.loadRooms();
        }
      });
    });
  }
}
