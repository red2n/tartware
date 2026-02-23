import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

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
  private readonly router = inject(Router);

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
      // Load user theme preference after login
      await this.theme.loadPreferences();
      this.router.navigate(['/dashboard']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
