import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatTooltipModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class TopbarComponent {
  readonly menuToggle = output<void>();

  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly isDark = this.theme.isDark;
  readonly themeMode = this.theme.themeMode;

  toggleTheme(): void {
    const next = this.isDark() ? 'LIGHT' : 'DARK';
    this.theme.setTheme(next);
  }

  async setTheme(mode: 'LIGHT' | 'DARK' | 'SYSTEM'): Promise<void> {
    await this.theme.setTheme(mode);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
