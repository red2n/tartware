import { CommonModule } from '@angular/common';
import { Component, HostListener, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';
import { extractErrorMessage } from '../services/error-utils';
import { SystemSessionService } from '../services/system-session.service';

@Component({
  standalone: true,
  selector: 'app-impersonation',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="panel" aria-label="Impersonation">
      <header class="panel__head">
        <div>
          <h1>Impersonation</h1>
          <p>Select tenant and user, capture reason, and log the session start.</p>
        </div>
        <div class="hint">Calls /v1/system/impersonate (requires SYSTEM_ADMIN token).</div>
      </header>

      <div *ngIf="errorMessage()" class="banner banner--error">{{ errorMessage() }}</div>
      <div *ngIf="statusMessage()" class="banner banner--info">{{ statusMessage() }}</div>
      <div *ngIf="sessionToken()" class="banner banner--success">
        <div><strong>Session token</strong>: {{ sessionToken() }}</div>
        <div><strong>Expires at</strong>: {{ expiresAt() }}</div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="field">
          <label for="tenant">Tenant ID</label>
          <input id="tenant" type="text" formControlName="tenant_id" placeholder="tenant UUID" />
          <div class="error" *ngIf="form.controls.tenant_id.invalid && form.controls.tenant_id.touched">
            Tenant ID is required.
          </div>
        </div>

        <div class="field">
          <label for="user">User to impersonate</label>
          <input id="user" type="text" formControlName="user_id" placeholder="user UUID" />
          <div class="error" *ngIf="form.controls.user_id.invalid && form.controls.user_id.touched">
            User ID is required.
          </div>
        </div>

        <div class="field">
          <label for="reason">Reason</label>
          <textarea id="reason" rows="3" formControlName="reason"></textarea>
          <div class="error" *ngIf="form.controls.reason.invalid && form.controls.reason.touched">
            Provide a concise justification.
          </div>
        </div>

        <div class="field">
          <label for="ticket">Ticket ID</label>
          <input id="ticket" type="text" formControlName="ticket_id" />
          <div class="error" *ngIf="form.controls.ticket_id.invalid && form.controls.ticket_id.touched">
            Ticket ID is required.
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="form.invalid || loading()" [attr.aria-busy]="loading()">
            {{ loading() ? 'Starting…' : 'Start impersonation' }}
          </button>
        </div>
      </form>

      <div class="modal-backdrop" *ngIf="confirming()"></div>
      <div class="modal" role="dialog" aria-modal="true" *ngIf="confirming()">
        <h2>Confirm impersonation</h2>
        <p>Proceed to impersonate <strong>{{ form.value.user_id }}</strong> in tenant <strong>{{ form.value.tenant_id }}</strong>? This action is fully audited.</p>
        <div class="modal__actions">
          <button #cancelButton type="button" class="ghost" (click)="cancelConfirm()">Cancel</button>
          <button #confirmButton type="button" class="primary" (click)="confirmStart()" [attr.aria-busy]="loading()">Confirm</button>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./impersonation.component.scss'],
})
export class ImpersonationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  private readonly session = inject(SystemSessionService);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly loading = signal(false);
  readonly confirming = signal(false);
  readonly sessionToken = signal('');
  readonly expiresAt = signal('');

  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  readonly form = this.fb.nonNullable.group({
    tenant_id: ['', [Validators.required, Validators.minLength(8)]],
    user_id: ['', [Validators.required, Validators.minLength(8)]],
    reason: ['', [Validators.required, Validators.minLength(10)]],
    ticket_id: ['', [Validators.required, Validators.minLength(5)]],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirming.set(true);
    this.focusModalAction();
  }

  confirmStart() {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.sessionToken.set('');
    this.expiresAt.set('');

    firstValueFrom(this.auth.startImpersonation(this.form.getRawValue()))
      .then(res => {
        this.sessionToken.set(res.access_token);
        this.expiresAt.set(`${res.expires_in}s`);
        this.statusMessage.set(`Impersonation started. Scope ${res.scope}, expires in ${res.expires_in}s.`);
        this.session.setImpersonationSession({
          accessToken: res.access_token,
          tokenType: res.token_type,
          scope: res.scope,
          expiresIn: res.expires_in,
        });
      })
      .catch(err => {
        this.errorMessage.set(extractErrorMessage(err, 'Impersonation failed. Please retry.'));
      })
      .finally(() => {
        this.loading.set(false);
        this.confirming.set(false);
      });
  }

  cancelConfirm() {
    if (this.loading()) return;
    this.confirming.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    if (!this.confirming()) return;
    event.preventDefault();
    this.cancelConfirm();
  }

  @HostListener('document:keydown.tab', ['$event'])
  trapFocus(event: KeyboardEvent) {
    if (!this.confirming()) return;
    const focusable = [
      this.confirmButton?.nativeElement,
      this.cancelButton?.nativeElement,
    ].filter((el): el is HTMLButtonElement => Boolean(el));

    if (focusable.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = focusable.findIndex(el => el === active);
    if (currentIndex === -1) {
      event.preventDefault();
      focusable[0].focus();
      return;
    }

    const nextIndex = event.shiftKey
      ? (currentIndex === 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);

    if ((event.shiftKey && currentIndex === 0) || (!event.shiftKey && currentIndex === focusable.length - 1)) {
      event.preventDefault();
      focusable[nextIndex].focus();
    }
  }

  private focusModalAction() {
    setTimeout(() => {
      const target = this.confirmButton?.nativeElement ?? this.cancelButton?.nativeElement;
      target?.focus();
    }, 0);
  }
}
