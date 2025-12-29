import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="panel" aria-label="Login">
      <header class="panel__head">
        <div>
          <h1>Secure login</h1>
          <p>Use your admin credentials and MFA to enter the console.</p>
        </div>
        <div class="hint">Contract-ready; calls /v1/system/auth/login.</div>
      </header>

      <div *ngIf="errorMessage()" class="banner banner--error">{{ errorMessage() }}</div>
      <div *ngIf="statusMessage()" class="banner banner--info">{{ statusMessage() }}</div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="field">
          <label for="username">Username</label>
          <input id="username" type="text" formControlName="username" autocomplete="username" />
          <div class="error" *ngIf="form.controls.username.invalid && form.controls.username.touched">
            Enter your admin username.
          </div>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          <div class="error" *ngIf="form.controls.password.invalid && form.controls.password.touched">
            Password is required (min 8 chars).
          </div>
        </div>

        <div class="field">
          <label for="mfa">MFA code</label>
          <input id="mfa" type="text" inputmode="numeric" maxlength="6" formControlName="mfa_code" autocomplete="one-time-code" />
          <div class="error" *ngIf="form.controls.mfa_code.invalid && form.controls.mfa_code.touched">
            Provide a 6-digit code.
          </div>
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
            {{ loading() ? 'Signing in…' : 'Continue' }}
          </button>
        </div>
      </form>
    </section>
  `,
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AdminAuthService);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    mfa_code: ['', [Validators.pattern(/^\d{6}$/)]],
    device_fingerprint: ['ui-device-01', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    firstValueFrom(this.auth.login(this.form.getRawValue()))
      .then(res => {
        this.statusMessage.set(`Signed in. Session ends in ${res.expires_in}s. Token type ${res.token_type}.`);
      })
      .catch(err => {
        this.errorMessage.set(this.normalizeError(err));
      })
      .finally(() => this.loading.set(false));
  }

  private normalizeError(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) return String((err as any).message);
    return 'Login failed. Please retry.';
  }
}
