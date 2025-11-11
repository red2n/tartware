import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

/**
 * Status Bar Component
 * Simplified footer bar with environment and connectivity indicators.
 *
 * Features:
 * - Environment indicator (dev/staging/prod)
 * - Version information
 * - API connectivity pill with retry
 *
 * Reference: VSCode Status Bar - https://code.visualstudio.com/docs/getstarted/userinterface
 *
 * @example Usage in app.component.html
 * ```html
 * <router-outlet />
 * <app-status-bar />
 * ```
 */
@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <footer class="status-bar">
      <div class="status-bar-left">
        <div class="status-item environment" [class.dev]="isDevelopment()" [class.prod]="isProduction()">
          <mat-icon>{{ environmentIcon() }}</mat-icon>
          <span>{{ environmentName() }}</span>
        </div>
        <div class="status-item version">
          <mat-icon>label</mat-icon>
          <span>v{{ version }}</span>
        </div>
      </div>

      <div class="status-bar-right">
        <div class="connection-pill" [class.online]="isOnline()" [class.offline]="isOffline()" role="status" (click)="checkConnection()">
          <mat-icon aria-hidden="true">{{ connectionIcon() }}</mat-icon>
          <span class="connection-text">{{ connectionStatus() }}</span>
          @if (isChecking()) {
            <mat-icon class="connection-spinner" aria-hidden="true">autorenew</mat-icon>
          } @else if (isOffline()) {
            <span class="connection-reason">{{ offlineMessage() }}</span>
          }
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
    .status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 24px;
      background-color: #ffffff;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 12px;
      color: #6b7280;
      z-index: 1000;
      user-select: none;
      font-family: 'Roboto', sans-serif;
      box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.05);
    }

    .status-bar-left,
    .status-bar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 0.15s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
      }

      span {
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
      }
    }

    .status-item.environment {
      border: 1px solid rgba(107, 114, 128, 0.3);
    }

    .status-item.version {
      border: 1px solid transparent;
    }

    .connection-pill {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      cursor: pointer;
      background-color: #e5e7eb;
      color: #1f2937;
      transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
      }

      .connection-text {
        font-weight: 600;
      }

      .connection-spinner {
        animation: spin 1.2s linear infinite;
      }

      .connection-reason {
        font-size: 11px;
        font-weight: 500;
        opacity: 0.9;
      }
    }

    .connection-pill:hover {
      transform: translateY(-1px);
      background-color: #d1d5db;
    }

    .connection-pill.online {
      background-color: #16a34a;
      color: #ffffff;

      &:hover {
        background-color: #15803d;
      }
    }

    .connection-pill.offline {
      background-color: #dc2626;
      color: #ffffff;

      &:hover {
        background-color: #b91c1c;
      }
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    // Dark theme styles are centralized in src/styles/_dark-theme.scss

    // Mobile responsiveness
    @media (max-width: 768px) {
      .status-bar {
        font-size: 11px;
        padding: 0 8px;
      }

      .status-item span {
        display: none;
      }

      .status-item mat-icon {
        margin-right: 0;
      }
    }
  `,
  ],
})
export class StatusBarComponent implements OnDestroy {
  // Environment info
  readonly version = '1.0.0'; // TODO: Read from package.json
  readonly environmentName = computed(() =>
    environment.production ? 'Production' : 'Development'
  );
  readonly isDevelopment = computed(() => !environment.production);
  readonly isProduction = computed(() => environment.production);
  readonly environmentIcon = computed(() => (environment.production ? 'cloud_done' : 'code'));

  // Connection status
  private readonly healthEndpoint = this.resolveHealthEndpoint(environment.apiUrl);
  private readonly connectionTimeoutMs = 5000;
  private readonly connectionState = signal<'online' | 'offline'>('offline');
  private readonly checkingState = signal<boolean>(false);
  private readonly offlineReason = signal('Unable to reach Tartware API.');
  readonly offlineMessage = this.offlineReason.asReadonly();
  readonly isOnline = computed(() => this.connectionState() === 'online');
  readonly isOffline = computed(() => this.connectionState() === 'offline');
  readonly isChecking = this.checkingState.asReadonly();
  readonly connectionStatus = computed(() => {
    if (this.isChecking()) return 'Checking...';
    return this.isOnline() ? 'Online' : 'Offline';
  });
  readonly connectionIcon = computed(() => (this.isOnline() ? 'wifi' : 'wifi_off'));

  private connectionCheckTimer: number | null = null;
  private readonly handleBrowserOnline = () => {
    void this.checkConnection();
  };
  private readonly handleBrowserOffline = () => {
    void this.checkConnection();
  };

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleBrowserOnline);
    window.addEventListener('offline', this.handleBrowserOffline);

    // Perform initial connection check and keep it fresh
    void this.checkConnection();
    this.connectionCheckTimer = window.setInterval(() => {
      void this.checkConnection();
    }, 60000);
  }

  /**
   * Check connection status
   */
  async checkConnection(): Promise<void> {
    if (this.checkingState()) {
      return;
    }

    const assumedOfflineReason = navigator.onLine
      ? 'Unable to reach Tartware API.'
      : 'No internet connection detected.';
    this.checkingState.set(true);

    try {
      await this.performHealthCheck('cors');
      this.setOnline();
    } catch (error) {
      console.warn('Primary health check failed, attempting CORS-tolerant fallback', error);

      try {
        await this.performHealthCheck('no-cors');
        this.setOnline();
      } catch (secondaryError) {
        const reason =
          secondaryError instanceof Error && secondaryError.message
            ? secondaryError.message
            : assumedOfflineReason;
        this.setOffline(reason);
      }
    } finally {
      this.checkingState.set(false);
    }
  }

  /**
   * Cleanup listeners and timers
   */
  ngOnDestroy(): void {
    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);

    if (this.connectionCheckTimer !== null) {
      window.clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }
  }

  private setOnline(): void {
    this.connectionState.set('online');
    this.offlineReason.set('Unable to reach Tartware API.');
  }

  private setOffline(reason: string): void {
    this.connectionState.set('offline');
    const normalized = reason.trim().endsWith('.')
      ? reason.trim()
      : `${reason.trim()}.`;
    this.offlineReason.set(`${normalized} Tap to retry.`);
  }

  private resolveHealthEndpoint(apiUrl: string): string {
    try {
      const api = new URL(apiUrl);
      api.pathname = '/health';
      api.search = '';
      return api.toString();
    } catch {
      return apiUrl.replace(/\/v1\/?$/, '') + '/health';
    }
  }

  private async performHealthCheck(mode: RequestMode): Promise<void> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.connectionTimeoutMs);

    try {
      const response = await fetch(this.healthEndpoint, {
        method: 'GET',
        mode,
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });

      if (mode === 'cors' && !response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Health check timed out.');
      }
      throw error instanceof Error ? error : new Error('Health check request failed.');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}
