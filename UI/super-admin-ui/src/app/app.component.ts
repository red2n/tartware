import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UiThemeService } from '../../projects/ui-theme/src/lib/ui-theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly currentTheme = signal<'theme-light' | 'theme-dark'>('theme-light');

  constructor(
    private readonly theme: UiThemeService,
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
}
