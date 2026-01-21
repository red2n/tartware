import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
import { Observable, map } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  private readonly tenantListPath = `${this.api}/system/tenants`;

  listTenants(limit = 50): Observable<TenantWithRelations[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<{ tenants: TenantWithRelations[] }>(this.tenantListPath, { params })
      .pipe(map((response) => response.tenants));
  }
}
