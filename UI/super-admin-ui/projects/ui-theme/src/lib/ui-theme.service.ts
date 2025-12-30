import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';

export type ThemeName = 'theme-light' | 'theme-dark';

@Injectable({ providedIn: 'root' })
export class UiThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'tart.theme';

  applyTheme(theme: ThemeName) {
    if (!isPlatformBrowser(this.platformId)) return;
    const body = this.document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(theme);

    // Keep color-scheme in sync for form controls and scrollbars.
    this.document.documentElement.style.setProperty(
      'color-scheme',
      theme === 'theme-dark' ? 'dark' : 'light'
    );

    try {
      this.document.defaultView?.localStorage.setItem(this.storageKey, theme);
    } catch (_) {
      // Ignore storage failures (private mode or disabled storage).
    }
  }
}
