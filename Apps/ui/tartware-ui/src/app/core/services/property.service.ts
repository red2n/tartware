import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PropertyWithStats } from '@tartware/schemas';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Property Service
 * Manages property data and operations using Zod schema types
 */
@Injectable({
  providedIn: 'root',
})
export class PropertyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Get properties for a tenant
   */
  getProperties(tenantId: string, limit = 50): Observable<PropertyWithStats[]> {
    const params = new HttpParams().set('tenant_id', tenantId).set('limit', limit.toString());

    return this.http.get<PropertyWithStats[]>(`${this.apiUrl}/properties`, { params });
  }
}
