import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import type { Tenant } from '@tartware/schemas/core/tenants';
import { TenantApiService } from '../../services/tenant-api.service';
import { SystemSessionService } from '../../services/system-session.service';

@Component({
  selector: 'app-tenant-context',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>Tenant</mat-label>
      <mat-select [formControl]="tenantControl" (selectionChange)="handleTenantChange($event.value)">
        <mat-option *ngFor="let tenant of tenants" [value]="tenant.id">
          {{ tenant.name }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
  styles: [
    `:host { display: block; }
     mat-form-field { width: 100%; }
    `,
  ],
})
export class TenantContextComponent implements OnInit, OnChanges {
  @Input({ required: false }) tenants: Tenant[] = [];
  @Input({ required: false }) selectedTenantId?: string | null;
  @Output() tenantChanged = new EventEmitter<string>();

  tenantControl = new FormControl<string | null>(null);

  constructor(private readonly session: SystemSessionService, private readonly tenantApi: TenantApiService) {}

  ngOnInit(): void {
    this.hydrateFromInputs();
    if (!this.tenants.length) {
      this.tenantApi.listTenants().subscribe((data) => {
        this.tenants = data;
        this.hydrateFromInputs();
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedTenantId'] && !changes['selectedTenantId'].firstChange) {
      this.hydrateFromInputs();
    }
  }

  handleTenantChange(tenantId: string): void {
    this.tenantChanged.emit(tenantId);
  }

  private hydrateFromInputs() {
    if (this.selectedTenantId) {
      this.tenantControl.setValue(this.selectedTenantId);
      return;
    }

    const context = this.session.tenantContext();
    if (context?.tenantId) {
      this.tenantControl.setValue(context.tenantId);
    }
  }
}
