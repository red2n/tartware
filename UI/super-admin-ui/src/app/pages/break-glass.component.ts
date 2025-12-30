import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';
import { generateDeviceFingerprint } from '../services/device-fingerprint';
import { extractErrorMessage } from '../services/error-utils';
import { SystemSessionService } from '../services/system-session.service';

@Component({
  standalone: true,
  selector: 'app-break-glass',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="panel" aria-label="Break-glass access">
      <header class="panel__head">
        <div>
          <h1>Break-glass access</h1>
          <p>Use in emergencies only. Capture who, why, and OTP.</p>
        </div>
        <div class="hint">Calls /v1/system/auth/break-glass with audit.</div>
      </header>

      <div *ngIf="errorMessage()" class="banner banner--error">{{ errorMessage() }}</div>
      <div *ngIf="statusMessage()" class="banner banner--info">{{ statusMessage() }}</div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="field">
          <label for="username">Admin username</label>
          <input id="username" type="text" formControlName="username" autocomplete="username" />
          <div class="error" *ngIf="form.controls.username.invalid && form.controls.username.touched">
            Required for audit.
          </div>
        </div>

        <div class="field">
          <label for="reason">Justification</label>
          <textarea id="reason" rows="3" formControlName="reason"></textarea>
          <div class="error" *ngIf="form.controls.reason.invalid && form.controls.reason.touched">
            Provide a concise justification.
          </div>
        </div>

        <div class="field">
          <label for="otp">Break-glass code</label>
          <input id="otp" type="text" inputmode="text" maxlength="32" formControlName="break_glass_code" />
          <div class="error" *ngIf="form.controls.break_glass_code.invalid && form.controls.break_glass_code.touched">
            Provide the issued break-glass code.
          </div>
        </div>

        <div class="field">
          <label for="ticket">Ticket ID (optional)</label>
          <input id="ticket" type="text" formControlName="ticket_id" />
        </div>

        <div class="field">
          <label for="fingerprint">Device fingerprint</label>
          <input id="fingerprint" type="text" formControlName="device_fingerprint" />
          <div class="error" *ngIf="form.controls.device_fingerprint.invalid && form.controls.device_fingerprint.touched">
            Provide a device fingerprint (min 8 chars).
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="form.invalid || loading()" [attr.aria-busy]="loading()">
            {{ loading() ? 'Requesting…' : 'Request access' }}
          </button>
        </div>
      </form>
    </section>
  `,
  styleUrls: ['./break-glass.component.scss'],
})
export class BreakGlassComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  private readonly session = inject(SystemSessionService);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    break_glass_code: ['', [Validators.required, Validators.minLength(8)]],
    reason: ['', [Validators.required, Validators.minLength(10)]],
    ticket_id: ['', [Validators.minLength(3)]],
    device_fingerprint: [generateDeviceFingerprint(), [Validators.required, Validators.minLength(8)]],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    firstValueFrom(this.auth.breakGlass(this.form.getRawValue()))
      .then(res => {
        this.session.setAdminSession(res);
        const adminLabel = res.admin?.username ?? 'admin';
        this.statusMessage.set(`Break-glass accepted for ${adminLabel}. Expires in ${res.expires_in}s.`);
      })
      .catch(err => {
        this.errorMessage.set(extractErrorMessage(err, 'Break-glass request failed. Please retry.'));
      })
      .finally(() => this.loading.set(false));
  }
}
