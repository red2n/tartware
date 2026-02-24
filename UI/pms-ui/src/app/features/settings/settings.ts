import { Component, computed, inject, type OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import type {
  SettingsCategory,
  SettingsSection,
  SettingsDefinition,
  SettingsOption,
  SettingsValue,
} from '@tartware/schemas';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

/** Shape returned by GET /v1/settings/catalog/:code */
interface CategoryCatalog {
  data: {
    category: SettingsCategory;
    sections: SettingsSection[];
    definitions: SettingsDefinition[];
    options: SettingsOption[];
  };
  meta: { counts: { sections: number; definitions: number; options: number } };
}

/** Shape returned by GET /v1/settings/categories */
interface CategoryListResponse {
  data: SettingsCategory[];
  meta: { count: number };
}

/** Shape returned by GET /v1/settings/values */
interface ValuesResponse {
  data: SettingsValue[];
  meta: { count: number; sampleTenantId: string | null };
}

/** Tracks editing state for each definition */
interface EditState {
  editing: boolean;
  saving: boolean;
  dirty: boolean;
  editValue: unknown;
  savedMessage: string | null;
  errorMessage: string | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly categories = signal<SettingsCategory[]>([]);
  readonly selectedCategory = signal<SettingsCategory | null>(null);
  readonly sections = signal<SettingsSection[]>([]);
  readonly definitions = signal<SettingsDefinition[]>([]);
  readonly options = signal<SettingsOption[]>([]);
  readonly values = signal<SettingsValue[]>([]);

  /** Per-definition edit state keyed by definition id */
  readonly editStates = signal<Record<string, EditState>>({});

  readonly loadingCategories = signal(false);
  readonly loadingCatalog = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');

  /** Definitions grouped by section_id for display */
  readonly sectionDefinitions = computed(() => {
    const defs = this.definitions();
    const sects = this.sections();
    const query = this.searchQuery().toLowerCase().trim();

    return sects
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((section) => {
        let sectionDefs = defs
          .filter((d) => d.section_id === section.id && !d.is_deprecated)
          .sort((a, b) => a.sort_order - b.sort_order);

        if (query) {
          sectionDefs = sectionDefs.filter(
            (d) =>
              d.name.toLowerCase().includes(query) ||
              d.code.toLowerCase().includes(query) ||
              d.description?.toLowerCase().includes(query),
          );
        }

        return { section, definitions: sectionDefs };
      })
      .filter((group) => group.definitions.length > 0);
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    this.error.set(null);
    try {
      const res = await this.api.get<CategoryListResponse>('/settings/categories');
      const sorted = res.data
        .filter((c) => c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);
      this.categories.set(sorted);
      if (sorted.length > 0) {
        this.selectCategory(sorted[0]);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      this.loadingCategories.set(false);
    }
  }

  async selectCategory(category: SettingsCategory): Promise<void> {
    if (this.selectedCategory()?.id === category.id) return;
    this.selectedCategory.set(category);
    this.searchQuery.set('');
    this.editStates.set({});
    this.loadingCatalog.set(true);
    this.error.set(null);
    try {
      const res = await this.api.get<CategoryCatalog>(`/settings/catalog/${category.code}`);
      this.sections.set(res.data.sections);
      this.definitions.set(res.data.definitions);
      this.options.set(res.data.options);
      await this.loadValues();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load category');
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  private async loadValues(): Promise<void> {
    try {
      const res = await this.api.get<ValuesResponse>('/settings/values');
      this.values.set(res.data);
    } catch {
      this.values.set([]);
    }
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  // ── Value access ──

  getValueRecord(defId: string): SettingsValue | undefined {
    return this.values().find((v) => v.setting_id === defId);
  }

  getDisplayValue(def: SettingsDefinition): unknown {
    const record = this.getValueRecord(def.id);
    if (record) return record.value;
    return def.default_value ?? null;
  }

  formatDisplayValue(def: SettingsDefinition): string {
    const val = this.getDisplayValue(def);
    if (val === null || val === undefined) return 'Not configured';
    if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  isJsonValue(def: SettingsDefinition): boolean {
    return def.control_type === 'JSON_EDITOR' || def.data_type === 'JSON';
  }

  isBooleanValue(def: SettingsDefinition): boolean {
    return def.control_type === 'TOGGLE' || def.data_type === 'BOOLEAN';
  }

  isNumberValue(def: SettingsDefinition): boolean {
    return (
      def.control_type === 'NUMBER_INPUT' ||
      def.control_type === 'SLIDER' ||
      def.data_type === 'INTEGER' ||
      def.data_type === 'DECIMAL' ||
      def.data_type === 'PERCENTAGE' ||
      def.data_type === 'CURRENCY'
    );
  }

  isSelectValue(def: SettingsDefinition): boolean {
    return def.control_type === 'SELECT' || def.control_type === 'RADIO_GROUP' || def.data_type === 'ENUM';
  }

  isMultiSelectValue(def: SettingsDefinition): boolean {
    return def.control_type === 'MULTI_SELECT' || def.data_type === 'MULTI_ENUM';
  }

  isDateValue(def: SettingsDefinition): boolean {
    return def.control_type === 'DATE_PICKER' || def.data_type === 'DATE';
  }

  isTextAreaValue(def: SettingsDefinition): boolean {
    return def.control_type === 'TEXT_AREA' || def.data_type === 'TEXT';
  }

  getOptions(defId: string): SettingsOption[] {
    return this.options().filter((o) => o.setting_id === defId && o.is_active);
  }

  // ── Edit state ──

  getEditState(defId: string): EditState {
    return (
      this.editStates()[defId] ?? {
        editing: false,
        saving: false,
        dirty: false,
        editValue: null,
        savedMessage: null,
        errorMessage: null,
      }
    );
  }

  startEdit(def: SettingsDefinition): void {
    if (def.is_readonly) return;
    const currentValue = this.getDisplayValue(def);
    let editValue: unknown;
    if (this.isJsonValue(def) && typeof currentValue === 'object' && currentValue !== null) {
      editValue = JSON.stringify(currentValue, null, 2);
    } else {
      editValue = currentValue;
    }
    this.editStates.update((s) => ({
      ...s,
      [def.id]: {
        editing: true,
        saving: false,
        dirty: false,
        editValue,
        savedMessage: null,
        errorMessage: null,
      },
    }));
  }

  cancelEdit(defId: string): void {
    this.editStates.update((s) => ({
      ...s,
      [defId]: { ...this.getEditState(defId), editing: false, dirty: false, errorMessage: null },
    }));
  }

  onEditValueChange(defId: string, value: unknown): void {
    this.editStates.update((s) => ({
      ...s,
      [defId]: { ...this.getEditState(defId), editValue: value, dirty: true },
    }));
  }

  onToggleChange(def: SettingsDefinition, checked: boolean): void {
    this.editStates.update((s) => ({
      ...s,
      [def.id]: {
        editing: true,
        saving: false,
        dirty: true,
        editValue: checked,
        savedMessage: null,
        errorMessage: null,
      },
    }));
    this.saveValue(def);
  }

  async saveValue(def: SettingsDefinition): Promise<void> {
    const state = this.getEditState(def.id);
    let parsedValue: unknown = state.editValue;

    if (this.isJsonValue(def) && typeof parsedValue === 'string') {
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch {
        this.editStates.update((s) => ({
          ...s,
          [def.id]: { ...state, errorMessage: 'Invalid JSON' },
        }));
        return;
      }
    }

    if (this.isNumberValue(def) && typeof parsedValue === 'string') {
      parsedValue = Number(parsedValue);
      if (Number.isNaN(parsedValue)) {
        this.editStates.update((s) => ({
          ...s,
          [def.id]: { ...state, errorMessage: 'Invalid number' },
        }));
        return;
      }
    }

    this.editStates.update((s) => ({
      ...s,
      [def.id]: { ...state, saving: true, errorMessage: null },
    }));

    const existing = this.getValueRecord(def.id);
    try {
      if (existing) {
        const updated = await this.api.patch<{ data: SettingsValue }>(
          `/settings/values/${existing.id}`,
          { value: parsedValue },
        );
        this.values.update((vals) =>
          vals.map((v) => (v.id === existing.id ? updated.data : v)),
        );
      } else {
        const created = await this.api.post<{ data: SettingsValue }>('/settings/values', {
          setting_id: def.id,
          scope_level: def.default_scope,
          value: parsedValue,
        });
        this.values.update((vals) => [...vals, created.data]);
      }

      this.editStates.update((s) => ({
        ...s,
        [def.id]: {
          editing: false,
          saving: false,
          dirty: false,
          editValue: null,
          savedMessage: 'Saved',
          errorMessage: null,
        },
      }));

      setTimeout(() => {
        this.editStates.update((s) => ({
          ...s,
          [def.id]: { ...this.getEditState(def.id), savedMessage: null },
        }));
      }, 3000);
    } catch (err) {
      this.editStates.update((s) => ({
        ...s,
        [def.id]: {
          ...this.getEditState(def.id),
          saving: false,
          errorMessage: err instanceof Error ? err.message : 'Failed to save',
        },
      }));
    }
  }

  // ── Display helpers ──

  categoryIcon(cat: SettingsCategory): string {
    return cat.icon ?? 'settings';
  }

  controlTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      TOGGLE: 'Toggle',
      TEXT_INPUT: 'Text',
      TEXT_AREA: 'Text Area',
      NUMBER_INPUT: 'Number',
      SELECT: 'Select',
      MULTI_SELECT: 'Multi Select',
      RADIO_GROUP: 'Radio',
      SLIDER: 'Slider',
      DATE_PICKER: 'Date',
      TIME_PICKER: 'Time',
      DATETIME_PICKER: 'Date & Time',
      JSON_EDITOR: 'Configuration',
      TAGS: 'Tags',
      FILE_UPLOAD: 'File Upload',
    };
    return labels[type] ?? type;
  }

  sensitivityClass(sensitivity: string): string {
    switch (sensitivity) {
      case 'CONFIDENTIAL':
        return 'badge-danger';
      case 'SENSITIVE':
        return 'badge-warning';
      case 'INTERNAL':
        return 'badge-muted';
      case 'PUBLIC':
        return 'badge-success';
      default:
        return 'badge-muted';
    }
  }

  scopeLabel(scopes: string[]): string {
    if (!scopes?.length) return '—';
    return scopes.map((s) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')).join(', ');
  }
}
