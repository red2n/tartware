import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

export interface CommandExecuteRequest {
  tenant_id: string;
  payload: Record<string, unknown>;
  correlation_id?: string;
  initiated_by?: {
    user_id: string;
    role: string;
  };
}

export interface CommandExecuteResponse {
  status: 'accepted';
  commandId: string;
  commandName: string;
  tenantId: string;
  correlationId?: string;
  targetService: string;
  requestedAt: string;
}

export interface CommandDefinition {
  name: string;
  label: string;
  description: string;
  samplePayload?: Record<string, unknown>;
}

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
