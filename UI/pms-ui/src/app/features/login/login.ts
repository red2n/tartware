import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly ctx = inject(TenantContextService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  username = '';
  password = '';
  hidePassword = signal(true);
  loading = signal(false);
  error = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  constructor() {
    // Login screen always starts in light mode
    this.theme.setLoginDefault();
  }

  async onSubmit(): Promise<void> {
    if (!this.username || !this.password) {
      this.error.set('Username and password are required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.login(this.username, this.password);
      // Signal the browser to save credentials
      if ('PasswordCredential' in window) {
        const cred = new (window as any).PasswordCredential({ id: this.username, password: this.password });
        navigator.credentials.store(cred).catch(() => {});
      }
      // Load user theme preference after login
      await this.theme.loadPreferences();

      // Load properties and handle selection
      const properties = await this.ctx.fetchProperties();

      if (this.ctx.hasPropertySelected()) {
        // Returning user — saved property still valid, go straight in
        this.router.navigate(['/dashboard']);
      } else if (properties.length <= 1) {
        // 0 or 1 property — auto-selected by service, no picker needed
        this.router.navigate(['/dashboard']);
      } else {
        // Multiple properties, none saved — show picker
        await this.showPropertyPicker(properties);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private async showPropertyPicker(properties: import('../../core/context/tenant-context.service').PropertyOption[]): Promise<void> {
    const { PropertyPickerDialogComponent } = await import('./property-picker-dialog/property-picker-dialog');

    const membership = this.auth.activeMembership();
    const dialogRef = this.dialog.open(PropertyPickerDialogComponent, {
      data: { properties, tenantName: membership?.tenant_name },
      disableClose: true,
      width: '440px',
    });

    const selectedId = await firstValueFrom(dialogRef.afterClosed());
    if (selectedId) {
      this.ctx.selectProperty(selectedId);
    }
    this.router.navigate(['/dashboard']);
  }
}
