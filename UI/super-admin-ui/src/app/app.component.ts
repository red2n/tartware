import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UiThemeService } from '../../projects/ui-theme/src/lib/ui-theme.service';
import { SystemSessionService } from './services/system-session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly currentTheme = signal<'theme-light' | 'theme-dark'>('theme-light');

  constructor(
    private readonly theme: UiThemeService,
    private readonly session: SystemSessionService,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    if (isPlatformBrowser(platformId)) {
      const active = document.body.classList.contains('theme-dark')
        ? 'theme-dark'
        : 'theme-light';
      this.currentTheme.set(active);
      this.theme.applyTheme(active);
    }
  }

  toggleTheme() {
    const next = this.currentTheme() === 'theme-light' ? 'theme-dark' : 'theme-light';
    this.currentTheme.set(next);
    this.theme.applyTheme(next);
  }

  get adminSession() {
    return this.session.adminSession();
  }

  signOut() {
    this.session.clearAdminSession();
  }
}
