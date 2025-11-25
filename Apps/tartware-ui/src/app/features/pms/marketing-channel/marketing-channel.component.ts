import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ModuleDefinition } from '../../../core/models/module.model';
import {
  type CampaignSummaryDto,
  type ChannelPerformanceDto,
  type LeadSourceSummaryDto,
  MarketingChannelService,
} from '../../../core/services/marketing-channel.service';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

interface ChannelPerformance {
  channel: string;
  adr: string;
  pickup: string;
  nextSync: string;
  status: 'synced' | 'attention';
}

interface CampaignSummary {
  name: string;
  audience: string;
  status: 'scheduled' | 'running' | 'draft';
  ctr: string;
  budget: string;
  progress: number;
}

interface LeadSource {
  source: string;
  leads: number;
  conversion: string;
  quality: 'great' | 'ok' | 'watch';
}

@Component({
  selector: 'app-marketing-channel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTableModule,
    MatProgressBarModule,
    MatListModule,
  ],
  templateUrl: './marketing-channel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingChannelComponent {
  private readonly moduleService = inject(ModuleService);
  private readonly marketingService = inject(MarketingChannelService);
  private readonly propertyContext = inject(PropertyContextService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tenantContext = inject(TenantContextService);

  readonly moduleDefinition = signal<ModuleDefinition | null>(null);
  readonly definitionError = signal('');
  readonly dataError = signal('');
  readonly isLoading = signal(false);
  readonly channelPerformance = signal<ChannelPerformance[]>([]);
  readonly campaignSummaries = signal<CampaignSummary[]>([]);
  readonly leadSources = signal<LeadSource[]>([]);

  readonly tenantLabel = computed(() => this.tenantContext.tenantName() || 'portfolio');

  private readonly fallbackChannels: ChannelPerformance[] = [
    {
      channel: 'Airbnb',
      adr: '$212',
      pickup: '+14% QoQ',
      nextSync: '2m',
      status: 'synced',
    },
    {
      channel: 'Booking.com',
      adr: '$198',
      pickup: '+7% QoQ',
      nextSync: 'live',
      status: 'synced',
    },
    {
      channel: 'Expedia',
      adr: '$205',
      pickup: '+3% QoQ',
      nextSync: '5m',
      status: 'attention',
    },
    {
      channel: 'Direct (Web)',
      adr: '$238',
      pickup: '+22% QoQ',
      nextSync: 'instant',
      status: 'synced',
    },
  ];

  private readonly fallbackCampaigns: CampaignSummary[] = [
    {
      name: 'Summer flash sale',
      audience: 'Repeat leisure guests',
      status: 'running',
      ctr: '4.3%',
      budget: '$12k / $20k',
      progress: 0.6,
    },
    {
      name: 'Corporate midweek fill',
      audience: 'Business accounts',
      status: 'scheduled',
      ctr: 'n/a',
      budget: '$4k / $8k',
      progress: 0.5,
    },
    {
      name: 'Owner onboarding nurture',
      audience: 'New owners',
      status: 'running',
      ctr: '3.1%',
      budget: '$1.8k / $5k',
      progress: 0.36,
    },
  ];

  private readonly fallbackLeadSources: LeadSource[] = [
    { source: 'Website forms', leads: 84, conversion: '38%', quality: 'great' },
    { source: 'OTA inquiries', leads: 51, conversion: '26%', quality: 'ok' },
    { source: 'Referral partners', leads: 17, conversion: '62%', quality: 'great' },
    { source: 'Social campaigns', leads: 43, conversion: '18%', quality: 'watch' },
  ];

  readonly channelColumns = ['channel', 'adr', 'pickup', 'nextSync', 'status'];

  constructor() {
    this.loadModuleDefinition();
    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();
        if (!tenant) {
          return;
        }
        this.fetchMarketingData(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  private loadModuleDefinition(): void {
    this.moduleService
      .getModuleDefinition('marketing-channel')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (definition) => {
          if (!definition) {
            this.definitionError.set(
              'Module definition for marketing & channel management is missing.'
            );
          } else {
            this.moduleDefinition.set(definition);
            this.definitionError.set('');
          }
        },
        error: (error) => {
          const message =
            error?.error?.message ?? error?.message ?? 'Failed to load module metadata.';
          this.definitionError.set(message);
        },
      });
  }

  private fetchMarketingData(tenantId: string, propertyId: string | null): void {
    this.isLoading.set(true);
    this.dataError.set('');

    const query = {
      tenantId,
      propertyId,
    };

    forkJoin({
      channels: this.marketingService.getChannelPerformance(query),
      campaigns: this.marketingService.getCampaignSummaries(query),
      leads: this.marketingService.getLeadSources(query),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ channels, campaigns, leads }) => {
          this.channelPerformance.set(this.toChannelView(channels));
          this.campaignSummaries.set(this.toCampaignView(campaigns));
          this.leadSources.set(this.toLeadView(leads));
          this.isLoading.set(false);
        },
        error: (error) => {
          if (environment.enableDebugLogs) {
            // eslint-disable-next-line no-console
            console.warn('Failed to load marketing analytics', error);
          }
          const message =
            error?.error?.message ?? error?.message ?? 'Unable to load marketing analytics.';
          this.dataError.set(message);
          this.applyFallbackData();
          this.isLoading.set(false);
        },
      });
  }

  private toChannelView(channels: ChannelPerformanceDto[]): ChannelPerformance[] {
    return channels.map((channel) => ({
      channel: channel.name,
      adr: this.formatCurrency(channel.average_daily_rate),
      pickup: this.formatPercent(channel.pickup_change_percent),
      nextSync: this.formatNextSync(
        channel.next_sync_eta_minutes,
        channel.last_sync_at,
        channel.status
      ),
      status: channel.status,
    }));
  }

  private toCampaignView(campaigns: CampaignSummaryDto[]): CampaignSummary[] {
    return campaigns.map((campaign) => ({
      name: campaign.name,
      audience: campaign.audience ?? 'All audiences',
      status: this.normalizeStatus(campaign.status),
      ctr: this.formatPercent(campaign.click_through_rate),
      budget: this.formatBudget(
        campaign.actual_spend,
        campaign.budget_amount,
        campaign.budget_currency
      ),
      progress: this.calculateProgress(campaign.actual_spend, campaign.budget_amount),
    }));
  }

  private toLeadView(leads: LeadSourceSummaryDto[]): LeadSource[] {
    return leads.map((lead) => ({
      source: lead.source,
      leads: lead.leads,
      conversion: this.formatPercent(lead.conversion_rate),
      quality: lead.quality,
    }));
  }

  private formatCurrency(value: number | null, currency = 'USD'): string {
    if (value === null) {
      return '—';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }

  private formatPercent(value: number | null): string {
    if (value === null) {
      return 'n/a';
    }
    const formatted = Number(value.toFixed(1));
    const sign = formatted > 0 ? '+' : '';
    return `${sign}${formatted}%`;
  }

  private formatBudget(
    spend: number | null,
    budget: number | null,
    currency: string | null
  ): string {
    const safeCurrency = currency ?? 'USD';
    const spendLabel = this.formatCurrency(spend, safeCurrency);
    const budgetLabel = budget !== null ? this.formatCurrency(budget, safeCurrency) : '—';
    return `${spendLabel} / ${budgetLabel}`;
  }

  private calculateProgress(spend: number | null, budget: number | null): number {
    if (spend === null || budget === null || budget <= 0) {
      return 0;
    }
    return Math.min(1, spend / budget);
  }

  private normalizeStatus(status: string): 'scheduled' | 'running' | 'draft' {
    const normalized = status.toLowerCase();
    if (normalized === 'active' || normalized === 'running') {
      return 'running';
    }
    if (normalized === 'scheduled') {
      return 'scheduled';
    }
    return 'draft';
  }

  private formatNextSync(
    etaMinutes: number | null,
    lastSyncIso: string | null,
    status: 'synced' | 'attention'
  ): string {
    if (etaMinutes === null) {
      return lastSyncIso ? '—' : 'n/a';
    }
    if (etaMinutes === 0) {
      return status === 'attention' ? 'Overdue' : 'Live';
    }
    if (etaMinutes >= 60) {
      const hours = Math.round(etaMinutes / 60);
      return `${hours}h`;
    }
    return `${etaMinutes}m`;
  }

  private applyFallbackData(): void {
    this.channelPerformance.set(this.fallbackChannels);
    this.campaignSummaries.set(this.fallbackCampaigns);
    this.leadSources.set(this.fallbackLeadSources);
  }
}
