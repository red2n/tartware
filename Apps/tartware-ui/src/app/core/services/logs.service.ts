import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LogQueryParams, LogSearchResponse } from '../models/log-entry.model';

@Injectable({
  providedIn: 'root',
})
export class LogsService {
  private readonly http = inject(HttpClient);
  private readonly logsApiUrl = environment.logsApiUrl;

  searchLogs(params: LogQueryParams): Observable<LogSearchResponse> {
    const filteredEntries = Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    );
    let httpParams = new HttpParams();

    for (const [key, value] of filteredEntries) {
      const serialized = typeof value === 'string' ? value : String(value);
      httpParams = httpParams.set(key, serialized);
    }

    return this.http.get<LogSearchResponse>(`${this.logsApiUrl}/logs`, {
      params: httpParams,
    });
  }
}
