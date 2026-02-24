import { computed, effect, Injectable, signal } from '@angular/core';

import type { UserUiPreferences } from '@tartware/schemas';

import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _themeMode = signal<ThemeMode>('SYSTEM');
  private readonly _osPrefersDark = signal(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  readonly themeMode = this._themeMode.asReadonly();

  /** Resolved effective theme (never 'SYSTEM') */
  readonly effectiveTheme = computed<'LIGHT' | 'DARK'>(() => {
    const mode = this._themeMode();
    if (mode === 'SYSTEM') {
      return this._osPrefersDark() ? 'DARK' : 'LIGHT';
    }
    return mode;
  });

  readonly isDark = computed(() => this.effectiveTheme() === 'DARK');

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {
    // Listen for OS theme changes
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this._osPrefersDark.set(e.matches);
      });
    }

    // Apply theme to DOM whenever it changes
    effect(() => {
      const theme = this.effectiveTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme.toLowerCase());
      }
    });
  }

  /** Load preferences from backend after login */
  async loadPreferences(): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    try {
      const prefs = await this.api.get<UserUiPreferences>('/users/me/ui-preferences', {
        tenant_id: tenantId,
      });
      this._themeMode.set(prefs.theme ?? 'SYSTEM');
    } catch {
      // Default to SYSTEM if backend unavailable
      this._themeMode.set('SYSTEM');
    }
  }

  /** Set theme and persist to backend */
  async setTheme(mode: ThemeMode): Promise<void> {
    this._themeMode.set(mode);

    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    try {
      await this.api.put('/users/me/ui-preferences', { theme: mode }, { tenant_id: tenantId });
    } catch {
      // Silently fail — local state is already updated
    }
  }

  /** Set to default light for login screen (before any user context) */
  setLoginDefault(): void {
    this._themeMode.set('LIGHT');
  }
}
