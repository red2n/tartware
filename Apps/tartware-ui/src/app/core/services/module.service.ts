import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, type Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ModuleDefinition, ModuleId, TenantModules } from '../models/module.model';

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private catalogCache$?: Observable<ModuleDefinition[]>;
  private tenantModuleCache = new Map<string, Observable<ModuleId[]>>();

  readonly lastKnownModules = signal<ModuleId[]>(['core']);

  getModuleCatalog(forceRefresh = false): Observable<ModuleDefinition[]> {
    if (!forceRefresh && this.catalogCache$) {
      return this.catalogCache$;
    }

    this.catalogCache$ = this.http
      .get<ModuleDefinition[]>(`${this.apiUrl}/modules/catalog`)
      .pipe(shareReplay(1));
    return this.catalogCache$;
  }

  getTenantModules(tenantId: string, forceRefresh = false): Observable<ModuleId[]> {
    const cacheKey = tenantId;
    if (!forceRefresh && this.tenantModuleCache.has(cacheKey)) {
      return this.tenantModuleCache.get(cacheKey)!;
    }

    const request$ = this.http
      .get<TenantModules>(`${this.apiUrl}/tenants/${tenantId}/modules`)
      .pipe(
        map((response) => response.modules),
        tap((modules) => {
          if (modules.length > 0) {
            this.lastKnownModules.set(modules);
          }
        }),
        catchError((error) => {
          // Preserve previous modules on error but surface the failure.
          if (this.lastKnownModules().length > 0) {
            return of(this.lastKnownModules());
          }
          return throwError(() => error);
        }),
        shareReplay(1)
      );

    this.tenantModuleCache.set(cacheKey, request$);
    return request$;
  }

  clearTenantModules(tenantId: string): void {
    this.tenantModuleCache.delete(tenantId);
    this.lastKnownModules.set(['core']);
  }
}
