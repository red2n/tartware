import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  SettingsCategory,
  SettingsDefinition,
  SettingsOption,
  SettingsSection,
  SettingsValue,
} from '@tartware/schemas';
import { map, type Observable, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';

interface SettingsCatalogResponse {
  data: {
    categories: SettingsCategory[];
    sections: SettingsSection[];
    definitions: SettingsDefinition[];
    options: SettingsOption[];
  };
}

interface SettingsValuesResponse {
  data: SettingsValue[];
}

export interface SettingsDefinitionAggregate extends SettingsDefinition {
  options: SettingsOption[];
}

export interface SettingsSectionAggregate {
  section: SettingsSection;
  definitions: SettingsDefinitionAggregate[];
}

export interface SettingsCategoryAggregate {
  category: SettingsCategory;
  sections: SettingsSectionAggregate[];
}

@Injectable({
  providedIn: 'root',
})
export class SettingsCatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private catalogCache$?: Observable<SettingsCategoryAggregate[]>;
  private valuesCache$?: Observable<SettingsValue[]>;

  getCatalog(forceRefresh = false): Observable<SettingsCategoryAggregate[]> {
    if (!forceRefresh && this.catalogCache$) {
      return this.catalogCache$;
    }

    this.catalogCache$ = this.http
      .get<SettingsCatalogResponse>(`${this.apiUrl}/settings/catalog`)
      .pipe(
        map((response) => this.buildAggregate(response.data)),
        shareReplay(1)
      );

    return this.catalogCache$;
  }

  getValues(forceRefresh = false): Observable<SettingsValue[]> {
    if (!forceRefresh && this.valuesCache$) {
      return this.valuesCache$;
    }

    this.valuesCache$ = this.http
      .get<SettingsValuesResponse>(`${this.apiUrl}/settings/values`)
      .pipe(
        map((response) => response.data),
        shareReplay(1)
      );

    return this.valuesCache$;
  }

  private buildAggregate(data: SettingsCatalogResponse['data']): SettingsCategoryAggregate[] {
    const optionsByDefinition = data.options.reduce<Map<string, SettingsOption[]>>(
      (acc, option) => {
        if (!acc.has(option.setting_id)) {
          acc.set(option.setting_id, []);
        }
        acc.get(option.setting_id)!.push(option);
        return acc;
      },
      new Map()
    );

    const definitionsBySection = data.definitions.reduce<
      Map<string, SettingsDefinitionAggregate[]>
    >((acc, definition) => {
      if (!acc.has(definition.section_id)) {
        acc.set(definition.section_id, []);
      }
      const options = optionsByDefinition.get(definition.id) ?? [];
      acc.get(definition.section_id)!.push({
        ...definition,
        options,
      });
      return acc;
    }, new Map());

    const sectionsByCategory = data.sections.reduce<Map<string, SettingsSectionAggregate[]>>(
      (acc, section) => {
        if (!acc.has(section.category_id)) {
          acc.set(section.category_id, []);
        }

        const aggregates = acc.get(section.category_id)!;
        aggregates.push({
          section,
          definitions: definitionsBySection.get(section.id) ?? [],
        });
        return acc;
      },
      new Map()
    );

    return data.categories.map((category) => ({
      category,
      sections: (sectionsByCategory.get(category.id) ?? []).sort(
        (first, second) => first.section.sort_order - second.section.sort_order
      ),
    }));
  }
}
