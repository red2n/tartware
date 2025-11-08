import { isPlatformBrowser } from '@angular/common';
import { effect, Injectable, inject, PLATFORM_ID, signal } from '@angular/core';

/**
 * Theme Service
 * Manages application theme (light/dark mode)
 * Supports user preference detection and persistence
 *
 * Reference: https://m3.material.io/foundations/design-tokens
 *
 * @example Usage in Component
 * ```typescript
 * export class MyComponent {
 *   themeService = inject(ThemeService);
 *
 *   toggleTheme() {
 *     this.themeService.toggleTheme();
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Signal for reactive theme state
  private isDarkMode = signal<boolean>(false);

  // Public readonly signal
  readonly isDark = this.isDarkMode.asReadonly();

  // Storage key for theme preference
  private readonly THEME_STORAGE_KEY = 'tartware-theme';

  constructor() {
    // Initialize theme from storage or system preference
    if (isPlatformBrowser(this.platformId)) {
      this.initializeTheme();
      this.watchSystemPreference();
    }

    // Effect to apply theme changes to DOM
    effect(() => {
      this.applyTheme(this.isDarkMode());
    });
  }

  /**
   * Initialize theme from localStorage or system preference
   * @private
   */
  private initializeTheme(): void {
    const savedTheme = this.getSavedTheme();

    if (savedTheme !== null) {
      // Use saved preference
      this.isDarkMode.set(savedTheme === 'dark');
    } else {
      // Use system preference
      const prefersDark = this.getSystemPreference();
      this.isDarkMode.set(prefersDark);
    }
  }

  /**
   * Get saved theme from localStorage
   * @private
   * @returns 'light' | 'dark' | null
   */
  private getSavedTheme(): 'light' | 'dark' | null {
    try {
      const saved = localStorage.getItem(this.THEME_STORAGE_KEY);
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch {
      return null;
    }
  }

  /**
   * Get system color scheme preference
   * @private
   * @returns true if dark mode is preferred
   */
  private getSystemPreference(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Watch for system preference changes
   * @private
   */
  private watchSystemPreference(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', (e) => {
      // Only update if user hasn't set a manual preference
      if (this.getSavedTheme() === null) {
        this.isDarkMode.set(e.matches);
      }
    });
  }

  /**
   * Apply theme to document body
   * @private
   * @param isDark - Whether dark theme should be applied
   */
  private applyTheme(isDark: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      const body = document.body;

      if (isDark) {
        body.classList.add('dark-theme');
      } else {
        body.classList.remove('dark-theme');
      }
    }
  }

  /**
   * Save theme preference to localStorage
   * @private
   * @param theme - Theme to save
   */
  private saveTheme(theme: 'light' | 'dark'): void {
    try {
      localStorage.setItem(this.THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const newTheme = !this.isDarkMode();
    this.isDarkMode.set(newTheme);
    this.saveTheme(newTheme ? 'dark' : 'light');
  }

  /**
   * Set specific theme
   * @param theme - 'light' or 'dark'
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.isDarkMode.set(theme === 'dark');
    this.saveTheme(theme);
  }

  /**
   * Reset to system preference
   */
  resetToSystemPreference(): void {
    localStorage.removeItem(this.THEME_STORAGE_KEY);
    this.isDarkMode.set(this.getSystemPreference());
  }

  /**
   * Get current theme as string
   * @returns 'light' | 'dark'
   */
  getCurrentTheme(): 'light' | 'dark' {
    return this.isDarkMode() ? 'dark' : 'light';
  }
}
