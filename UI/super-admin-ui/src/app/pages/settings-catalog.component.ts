import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { SettingsCategory } from '@tartware/schemas';
import { firstValueFrom } from 'rxjs';
import { SettingsApiService } from '../services/settings-api.service';
import { SystemSessionService } from '../services/system-session.service';
import { extractErrorMessage } from '../services/error-utils';

type CatalogCounts = {
  categories: number;
  sections: number;
  definitions: number;
  options: number;
};

type CatalogMeta = {
  counts: CatalogCounts;
  lastUpdated: string | null;
};

type CatalogData = {
  categories: SettingsCategory[];
  sections: Array<{ category_id: string }>;
  definitions: Array<{ category_id: string }>;
  options: Array<{ setting_id: string }>;
};

@Component({
  standalone: true,
  selector: 'app-settings-catalog',
  imports: [CommonModule],
  template: `
    <section class="panel" aria-label="Settings catalog">
      <header class="panel__head">
        <div>
          <h1>Settings Catalog</h1>
          <p>Browse system settings metadata and seeded values.</p>
        </div>
        <button type="button" class="ghost" (click)="loadCatalog()" [disabled]="loading()">
          {{ loading() ? 'Refreshing…' : 'Refresh' }}
        </button>
      </header>

      <div class="banner banner--warning" *ngIf="!impersonationActive()">
        Impersonation token required. Start an impersonation session to view settings data.
      </div>
      <div class="banner" *ngIf="loading()">Loading settings catalog…</div>
      <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      <div class="banner banner--success" *ngIf="statusMessage()">{{ statusMessage() }}</div>

      <div class="stats-grid" *ngIf="catalogMeta() as meta">
        <div class="stat">
          <div class="stat__value">{{ meta.counts.categories }}</div>
          <div class="stat__label">Categories</div>
        </div>
        <div class="stat">
          <div class="stat__value">{{ meta.counts.sections }}</div>
          <div class="stat__label">Sections</div>
        </div>
        <div class="stat">
          <div class="stat__value">{{ meta.counts.definitions }}</div>
          <div class="stat__label">Definitions</div>
        </div>
        <div class="stat">
          <div class="stat__value">{{ meta.counts.options }}</div>
          <div class="stat__label">Options</div>
        </div>
        <div class="stat" *ngIf="valuesCount() !== null">
          <div class="stat__value">{{ valuesCount() }}</div>
          <div class="stat__label">Seeded Values</div>
          <div class="stat__secondary" *ngIf="valuesSampleTenant()">
            Sample tenant {{ valuesSampleTenant() }}
          </div>
        </div>
        <div class="stat" *ngIf="meta.lastUpdated">
          <div class="stat__value">{{ meta.lastUpdated | date: 'mediumDate' }}</div>
          <div class="stat__label">Last Updated</div>
        </div>
      </div>

      <div class="table" role="table" aria-label="Settings categories" *ngIf="categoryRows().length">
        <div class="table__head" role="row">
          <div role="columnheader">Code</div>
          <div role="columnheader">Category</div>
          <div role="columnheader">Sections</div>
          <div role="columnheader">Definitions</div>
        </div>
        <div class="table__row" role="row" *ngFor="let row of categoryRows()">
          <div role="cell" class="mono">{{ row.code }}</div>
          <div role="cell">
            <div class="title">{{ row.name }}</div>
            <div class="muted">{{ row.description || '—' }}</div>
          </div>
          <div role="cell">{{ row.sectionCount }}</div>
          <div role="cell">{{ row.definitionCount }}</div>
        </div>
      </div>

      <div class="empty-state" *ngIf="!loading() && !categoryRows().length">
        <p>No catalog data available yet. Refresh after impersonation is active.</p>
      </div>
    </section>
  `,
  styleUrls: ['./settings-catalog.component.scss'],
})
export class SettingsCatalogComponent implements OnInit {
  private readonly api = inject(SettingsApiService);
  private readonly session = inject(SystemSessionService);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');
  readonly catalogMeta = signal<CatalogMeta | null>(null);
  readonly catalogData = signal<CatalogData | null>(null);
  readonly valuesCount = signal<number | null>(null);
  readonly valuesSampleTenant = signal<string | null>(null);

  readonly categoryRows = computed(() => {
    const data = this.catalogData();
    if (!data) return [];

    const sectionsByCategory = new Map<string, number>();
    const definitionsByCategory = new Map<string, number>();

    for (const section of data.sections) {
      sectionsByCategory.set(
        section.category_id,
        (sectionsByCategory.get(section.category_id) ?? 0) + 1,
      );
    }

    for (const definition of data.definitions) {
      definitionsByCategory.set(
        definition.category_id,
        (definitionsByCategory.get(definition.category_id) ?? 0) + 1,
      );
    }

    return data.categories.map((category) => ({
      ...category,
      sectionCount: sectionsByCategory.get(category.id) ?? 0,
      definitionCount: definitionsByCategory.get(category.id) ?? 0,
    }));
  });

  ngOnInit(): void {
    if (this.impersonationActive()) {
      void this.loadCatalog();
    }
  }

  impersonationActive(): boolean {
    return Boolean(this.session.impersonationSession());
  }

  async loadCatalog(): Promise<void> {
    if (!this.impersonationActive()) {
      this.errorMessage.set('Impersonation token required. Start an impersonation session first.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    try {
      const catalog = await firstValueFrom(this.api.getCatalog());
      const values = await firstValueFrom(this.api.getValues());
      this.catalogMeta.set(catalog.meta);
      this.catalogData.set(catalog.data);
      this.valuesCount.set(values.meta.count);
      this.valuesSampleTenant.set(values.meta.sampleTenantId);
      this.statusMessage.set('Settings catalog loaded');
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load settings catalog'));
    } finally {
      this.loading.set(false);
    }
  }
}
