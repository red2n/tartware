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
import type { ModuleDefinition } from '../../../core/models/module.model';
import {
  EnterpriseApiService,
  type EnterpriseInsightsDto,
  type EnterpriseIntegrationStatusDto,
  type EnterpriseSecurityEventDto,
} from '../../../core/services/enterprise-api.service';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

interface IntegrationStatus {
  name: string;
  type: string | null;
  status: 'healthy' | 'warning';
  latency: string;
  lastSync: string;
}

interface ApiUsage {
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
}

interface SecurityEvent {
  title: string;
  timestamp: string;
  action: string;
  severity: 'info' | 'warning';
}

@Component({
  selector: 'app-enterprise-api',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTableModule,
    MatListModule,
  ],
  templateUrl: './enterprise-api.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseApiComponent {
  private readonly moduleService = inject(ModuleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enterpriseService = inject(EnterpriseApiService);
  readonly tenantContext = inject(TenantContextService);
  readonly propertyContext = inject(PropertyContextService);

  readonly moduleDefinition = signal<ModuleDefinition | null>(null);
  readonly definitionError = signal('');
  readonly dataError = signal('');
  readonly isLoading = signal(false);

  readonly integrationStatuses = signal<IntegrationStatus[]>([]);
  readonly apiUsage = signal<ApiUsage[]>([]);
  readonly securityLog = signal<SecurityEvent[]>([]);

  readonly tenantLabel = computed(() => this.tenantContext.tenantName() || 'enterprise tenant');

  readonly integrationColumns = ['name', 'type', 'latency', 'lastSync', 'status'];

  constructor() {
    this.enableInsightsLoad();
    this.loadModuleDefinition();
  }

  private loadModuleDefinition(): void {
    this.moduleService
      .getModuleDefinition('enterprise-api')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (definition) => {
          if (!definition) {
            this.definitionError.set('Module definition for enterprise insights is missing.');
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

  private enableInsightsLoad(): void {
    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();
        if (!tenant) {
          return;
        }
        this.fetchInsights(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  private fetchInsights(tenantId: string, propertyId: string | null): void {
    this.isLoading.set(true);
    this.dataError.set('');

    this.enterpriseService
      .getInsights({ tenantId, propertyId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (insights) => {
          this.integrationStatuses.set(this.toIntegrationView(insights.integrations));
          this.apiUsage.set(this.toApiUsageView(insights.apiUsage));
          this.securityLog.set(this.toSecurityLogView(insights.securityLog));
          this.isLoading.set(false);
        },
        error: (error) => {
          this.dataError.set(error?.error?.message ?? error?.message ?? 'Unable to load insights.');
          this.applyFallbackData();
          this.isLoading.set(false);
        },
      });
  }

  private toIntegrationView(statuses: EnterpriseIntegrationStatusDto[]): IntegrationStatus[] {
    if (statuses.length === 0) {
      return this.integrationStatuses();
    }
    return statuses.map((status) => ({
      name: status.name,
      type: status.type ?? status.entity ?? 'Integration',
      status: status.status,
      latency: status.latency_ms !== null ? this.formatLatency(status.latency_ms) : '—',
      lastSync: this.describeSync(status.last_sync_at, status.next_sync_eta_minutes),
    }));
  }

  private toApiUsageView(dto: EnterpriseInsightsDto['apiUsage']): ApiUsage[] {
    return [
      {
        label: 'API calls (24h)',
        value: this.formatNumber(dto.api_calls_24h),
        trend: this.describeChange(dto.api_calls_24h),
        direction: 'up',
      },
      {
        label: 'P95 latency',
        value: dto.p95_latency_ms !== null ? this.formatLatency(dto.p95_latency_ms) : 'n/a',
        trend: 'Realtime',
        direction: 'down',
      },
      {
        label: 'Success rate',
        value: `${dto.success_rate.toFixed(1)}%`,
        trend: 'Last 24h',
        direction: dto.success_rate >= 95 ? 'up' : 'down',
      },
      {
        label: 'Webhooks delivered',
        value: this.formatNumber(dto.webhook_calls_24h),
        trend: 'Last 24h',
        direction: 'up',
      },
    ];
  }

  private toSecurityLogView(log: EnterpriseSecurityEventDto[]): SecurityEvent[] {
    if (log.length === 0) {
      return this.securityLog();
    }
    return log.map((entry) => ({
      title: entry.title,
      timestamp: entry.timestamp ? new Date(entry.timestamp).toUTCString() : 'Recent',
      action: entry.action,
      severity: entry.severity,
    }));
  }

  private formatLatency(valueMs: number): string {
    if (valueMs < 1000) {
      return `${Math.round(valueMs)} ms`;
    }
    return `${(valueMs / 1000).toFixed(1)} s`;
  }

  private describeSync(lastSyncIso: string | null, nextEta: number | null): string {
    if (nextEta === 0) {
      return 'Live';
    }
    if (nextEta !== null) {
      return nextEta >= 60 ? `${Math.round(nextEta / 60)}h` : `${nextEta}m`;
    }
    if (lastSyncIso) {
      const last = new Date(lastSyncIso);
      const diffMinutes = Math.round((Date.now() - last.getTime()) / 60000);
      if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
      }
      const hours = Math.round(diffMinutes / 60);
      return `${hours}h ago`;
    }
    return 'n/a';
  }

  private describeChange(value: number): string {
    if (value === 0) {
      return 'Stable';
    }
    return value > 0 ? '+vs last 24h' : '-vs last 24h';
  }

  private formatNumber(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return value.toString();
  }

  private applyFallbackData(): void {
    if (this.integrationStatuses().length === 0) {
      this.integrationStatuses.set([
        {
          name: 'Oracle NetSuite',
          type: 'Ledger export',
          status: 'healthy',
          latency: '420 ms',
          lastSync: '3m ago',
        },
        {
          name: 'Okta SSO',
          type: 'Authentication',
          status: 'healthy',
          latency: '186 ms',
          lastSync: 'live',
        },
        {
          name: 'Salesforce',
          type: 'Pipeline sync',
          status: 'warning',
          latency: '1.8 s',
          lastSync: '17m ago',
        },
        {
          name: 'Kafka bridge',
          type: 'Events',
          status: 'healthy',
          latency: '95 ms',
          lastSync: 'live',
        },
      ]);
    }
    if (this.apiUsage().length === 0) {
      this.apiUsage.set([
        { label: 'API calls (24h)', value: '2.3M', trend: '+12% vs avg', direction: 'up' },
        { label: 'P95 latency', value: '312 ms', trend: '-36 ms vs last week', direction: 'down' },
        { label: 'Success rate', value: '98.4%', trend: '-0.8 pts', direction: 'down' },
        { label: 'Webhooks delivered', value: '184k', trend: '+5.1% MoM', direction: 'up' },
      ]);
    }
    if (this.securityLog().length === 0) {
      this.securityLog.set([
        {
          title: 'New API client generated',
          timestamp: 'Today 09:42 UTC',
          action: 'Scope: reporting.read',
          severity: 'info',
        },
        {
          title: 'SSO assertion failure',
          timestamp: 'Today 07:15 UTC',
          action: 'Blocked from CN region',
          severity: 'warning',
        },
        {
          title: 'Key rotation completed',
          timestamp: 'Yesterday 22:06 UTC',
          action: 'Automation service rotated shared secrets',
          severity: 'info',
        },
      ]);
    }
  }
}
