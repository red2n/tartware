import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import type { PerformanceReport } from '../../../core/models/report.model';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { ReportService } from '../../../core/services/report.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';

@Component({
  selector: 'app-reports',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  private reportService = inject(ReportService);
  private destroyRef = inject(DestroyRef);

  report = signal<PerformanceReport | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string>('');

  startDate = signal<string>('');
  endDate = signal<string>('');

  displayedSourceColumns = ['source', 'reservations', 'revenue'];

  constructor() {
    effect(
      () => {
        const tenant = this.tenantContext.activeTenant();
        const propertyId = this.propertyContext.selectedPropertyId();

        if (!tenant) {
          return;
        }

        this.fetchReport(tenant.id, propertyId);
      },
      { allowSignalWrites: true }
    );
  }

  loadReport(): void {
    const tenant = this.tenantContext.activeTenant();
    if (!tenant) {
      return;
    }

    const propertyId = this.propertyContext.selectedPropertyId();
    this.fetchReport(tenant.id, propertyId);
  }

  private fetchReport(tenantId: string, propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.reportService
      .getPerformanceReport(tenantId, {
        propertyId,
        startDate: this.startDate() || undefined,
        endDate: this.endDate() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.report.set(data);
          this.isLoading.set(false);
        },
        error: (error) => {
          const message = error?.error?.message ?? error?.message ?? 'Failed to load report data.';
          this.errorMessage.set(message);
          this.report.set(null);
          this.isLoading.set(false);
        },
      });
  }

  clearDates(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.loadReport();
  }

  onStartDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.startDate.set(value);
  }

  onEndDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.endDate.set(value);
  }

  statusEntries(report: PerformanceReport | null): { label: string; value: number }[] {
    if (!report) {
      return [];
    }
    const { statusSummary } = report;
    return [
      { label: 'Confirmed', value: statusSummary.confirmed },
      { label: 'Pending', value: statusSummary.pending },
      { label: 'Checked In', value: statusSummary.checked_in },
      { label: 'Checked Out', value: statusSummary.checked_out },
      { label: 'Cancelled', value: statusSummary.cancelled },
      { label: 'No Show', value: statusSummary.no_show },
    ];
  }
}
