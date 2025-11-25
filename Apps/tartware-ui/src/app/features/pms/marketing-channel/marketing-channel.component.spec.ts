import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  type CampaignSummaryDto,
  type ChannelPerformanceDto,
  type LeadSourceSummaryDto,
  MarketingChannelService,
} from '../../../core/services/marketing-channel.service';
import { ModuleService } from '../../../core/services/module.service';
import { PropertyContextService } from '../../../core/services/property-context.service';
import { TenantContextService } from '../../../core/services/tenant-context.service';
import { MarketingChannelComponent } from './marketing-channel.component';

class MockModuleService {
  getModuleDefinition() {
    return of({
      id: 'marketing-channel',
      name: 'Marketing & Channels',
      description: 'Test description',
      tier: 'add-on',
      category: 'Growth',
      features: ['One', 'Two'],
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

class MockMarketingService {
  getChannelPerformance() {
    const data: ChannelPerformanceDto[] = [
      {
        id: 'ch-1',
        name: 'Direct',
        type: 'DIRECT',
        average_daily_rate: 210,
        pickup_change_percent: 12,
        next_sync_eta_minutes: 5,
        last_sync_at: new Date().toISOString(),
        status: 'synced',
        total_bookings: 100,
        total_revenue: 50000,
      },
    ];
    return of(data);
  }

  getCampaignSummaries() {
    const data: CampaignSummaryDto[] = [
      {
        id: 'camp-1',
        name: 'Summer promo',
        audience: 'Leisure',
        status: 'active',
        click_through_rate: 4.5,
        budget_amount: 20000,
        actual_spend: 12000,
        budget_currency: 'USD',
        budget_utilization_percent: 60,
      },
    ];
    return of(data);
  }

  getLeadSources() {
    const data: LeadSourceSummaryDto[] = [
      {
        source: 'Website forms',
        leads: 42,
        conversion_rate: 38,
        average_booking_value: 900,
        quality: 'great',
      },
    ];
    return of(data);
  }
}

describe('MarketingChannelComponent', () => {
  let fixture: ComponentFixture<MarketingChannelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingChannelComponent, HttpClientTestingModule],
      providers: [
        { provide: ModuleService, useClass: MockModuleService },
        { provide: TenantContextService, useClass: MockTenantContextService },
        { provide: PropertyContextService, useClass: MockPropertyContextService },
        { provide: MarketingChannelService, useClass: MockMarketingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingChannelComponent);
    fixture.detectChanges();
  });

  it('renders channel data from the marketing service', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('table')?.textContent).toContain('Direct');
    expect(compiled.textContent).toContain('Summer promo');
    expect(compiled.textContent).toContain('Website forms');
  });
});
