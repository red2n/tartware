import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { LogEntry } from '../../../core/models/log-entry.model';
import { LogsService } from '../../../core/services/logs.service';

@Component({
  selector: 'app-logs',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsComponent {
  private readonly logsService = inject(LogsService);
  private readonly fb = inject(FormBuilder);

  readonly filterForm = this.fb.group({
    service: [''],
    severity: [''],
    query: [''],
    from: [''],
    to: [''],
  });

  readonly severityOptions = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  readonly quickRanges = [
    { label: '15m', minutes: 15 },
    { label: '1h', minutes: 60 },
    { label: '6h', minutes: 360 },
    { label: '24h', minutes: 1440 },
  ];

  readonly entries: WritableSignal<LogEntry[]> = signal([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly total = signal(0);

  readonly hasResults = computed(() => this.entries().length > 0);

  readonly displayedColumns = ['timestamp', 'service', 'severity', 'message', 'actions'] as const;

  constructor() {
    this.loadLogs(true);
  }

  getSeverityClass(severity: string | null): string {
    const level = (severity || 'INFO').toUpperCase();
    const classMap: Record<string, string> = {
      TRACE: 'severity-trace',
      DEBUG: 'severity-debug',
      INFO: 'severity-info',
      WARN: 'severity-warn',
      ERROR: 'severity-error',
      FATAL: 'severity-fatal',
    };
    return classMap[level] || 'severity-info';
  }

  getSeverityIcon(severity: string | null): string {
    const level = (severity || 'INFO').toUpperCase();
    const iconMap: Record<string, string> = {
      TRACE: 'grain',
      DEBUG: 'bug_report',
      INFO: 'info',
      WARN: 'warning',
      ERROR: 'error',
      FATAL: 'dangerous',
    };
    return iconMap[level] || 'info';
  }

  formatLogBody(body: unknown): string {
    if (typeof body === 'string') {
      return body;
    }
    if (body === null || body === undefined) {
      return '—';
    }
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      return String(body);
    }
  }

  formatRelativeTime(timestamp: string | null): string {
    if (!timestamp) {
      return '';
    }
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) {
        return `${diffSec}s ago`;
      }
      if (diffMin < 60) {
        return `${diffMin}m ago`;
      }
      if (diffHour < 24) {
        return `${diffHour}h ago`;
      }
      return `${diffDay}d ago`;
    } catch {
      return '';
    }
  }

  getCountBySeverity(severity: string): number {
    return this.entries().filter((log) => log.severity === severity).length;
  }

  getUniqueServices(): number {
    const services = new Set(
      this.entries()
        .map((log) => log.service)
        .filter(Boolean)
    );
    return services.size;
  }

  viewLogDetails(log: LogEntry): void {
    // TODO: Open a dialog with full log details
    console.log('View log details:', log);
  }

  viewTrace(traceId: string): void {
    // TODO: Navigate to trace view or open trace details
    console.log('View trace:', traceId);
  }

  copyLog(log: LogEntry): void {
    const logText = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(logText).then(
      () => {
        console.log('Log copied to clipboard');
        // TODO: Show snackbar notification
      },
      (err) => {
        console.error('Failed to copy log:', err);
      }
    );
  }

  exportLogs(): void {
    // TODO: Export logs to CSV or JSON
    console.log('Export logs');
  }

  applyFilters(): void {
    if (this.filterForm.invalid) {
      return;
    }
    this.loadLogs(true);
  }

  resetFilters(): void {
    this.filterForm.reset({
      service: '',
      severity: '',
      query: '',
      from: '',
      to: '',
    });
    this.loadLogs(true);
  }

  loadMore(): void {
    if (!this.nextCursor()) {
      return;
    }
    this.loadLogs(false);
  }

  selectSeverity(level: string): void {
    this.filterForm.patchValue({ severity: level });
    this.applyFilters();
  }

  applyQuickRange(minutes: number): void {
    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60_000);
    this.filterForm.patchValue({
      from: from.toISOString().slice(0, 16),
      to: to.toISOString().slice(0, 16),
    });
    this.applyFilters();
  }

  formatTimestamp(value: string | null): string {
    if (!value) {
      return '—';
    }
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  private buildQueryParams(reset: boolean) {
    const { service, severity, query, from, to } = this.filterForm.getRawValue();
    return {
      service: service?.trim() || undefined,
      severity: severity || undefined,
      query: query?.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      cursor: reset ? undefined : this.nextCursor(),
      size: 50,
    };
  }

  loadLogs(reset: boolean): void {
    const params = this.buildQueryParams(reset);
    if (reset) {
      this.nextCursor.set(null);
      this.entries.set([]);
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.logsService
      .searchLogs(params)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (response) => {
          const existing = reset ? [] : this.entries();
          this.entries.set([...existing, ...response.entries]);
          this.nextCursor.set(response.nextCursor);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: (error) => {
          const message =
            error?.error?.message ??
            error?.message ??
            'Unable to load logs right now. Please retry in a moment.';
          this.errorMessage.set(message);
          this.isLoading.set(false);
        },
      });
  }
}
