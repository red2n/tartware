import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
  ViewChild,
} from '@angular/core';
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
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Reservations Component
 * Displays and manages hotel/property reservations
 *
 * Features:
 * - Searchable and filterable reservations table
 * - Status-based filtering
 * - Pagination and sorting
 * - Quick actions (view, edit, cancel)
 * - Responsive design
 *
 * Reference: Modern PMS reservations management
 */
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
export class ReservationsComponent implements OnInit {
  tenantContext = inject(TenantContextService);

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

  dataSource = new MatTableDataSource<Reservation>();
  isLoading = signal(true);

  statusFilter = signal<string>('all');
  statusOptions = [
    { value: 'all', label: 'All Reservations' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checked_in', label: 'Checked In' },
    { value: 'checked_out', label: 'Checked Out' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ];

  ngOnInit(): void {
    this.loadReservations();
  }

  /**
   * Load reservations data
   * TODO: Replace with actual API call
   */
  loadReservations(): void {
    this.isLoading.set(true);

    // Mock data - replace with actual service call
    setTimeout(() => {
      const mockData: Reservation[] = [
        {
          id: '1',
          confirmation_code: 'TW-2024-001',
          guest_name: 'John Smith',
          guest_email: 'john.smith@example.com',
          room_number: '203',
          room_type: 'Deluxe Suite',
          check_in_date: '2024-11-10',
          check_out_date: '2024-11-15',
          nights: 5,
          status: 'confirmed',
          total_amount: 1250.0,
          currency: 'USD',
        },
        {
          id: '2',
          confirmation_code: 'TW-2024-002',
          guest_name: 'Sarah Johnson',
          guest_email: 'sarah.j@example.com',
          room_number: '105',
          room_type: 'Standard Room',
          check_in_date: '2024-11-08',
          check_out_date: '2024-11-12',
          nights: 4,
          status: 'checked_in',
          total_amount: 680.0,
          currency: 'USD',
        },
        {
          id: '3',
          confirmation_code: 'TW-2024-003',
          guest_name: 'Michael Chen',
          guest_email: 'mchen@example.com',
          room_number: '307',
          room_type: 'Executive Suite',
          check_in_date: '2024-11-15',
          check_out_date: '2024-11-20',
          nights: 5,
          status: 'confirmed',
          total_amount: 1750.0,
          currency: 'USD',
        },
        {
          id: '4',
          confirmation_code: 'TW-2024-004',
          guest_name: 'Emily Davis',
          guest_email: 'emily.d@example.com',
          room_number: '412',
          room_type: 'Deluxe Room',
          check_in_date: '2024-11-05',
          check_out_date: '2024-11-08',
          nights: 3,
          status: 'checked_out',
          total_amount: 540.0,
          currency: 'USD',
        },
        {
          id: '5',
          confirmation_code: 'TW-2024-005',
          guest_name: 'David Wilson',
          guest_email: 'dwilson@example.com',
          room_number: '201',
          room_type: 'Standard Room',
          check_in_date: '2024-11-12',
          check_out_date: '2024-11-14',
          nights: 2,
          status: 'cancelled',
          total_amount: 340.0,
          currency: 'USD',
        },
      ];

      this.dataSource.data = mockData;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.isLoading.set(false);
    }, 800);
  }

  /**
   * Apply search filter
   */
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Filter by status
   */
  filterByStatus(status: string): void {
    this.statusFilter.set(status);
    if (status === 'all') {
      this.dataSource.filter = '';
    } else {
      this.dataSource.filter = status;
    }
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      confirmed: 'status-confirmed',
      checked_in: 'status-checked-in',
      checked_out: 'status-checked-out',
      cancelled: 'status-cancelled',
      no_show: 'status-no-show',
    };
    return classes[status] || '';
  }

  /**
   * Get status label
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      confirmed: 'Confirmed',
      checked_in: 'Checked In',
      checked_out: 'Checked Out',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return labels[status] || status;
  }

  /**
   * View reservation details
   */
  viewReservation(reservation: Reservation): void {
    console.log('View reservation:', reservation);
    // TODO: Navigate to reservation details page
  }

  /**
   * Edit reservation
   */
  editReservation(reservation: Reservation): void {
    console.log('Edit reservation:', reservation);
    // TODO: Open edit dialog or navigate to edit page
  }

  /**
   * Cancel reservation
   */
  cancelReservation(reservation: Reservation): void {
    console.log('Cancel reservation:', reservation);
    // TODO: Show confirmation dialog and cancel reservation
  }
}

/**
 * Reservation interface
 * Matches backend bookings schema
 */
export interface Reservation {
  id: string;
  confirmation_code: string;
  guest_name: string;
  guest_email: string;
  room_number: string;
  room_type: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  total_amount: number;
  currency: string;
}
