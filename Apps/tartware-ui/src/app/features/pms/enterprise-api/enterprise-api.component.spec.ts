import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  EnterpriseApiService,
  type EnterpriseInsightsDto,
} from '../../../core/services/enterprise-api.service';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { EnterpriseApiComponent } from './enterprise-api.component';

class MockModuleService {
  getModuleDefinition() {
    return of({
      id: 'enterprise-api',
      name: 'Enterprise & API',
      description: 'Demo',
      tier: 'enterprise',
      category: 'Enterprise',
      features: ['API access'],
    });
  }
}

class MockTenantContextService {
  activeTenant = signal<{ id: string; name: string } | null>({
    id: 'tenant-1',
    name: 'Enterprise Tenant',
  });
  tenantName = signal('Enterprise Tenant');
}

class MockPropertyContextService {
  selectedPropertyId = signal<string | null>(null);
}

class MockEnterpriseService {
  getInsights() {
    const dto: EnterpriseInsightsDto = {
      integrations: [
        {
          name: 'NetSuite',
          type: 'Financials',
          entity: 'Ledger',
          status: 'healthy',
          latency_ms: 420,
          last_sync_at: new Date().toISOString(),
          next_sync_eta_minutes: 10,
        },
      ],
      apiUsage: {
        api_calls_24h: 1000,
        success_rate: 98,
        p95_latency_ms: 320,
        webhook_calls_24h: 120,
      },
      securityLog: [
        {
          title: 'API client created',
          timestamp: new Date().toISOString(),
          action: 'POST (201)',
          severity: 'info',
        },
      ],
    };
    return of(dto);
  }
}

describe('EnterpriseApiComponent', () => {
  let fixture: ComponentFixture<EnterpriseApiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnterpriseApiComponent],
      providers: [
        { provide: ModuleService, useClass: MockModuleService },
        { provide: TenantContextService, useClass: MockTenantContextService },
        { provide: PropertyContextService, useClass: MockPropertyContextService },
        { provide: EnterpriseApiService, useClass: MockEnterpriseService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EnterpriseApiComponent);
    fixture.detectChanges();
  });

  it('displays integration and API usage data from the service', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('NetSuite');
    expect(compiled.textContent).toContain('API calls (24h)');
    expect(compiled.textContent).toContain('API client created');
  });
});
