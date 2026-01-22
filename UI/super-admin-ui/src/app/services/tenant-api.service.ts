import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { TenantCollectionResponse } from '@tartware/schemas';
import type { TenantWithRelations } from '@tartware/schemas/core/tenants';
import { Observable, map } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private readonly tenantListPath: string;

  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE) private readonly api: string,
  ) {
    this.tenantListPath = `${this.api}/system/tenants`;
  }

  listTenants(limit = 50): Observable<TenantWithRelations[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<TenantCollectionResponse>(this.tenantListPath, { params })
      .pipe(map((response) => response.tenants));
  }
}
