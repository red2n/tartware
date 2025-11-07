import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  userId = '';
  errorMessage = signal<string>('');
  loading = signal<boolean>(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogin(): void {
    if (!this.userId.trim()) {
      this.errorMessage.set('Please enter a valid username');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.userId.trim()).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.memberships && response.memberships.length > 0) {
          this.router.navigate(['/tenants']);
        } else {
          this.errorMessage.set('No tenant memberships found for this user');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Login failed. Please check your username.');
      }
    });
  }
}
