import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Tenant } from '@tartware/schemas/core/tenants';
import { firstValueFrom } from 'rxjs';
import { TenantContextComponent } from '../components/tenant-context/tenant-context.component';
import {
  CommandCenterApiService,
  type CommandDefinition,
} from '../services/command-center-api.service';
import { extractErrorMessage } from '../services/error-utils';
import { SystemSessionService } from '../services/system-session.service';
import { TenantApiService } from '../services/tenant-api.service';

type CommandExecuteForm = {
  tenant_id: FormControl<string>;
  command_name: FormControl<string>;
  correlation_id: FormControl<string | null>;
  initiated_by_user_id: FormControl<string | null>;
  initiated_by_role: FormControl<string | null>;
  payload: FormControl<string>;
};

@Component({
  standalone: true,
  selector: 'app-command-center',
  imports: [CommonModule, ReactiveFormsModule, TenantContextComponent],
  template: `
    <section class="panel" aria-label="Command Center">
      <header class="panel__head">
        <div>
          <h1>Command Center</h1>
          <p>Submit tenant-scoped commands (requires impersonation token and tenant context).</p>
        </div>
        <div class="hint">API: POST /v1/commands/:commandName/execute</div>
      </header>

      <div class="banner banner--warning" *ngIf="!impersonationActive()">
        Start an impersonation session first (System Admin → Impersonation) to obtain a tenant token.
      </div>
      <div class="banner" *ngIf="definitionsLoading()">Loading command catalog…</div>
      <div class="banner banner--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      <div class="banner banner--success" *ngIf="statusMessage()">{{ statusMessage() }}</div>

      <form [formGroup]="form" (ngSubmit)="execute()" class="command-form" novalidate>
        <div class="form-grid">
          <div class="field full">
            <label>Tenant</label>
            <app-tenant-context
              [tenants]="tenants()"
              [selectedTenantId]="form.value.tenant_id"
              (tenantChanged)="onTenantChanged($event)"
            />
            <div class="error" *ngIf="form.controls.tenant_id.invalid && form.controls.tenant_id.touched">
              Tenant is required.
            </div>
          </div>

          <div class="field">
            <label for="command">Command</label>
            <select id="command" formControlName="command_name" (change)="onCommandChange($event)">
              <option *ngFor="let cmd of definitions()" [value]="cmd.name">{{ cmd.label }}</option>
            </select>
            <div class="hint">{{ activeDescription() }}</div>
          </div>

          <div class="field">
            <label for="correlation">Correlation ID (optional)</label>
            <input id="correlation" type="text" formControlName="correlation_id" />
          </div>

          <div class="field">
            <label for="initiatedByUser">Initiated by User ID (optional)</label>
            <input id="initiatedByUser" type="text" formControlName="initiated_by_user_id" />
          </div>

          <div class="field">
            <label for="initiatedByRole">Initiated by Role (optional)</label>
            <input id="initiatedByRole" type="text" formControlName="initiated_by_role" />
          </div>

          <div class="field full">
            <label for="payload">Payload (JSON)</label>
            <textarea id="payload" formControlName="payload" rows="16" spellcheck="false"></textarea>
            <div class="actions">
              <button type="button" class="ghost" (click)="applySample()">Apply sample for selected command</button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="form.invalid || loading()" [attr.aria-busy]="loading()">
            {{ loading() ? 'Submitting…' : 'Submit command' }}
          </button>
        </div>
      </form>
    </section>
  `,
  styleUrls: ['./command-center.component.scss'],
})
export class CommandCenterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommandCenterApiService);
  private readonly tenantApi = inject(TenantApiService);
  private readonly session = inject(SystemSessionService);

  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(false);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly definitions = signal<CommandDefinition[]>([]);
  readonly definitionsLoading = signal(false);

  readonly form = this.fb.group<CommandExecuteForm>({
    tenant_id: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
    command_name: this.fb.nonNullable.control('', [Validators.required]),
    correlation_id: this.fb.control('', []),
    initiated_by_user_id: this.fb.control('', []),
    initiated_by_role: this.fb.control('', []),
    payload: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
  });

  ngOnInit(): void {
    this.seedTenantFromContext();
    void this.loadDefinitions();
    void this.loadTenants();
  }

  impersonationActive(): boolean {
    return Boolean(this.session.impersonationSession());
  }

  hasDefinitions(): boolean {
    return this.definitions().length > 0;
  }

  activeDescription(): string {
    const name = this.form.value.command_name;
    const found = this.definitions().find((c) => c.name === name);
    return found?.description ?? '';
  }

  onCommandChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    const found = this.definitions().find((c) => c.name === select?.value);
    if (found) {
      this.form.patchValue({ command_name: found.name, payload: JSON.stringify(found.samplePayload ?? {}, null, 2) });
    }
  }

  onTenantChanged(tenantId: string): void {
    this.form.patchValue({ tenant_id: tenantId });
    this.session.setTenantContext({ tenantId });
  }

  applySample(): void {
    const name = this.form.value.command_name;
    const found = this.definitions().find((c) => c.name === name);
    if (found) {
      this.form.patchValue({ payload: JSON.stringify(found.samplePayload ?? {}, null, 2) });
    }
  }

  async execute(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.impersonationActive()) {
      this.errorMessage.set('Impersonation token required. Start an impersonation session first.');
      return;
    }

    if (!this.definitions().length) {
      this.errorMessage.set('Command catalog is unavailable. Reload the page or try again.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    try {
      const raw = this.form.getRawValue();
      let parsedPayload: Record<string, unknown>;
      try {
        parsedPayload = JSON.parse(raw.payload || '{}');
      } catch (err) {
        const parseError = err instanceof Error ? err : new Error(String(err));
        const details = parseError.message ? `: ${parseError.message}` : '';
        throw new Error(`Payload must be valid JSON${details}`);
      }

      const metadata = raw.initiated_by_user_id && raw.initiated_by_role
        ? { initiated_by: { user_id: raw.initiated_by_user_id, role: raw.initiated_by_role } }
        : undefined;

      const response = await firstValueFrom(
        this.api.execute(raw.command_name, {
          tenant_id: raw.tenant_id,
          payload: parsedPayload,
          correlation_id: raw.correlation_id || undefined,
          initiated_by: metadata?.initiated_by,
        })
      );

      this.statusMessage.set(
        `Command ${response.commandName} accepted as ${response.commandId} for tenant ${response.tenantId}. Target service ${response.targetService}.`,
      );
      this.session.setTenantContext({ tenantId: raw.tenant_id });
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Command submission failed. Fix the payload or try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTenants(): Promise<void> {
    try {
      const data = await firstValueFrom(this.tenantApi.listTenants());
      this.tenants.set(data);
      if (!this.form.value.tenant_id && data.length === 1) {
        this.form.patchValue({ tenant_id: data[0].id });
      }
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load tenants.'));
    }
  }

  private async loadDefinitions(): Promise<void> {
    this.definitionsLoading.set(true);
    try {
      const defs = await firstValueFrom(this.api.listDefinitions());
      this.definitions.set(defs);

      if (defs.length > 0) {
        const current = this.form.value.command_name;
        const match = defs.find((d) => d.name === current) ?? defs[0];
        this.form.patchValue({
          command_name: match.name,
          payload: JSON.stringify(match.samplePayload ?? {}, null, 2),
        });
      }
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to load command catalog.'));
    } finally {
      this.definitionsLoading.set(false);
    }
  }

  private seedTenantFromContext(): void {
    const ctx = this.session.tenantContext();
    if (ctx?.tenantId) {
      this.form.patchValue({ tenant_id: ctx.tenantId });
    }
  }
}
