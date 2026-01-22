import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { SettingsCatalogResponse, SettingsValuesResponse } from '@tartware/schemas';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  getCatalog(): Observable<SettingsCatalogResponse> {
    return this.http.get<SettingsCatalogResponse>(`${this.api}/settings/catalog`);
  }

  getValues(): Observable<SettingsValuesResponse> {
    return this.http.get<SettingsValuesResponse>(`${this.api}/settings/values`);
  }
}
