import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { Tenant } from '@tartware/schemas/core/tenants';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  listTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.api}/system/tenants`);
  }
}
