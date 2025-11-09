import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { DashboardService } from '../../../core/services/dashboard.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Dashboard Component
 * Main landing page for PMS workspace showing key metrics and quick actions
 *
 * Features:
 * - Property overview statistics
 * - Quick action cards
 * - Recent activity feed
 * - Performance metrics
 *
 * Reference: Modern PMS dashboard pattern
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  dashboardService = inject(DashboardService);

  activeTenant = this.tenantContext.activeTenant;
  tenantName = this.tenantContext.tenantName;
  selectedPropertyId = this.propertyContext.selectedPropertyId;
  selectedProperty = this.propertyContext.selectedProperty;

  // Loading states
  loadingStats = signal(false);
  loadingActivity = signal(false);
  loadingTasks = signal(false);

  // Data signals
  stats = signal<DashboardStat[]>([]);
  activities = signal<ActivityItem[]>([]);
  tasks = signal<TaskItem[]>([]);

  quickActions = signal([
    {
      id: 'newReservation',
      label: 'New Reservation',
      icon: 'event',
      route: '/pms/:id/reservations',
    },
    { id: 'checkIn', label: 'Check-in Guest', icon: 'login', route: '/pms/:id/check-in' },
    { id: 'checkOut', label: 'Check-out Guest', icon: 'logout', route: '/pms/:id/check-out' },
    {
      id: 'housekeeping',
      label: 'Housekeeping',
      icon: 'cleaning_services',
      route: '/pms/:id/housekeeping',
    },
  ]);

  constructor() {
    // Load data when tenant or property changes
    effect(
      () => {
        const tenant = this.activeTenant();
        const propertyId = this.selectedPropertyId();

        // Always log in dev mode to debug
        console.log('[Dashboard Effect] Tenant:', tenant?.id, 'Property:', propertyId);

        if (tenant) {
          if (environment.enableDebugLogs) {
            console.log('Dashboard loading data for tenant:', tenant.id, 'property:', propertyId);
          }
          this.loadDashboardData();
        } else {
          console.warn('[Dashboard Effect] No active tenant found');
        }
      },
      { allowSignalWrites: true }
    );
  } /**
   * Load all dashboard data
   */
  loadDashboardData(): void {
    const tenant = this.activeTenant();
    if (!tenant) return;

    const propertyId = this.selectedPropertyId();
    const propertyName = this.selectedProperty()?.property_name || 'All Properties';
    if (environment.enableDebugLogs) {
      console.log(`Loading dashboard data for ${propertyName} (${propertyId})`);
    }

    // Load stats
    this.loadingStats.set(true);
    this.dashboardService.getDashboardStats(tenant.id, propertyId).subscribe({
      next: (data) => {
        if (environment.enableDebugLogs) {
          console.log('Dashboard stats loaded:', data);
        }
        this.stats.set([
          {
            id: 'occupancy',
            label: 'Occupancy Rate',
            value: `${data.occupancy.rate}%`,
            change: `${data.occupancy.change > 0 ? '+' : ''}${data.occupancy.change}%`,
            trend: data.occupancy.trend,
            icon: 'hotel',
            color: 'primary',
          },
          {
            id: 'revenue',
            label: 'Revenue (Today)',
            value: `$${data.revenue.today.toLocaleString()}`,
            change: `${data.revenue.change > 0 ? '+' : ''}${data.revenue.change}%`,
            trend: data.revenue.trend,
            icon: 'attach_money',
            color: 'success',
          },
          {
            id: 'checkIns',
            label: 'Check-ins Today',
            value: data.checkIns.total.toString(),
            change: `${data.checkIns.pending} pending`,
            trend: 'neutral',
            icon: 'login',
            color: 'info',
          },
          {
            id: 'checkOuts',
            label: 'Check-outs Today',
            value: data.checkOuts.total.toString(),
            change: `${data.checkOuts.pending} pending`,
            trend: 'neutral',
            icon: 'logout',
            color: 'warning',
          },
        ]);
        this.loadingStats.set(false);
      },
      error: (error) => {
        console.error('Failed to load dashboard stats:', error);
        this.stats.set([]);
        this.loadingStats.set(false);
      },
    });

    // Load activity
    this.loadingActivity.set(true);
    this.dashboardService.getRecentActivity(tenant.id, propertyId).subscribe({
      next: (data) => {
        if (environment.enableDebugLogs) {
          console.log('Dashboard activity loaded:', data);
        }
        this.activities.set(
          data.map((a) => ({
            icon: a.icon,
            title: a.title,
            meta: a.description,
            urgent: false,
          }))
        );
        this.loadingActivity.set(false);
      },
      error: (error) => {
        console.error('Failed to load activity:', error);
        this.activities.set([]);
        this.loadingActivity.set(false);
      },
    });

    // Load tasks
    this.loadingTasks.set(true);
    this.dashboardService.getUpcomingTasks(tenant.id, propertyId).subscribe({
      next: (data) => {
        if (environment.enableDebugLogs) {
          console.log('Dashboard tasks loaded:', data);
        }
        this.tasks.set(
          data.map((t) => ({
            icon: t.icon,
            title: t.title,
            meta: t.description,
            urgent: t.priority === 'urgent',
          }))
        );
        this.loadingTasks.set(false);
      },
      error: (error) => {
        console.error('Failed to load tasks:', error);
        this.tasks.set([]);
        this.loadingTasks.set(false);
      },
    });
  }
}

interface DashboardStat {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

interface ActivityItem {
  icon: string;
  title: string;
  meta: string;
  urgent: boolean;
}

interface TaskItem {
  icon: string;
  title: string;
  meta: string;
  urgent: boolean;
}
