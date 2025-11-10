import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnDestroy, signal } from '@angular/core';
import { FormBuilder, type FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
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
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  changePasswordForm: FormGroup;
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor() {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      Object.keys(this.changePasswordForm.controls).forEach((key) => {
        this.changePasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage.set('New password and confirmation do not match');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService
      .changePassword(currentPassword, newPassword)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('Password updated successfully. Redirecting...');
          setTimeout(() => {
            this.router.navigate(['/tenants']);
          }, 1200);
        },
        error: (error) => {
          this.loading.set(false);
          this.errorMessage.set(error.message || 'Failed to update password. Please try again.');
        },
      });
  }

  get currentPasswordError(): string | null {
    const control = this.changePasswordForm.get('currentPassword');
    if (control?.hasError('required') && control.touched) {
      return 'Current password is required';
    }
    if (control?.hasError('minlength') && control.touched) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  get newPasswordError(): string | null {
    const control = this.changePasswordForm.get('newPassword');
    if (control?.hasError('required') && control.touched) {
      return 'New password is required';
    }
    if (control?.hasError('minlength') && control.touched) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  get confirmPasswordError(): string | null {
    const control = this.changePasswordForm.get('confirmPassword');
    if (control?.hasError('required') && control.touched) {
      return 'Please confirm the new password';
    }
    if (
      this.changePasswordForm.get('newPassword')?.value &&
      control?.value &&
      this.changePasswordForm.get('newPassword')?.value !== control.value &&
      control.touched
    ) {
      return 'Passwords do not match';
    }
    return null;
  }

  isSubmitDisabled(): boolean {
    return this.loading() || this.changePasswordForm.invalid;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
