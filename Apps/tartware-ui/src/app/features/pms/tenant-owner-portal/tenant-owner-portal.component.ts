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
import type { ModuleDefinition } from '../../../core/models/module.model';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import {
  type PortalChannelStatusDto,
  type PortalEngagementMetricDto,
  type PortalRequestQueueDto,
  TenantOwnerPortalService,
} from '../../../core/services/tenant-owner-portal.service';

interface EngagementMetric {
  label: string;
  value: string;
  helper: string;
  trend: 'up' | 'down';
}

interface RequestQueue {
  type: string;
  pending: number;
  avgResponse: string;
  sla: string;
}

interface ChannelStatus {
  channel: string;
  adoption: string;
  volume: string;
  status: 'healthy' | 'watch';
}

@Component({
  selector: 'app-tenant-owner-portal',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule,
    MatListModule,
  ],
  templateUrl: './tenant-owner-portal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantOwnerPortalComponent {
  private readonly moduleService = inject(ModuleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly portalService = inject(TenantOwnerPortalService);
  readonly tenantContext = inject(TenantContextService);
  readonly propertyContext = inject(PropertyContextService);

  readonly moduleDefinition = signal<ModuleDefinition | null>(null);
  readonly definitionError = signal('');
  readonly dataError = signal('');
  readonly isLoading = signal(false);

  readonly tenantLabel = computed(() => this.tenantContext.tenantName() || 'tenant');

  readonly engagementMetrics = signal<EngagementMetric[]>([]);
  readonly requestQueues = signal<RequestQueue[]>([]);
  readonly channelStatuses = signal<ChannelStatus[]>([]);

  constructor() {
    this.enableExperienceLoad();
    this.loadModuleDefinition();
  }

  private loadModuleDefinition(): void {
    this.moduleService
      .getModuleDefinition('tenant-owner-portal')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (definition) => {
          if (!definition) {
            this.definitionError.set('Module definition for the portal experience is missing.');
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

  private enableExperienceLoad(): void {
    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();
        if (!tenant) {
          return;
        }
        this.fetchExperience(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  private fetchExperience(tenantId: string, propertyId: string | null): void {
    this.isLoading.set(true);
    this.dataError.set('');

    this.portalService
      .getExperienceSummary({ tenantId, propertyId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.engagementMetrics.set(this.toEngagementView(response.engagement));
          this.requestQueues.set(this.toQueueView(response.requestQueues));
          this.channelStatuses.set(this.toChannelView(response.channels));
          this.isLoading.set(false);
        },
        error: (error) => {
          this.dataError.set(
            error?.error?.message ?? error?.message ?? 'Unable to load portal analytics.'
          );
          this.applyFallbackData();
          this.isLoading.set(false);
        },
      });
  }

  private toEngagementView(metrics: PortalEngagementMetricDto[]): EngagementMetric[] {
    if (metrics.length === 0) {
      return this.engagementMetrics();
    }
    return metrics.map((metric) => {
      const value =
        metric.unit === 'percent'
          ? `${(metric.current ?? 0).toFixed(1)}%`
          : this.formatNumber(metric.current);
      const helper = this.describeDelta(metric.current, metric.previous, metric.unit);
      return {
        label: metric.label,
        value,
        helper,
        trend: metric.current >= (metric.previous ?? 0) ? 'up' : 'down',
      };
    });
  }

  private toQueueView(queues: PortalRequestQueueDto[]): RequestQueue[] {
    if (queues.length === 0) {
      return this.requestQueues();
    }
    return queues.map((queue) => ({
      type: queue.label,
      pending: queue.pending,
      avgResponse: this.formatDuration(queue.avg_response_minutes),
      sla: queue.sla_percent !== null ? `${queue.sla_percent.toFixed(0)}% on time` : 'n/a',
    }));
  }

  private toChannelView(channels: PortalChannelStatusDto[]): ChannelStatus[] {
    if (channels.length === 0) {
      return this.channelStatuses();
    }
    return channels.map((channel) => ({
      channel: channel.label,
      adoption: `${channel.adoption_percent.toFixed(0)}%`,
      volume: `${channel.monthly_volume.toLocaleString()} / mo`,
      status: channel.status,
    }));
  }

  private describeDelta(current: number, previous: number, unit: 'count' | 'percent'): string {
    if (!previous || previous === 0) {
      return unit === 'percent' ? 'vs last period' : '+New activity';
    }
    const delta = ((current - previous) / previous) * 100;
    const formatted = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs last period`;
    return unit === 'percent' ? formatted : formatted;
  }

  private formatNumber(value: number): string {
    return value.toLocaleString();
  }

  private formatDuration(totalMinutes: number | null): string {
    if (totalMinutes === null || Number.isNaN(totalMinutes)) {
      return '—';
    }
    const minutes = Math.max(Math.round(totalMinutes), 0);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  private applyFallbackData(): void {
    if (this.engagementMetrics().length === 0) {
      this.engagementMetrics.set([
        {
          label: 'Active tenant logins',
          value: '1,482',
          helper: '+18% MoM',
          trend: 'up',
        },
        {
          label: 'Owner statement views',
          value: '312',
          helper: '+6% MoM',
          trend: 'up',
        },
        {
          label: 'Payment portal completion',
          value: '94.3%',
          helper: '-2.1 pts vs last week',
          trend: 'down',
        },
        {
          label: 'Maintenance tickets auto-routed',
          value: '76%',
          helper: '+9 pts vs last month',
          trend: 'up',
        },
      ]);
    }
    if (this.requestQueues().length === 0) {
      this.requestQueues.set([
        { type: 'Maintenance', pending: 18, avgResponse: '1h 22m', sla: '94% on time' },
        { type: 'Payment disputes', pending: 6, avgResponse: '3h 05m', sla: '88% on time' },
        { type: 'Document signing', pending: 11, avgResponse: '47m', sla: '99% on time' },
        { type: 'Owner inquiries', pending: 4, avgResponse: '2h 14m', sla: '91% on time' },
      ]);
    }
    if (this.channelStatuses().length === 0) {
      this.channelStatuses.set([
        {
          channel: 'Email + magic links',
          adoption: '97%',
          volume: '2.4k/mo',
          status: 'healthy',
        },
        {
          channel: 'SMS notifications',
          adoption: '71%',
          volume: '860/mo',
          status: 'watch',
        },
        {
          channel: 'In-app messaging',
          adoption: '54%',
          volume: '420/mo',
          status: 'healthy',
        },
        {
          channel: 'Self-service knowledge base',
          adoption: '63%',
          volume: '1.1k/mo',
          status: 'healthy',
        },
      ]);
    }
  }
}
