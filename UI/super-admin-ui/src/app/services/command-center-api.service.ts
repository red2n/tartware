import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type {
  CommandDefinition,
  CommandExecuteRequest,
  CommandExecuteResponse,
} from '@tartware/schemas';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

@Injectable({ providedIn: 'root' })
export class CommandCenterApiService {
  constructor(private readonly http: HttpClient, @Inject(API_BASE) private readonly api: string) {}

  listDefinitions(): Observable<CommandDefinition[]> {
    return this.http.get<CommandDefinition[]>(`${this.api}/commands/definitions`);
  }

  execute(commandName: string, body: CommandExecuteRequest): Observable<CommandExecuteResponse> {
    const payload = {
      tenant_id: body.tenant_id,
      payload: body.payload,
      correlation_id: body.correlation_id,
      metadata: body.initiated_by
        ? {
            initiated_by: body.initiated_by,
          }
        : undefined,
    };

    return this.http.post<CommandExecuteResponse>(`${this.api}/commands/${commandName}/execute`, payload);
  }
}
