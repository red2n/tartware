import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';

import type { RateItem } from '@tartware/schemas';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'FUTURE';
type TypeFilter = 'ALL' | string;

@Component({
  selector: 'app-rates',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './rates.html',
  styleUrl: './rates.scss',
})
export class RatesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly ctx = inject(TenantContextService);
  private readonly dialog = inject(MatDialog);

  readonly rates = signal<RateItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly activeFilter = signal<StatusFilter>('ALL');
  readonly activeTypeFilter = signal<TypeFilter>('ALL');

  readonly statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'INACTIVE', label: 'Inactive' },
    { key: 'EXPIRED', label: 'Expired' },
    { key: 'FUTURE', label: 'Future' },
  ];

  readonly rateTypes: { key: string; label: string }[] = [
    { key: 'ALL', label: 'All types' },
    { key: 'BAR', label: 'BAR' },
    { key: 'RACK', label: 'Rack' },
    { key: 'CORPORATE', label: 'Corporate' },
    { key: 'PROMO', label: 'Promo' },
    { key: 'NON_REFUNDABLE', label: 'Non-refundable' },
    { key: 'FLEXIBLE', label: 'Flexible' },
    { key: 'EARLYBIRD', label: 'Early bird' },
    { key: 'LASTMINUTE', label: 'Last minute' },
    { key: 'GOVERNMENT', label: 'Government' },
    { key: 'TRAVEL_AGENT', label: 'Travel agent' },
    { key: 'LOS', label: 'Length of stay' },
    { key: 'COMP', label: 'Comp' },
    { key: 'HOUSE', label: 'House' },
  ];

  readonly filteredRates = computed(() => {
    let list = this.rates();
    const status = this.activeFilter();
    const type = this.activeTypeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (status !== 'ALL') {
      list = list.filter((r) => r.status === status);
    }

    if (type !== 'ALL') {
      list = list.filter((r) => r.rate_type === type);
    }

    if (query) {
      list = list.filter(
        (r) =>
          r.rate_name.toLowerCase().includes(query) ||
          r.rate_code.toLowerCase().includes(query) ||
          (r.description?.toLowerCase().includes(query) ?? false) ||
          r.rate_type.toLowerCase().includes(query),
      );
    }

    return list;
  });

  readonly filterCounts = computed(() => {
    const all = this.rates();
    return {
      ALL: all.length,
      ACTIVE: all.filter((r) => r.status === 'ACTIVE').length,
      INACTIVE: all.filter((r) => r.status === 'INACTIVE').length,
      EXPIRED: all.filter((r) => r.status === 'EXPIRED').length,
      FUTURE: all.filter((r) => r.status === 'FUTURE').length,
    };
  });

  constructor() {
    // Reload rates when property selection changes
    effect(() => {
      this.auth.tenantId();
      this.ctx.propertyId();
      this.loadRates();
    });
  }

  setFilter(filter: StatusFilter): void {
    this.activeFilter.set(filter);
  }

  setTypeFilter(type: string): void {
    this.activeTypeFilter.set(type);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'badge-success';
      case 'INACTIVE':
        return 'badge-muted';
      case 'EXPIRED':
        return 'badge-danger';
      case 'FUTURE':
        return 'badge-accent';
      default:
        return '';
    }
  }

  typeLabel(type: string): string {
    const found = this.rateTypes.find((t) => t.key === type);
    return found?.label ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  strategyLabel(strategy: string): string {
    return strategy.charAt(0) + strategy.slice(1).toLowerCase();
  }

  mealPlanLabel(code?: string): string {
    if (!code) return '—';
    switch (code) {
      case 'RO': return 'Room only';
      case 'BB': return 'Bed & Breakfast';
      case 'HB': return 'Half board';
      case 'FB': return 'Full board';
      case 'AI': return 'All inclusive';
      default: return code;
    }
  }

  formatCurrency(amount: number, currency?: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  validityTooltip(rate: RateItem): string {
    const from = this.formatDate(rate.valid_from);
    const until = rate.valid_until ? this.formatDate(rate.valid_until) : 'No end date';
    return `${from} — ${until}`;
  }

  cancellationLabel(policy: unknown): string {
    if (!policy || typeof policy !== 'object' || !('type' in policy)) return '—';
    const type = String((policy as Record<string, unknown>)['type']);
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  }

  channelsLabel(channels: unknown): string {
    if (Array.isArray(channels)) {
      return channels.map((c) => String(c).charAt(0).toUpperCase() + String(c).slice(1)).join(', ');
    }
    return '—';
  }

  async loadRates(): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string> = { tenant_id: tenantId };
      const propertyId = this.ctx.propertyId();
      if (propertyId) params['property_id'] = propertyId;
      const rates = await this.api.get<RateItem[]>('/rates', params);
      this.rates.set(rates);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load rates');
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog(): void {
    import('./create-rate-dialog/create-rate-dialog').then(({ CreateRateDialogComponent }) => {
      const ref = this.dialog.open(CreateRateDialogComponent, {
        width: '600px',
        disableClose: true,
      });
      ref.afterClosed().subscribe((created: boolean) => {
        if (created) {
          this.loadRates();
        }
      });
    });
  }

  async toggleStatus(rate: RateItem, newStatus: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    try {
      await this.api.put(`/rates/${rate.id}`, {
        tenant_id: tenantId,
        status: newStatus,
      });
      // Update local state immediately
      this.rates.update((list) =>
        list.map((r) => (r.id === rate.id ? { ...r, status: newStatus } : r)),
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to update rate status');
    }
  }
}
