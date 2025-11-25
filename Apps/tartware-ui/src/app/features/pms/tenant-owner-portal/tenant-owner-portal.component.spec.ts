import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import {
  type PortalExperienceResponseDto,
  TenantOwnerPortalService,
} from '../../../core/services/tenant-owner-portal.service';
import { TenantOwnerPortalComponent } from './tenant-owner-portal.component';

class MockModuleService {
  getModuleDefinition() {
    return of({
      id: 'tenant-owner-portal',
      name: 'Tenant Portal',
      description: 'Demo',
      tier: 'add-on',
      category: 'Experience',
      features: ['One'],
    });
  }
}

class MockTenantContextService {
  activeTenant = signal<{ id: string; name: string } | null>({
    id: 'tenant-1',
    name: 'Demo Tenant',
  });
  tenantName = signal('Demo Tenant');
}

class MockPropertyContextService {
  selectedPropertyId = signal<string | null>(null);
}

class MockPortalService {
  getExperienceSummary() {
    const response: PortalExperienceResponseDto = {
      engagement: [
        {
          key: 'activeMembers',
          label: 'Active tenant logins',
          unit: 'count',
          current: 1500,
          previous: 1200,
        },
      ],
      requestQueues: [
        {
          key: 'maintenance',
          label: 'Maintenance',
          pending: 5,
          avg_response_minutes: 90,
          sla_percent: 96,
        },
      ],
      channels: [
        {
          key: 'mobile_app',
          label: 'In-app messaging',
          adoption_percent: 60,
          monthly_volume: 420,
          completion_rate: 92,
          status: 'healthy',
        },
      ],
    };
    return of(response);
  }
}

describe('TenantOwnerPortalComponent', () => {
  let fixture: ComponentFixture<TenantOwnerPortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantOwnerPortalComponent],
      providers: [
        { provide: ModuleService, useClass: MockModuleService },
        { provide: TenantContextService, useClass: MockTenantContextService },
        { provide: PropertyContextService, useClass: MockPropertyContextService },
        { provide: TenantOwnerPortalService, useClass: MockPortalService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantOwnerPortalComponent);
    fixture.detectChanges();
  });

  it('renders engagement metrics from the portal service', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Active tenant logins');
    expect(compiled.textContent).toContain('Maintenance');
    expect(compiled.textContent).toContain('In-app messaging');
  });
});
