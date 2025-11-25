import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnDestroy, signal } from '@angular/core';
import { FormBuilder, type FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

/**
 * Login Component
 * Handles user authentication with reactive forms
 * Implements best practices:
 * - Reactive forms for better validation
 * - Signal-based state management
 * - Proper unsubscription with takeUntil
 * - Error handling
 * - Loading states
 * - Return URL support
 * - Modern inject() function for DI
 * - OnPush change detection for performance
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnDestroy {
  // Inject dependencies using modern inject() function
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Form group for reactive form management
  loginForm: FormGroup;

  // Signals for reactive state
  errorMessage = signal<string>('');
  loading = signal<boolean>(false);

  // Subject for managing subscriptions
  private destroy$ = new Subject<void>();

  // Return URL for redirect after login
  private returnUrl: string;
  readonly demoCredentials = environment.prefillCredentials;

  constructor() {
    const defaults = this.demoCredentials ?? { username: '', password: '' };
    // Initialize reactive form with validators
    this.loginForm = this.fb.group({
      username: [defaults.username, [Validators.required, Validators.minLength(3)]],
      password: [defaults.password, [Validators.required, Validators.minLength(8)]],
    });

    // Get return URL from query params, default to /tenants
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/tenants';

    // Check if there's a session expired message
    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'session-expired') {
      this.errorMessage.set('Your session has expired. Please login again.');
    }
  }

  /**
   * Handle form submission
   * Validates form and calls authentication service
   */
  onLogin(): void {
    // Mark all fields as touched to show validation errors
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    const username = this.loginForm.get('username')?.value?.trim();
    const password = (this.loginForm.get('password')?.value ?? '').toString().trim();
    if (!username || password.length === 0) {
      this.errorMessage.set('Please provide both username and password');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService
      .login(username, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          if (response.must_change_password) {
            this.router.navigate(['/change-password']);
            return;
          }
          if (!response.memberships || response.memberships.length === 0) {
            this.errorMessage.set('No tenant memberships found for this user');
            return;
          }
          this.router.navigate([this.returnUrl]);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err.message || 'Login failed. Please verify your credentials.');
        },
      });
  }

  /**
   * Get error message for username field
   * @returns Error message string or null
   */
  getUsernameError(): string | null {
    const control = this.loginForm.get('username');
    if (control?.hasError('required') && control.touched) {
      return 'Username is required';
    }
    if (control?.hasError('minlength') && control.touched) {
      return 'Username must be at least 3 characters';
    }
    return null;
  }

  /**
   * Get error message for password field
   * @returns Error message string or null
   */
  getPasswordError(): string | null {
    const control = this.loginForm.get('password');
    if (control?.hasError('required') && control.touched) {
      return 'Password is required';
    }
    if (control?.hasError('minlength') && control.touched) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  /**
   * Check if submit button should be disabled
   * @returns True if form is invalid or loading
   */
  isSubmitDisabled(): boolean {
    return this.loginForm.invalid || this.loading();
  }

  /**
   * Clean up subscriptions on component destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
