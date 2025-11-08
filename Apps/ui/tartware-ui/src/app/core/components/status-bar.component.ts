import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

/**
 * Status Bar Component
 * VSCode-inspired footer bar showing system information
 *
 * Features:
 * - Environment indicator (dev/staging/prod)
 * - Version information
 * - Connection status
 * - Last sync time
 * - Quick actions
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
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <footer class="status-bar">
      <!-- Left section -->
      <div class="status-bar-left">
        <!-- Environment indicator -->
        <div
          class="status-item clickable"
          role="button"
          tabindex="0"
          [class.dev]="isDevelopment()"
          [class.prod]="isProduction()"
          [matTooltip]="'Environment: ' + environmentName()"
          (click)="onEnvironmentClick()"
          (keyup.enter)="onEnvironmentClick()"
          (keyup.space)="onEnvironmentClick()"
        >
          <mat-icon>{{ environmentIcon() }}</mat-icon>
          <span>{{ environmentName() }}</span>
        </div>

        <!-- Version -->
        <div class="status-item" [matTooltip]="'Application Version'">
          <mat-icon>label</mat-icon>
          <span>v{{ version }}</span>
        </div>

        <!-- Connection status -->
        <div
          class="status-item clickable"
          role="button"
          tabindex="0"
          [class.online]="isOnline()"
          [class.offline]="!isOnline()"
          [matTooltip]="connectionTooltip()"
          (click)="checkConnection()"
          (keyup.enter)="checkConnection()"
          (keyup.space)="checkConnection()"
        >
          <mat-icon>{{ connectionIcon() }}</mat-icon>
          <span>{{ connectionStatus() }}</span>
        </div>
      </div>

      <!-- Right section -->
      <div class="status-bar-right">
        <!-- Last sync time -->
        @if (lastSyncTime()) {
          <div class="status-item" [matTooltip]="'Last synchronized at ' + formatTime(lastSyncTime()!)">
            <mat-icon>sync</mat-icon>
            <span>{{ timeSinceSync() }}</span>
          </div>
        }

        <!-- Build info (dev only) -->
        @if (isDevelopment()) {
          <div class="status-item" [matTooltip]="'Build: ' + buildDate">
            <mat-icon>info_outline</mat-icon>
            <span>Build: {{ buildDate }}</span>
          </div>
        }

        <!-- Support link -->
        <div
          class="status-item clickable"
          role="button"
          tabindex="0"
          [matTooltip]="'Get Help & Support'"
          (click)="openSupport()"
          (keyup.enter)="openSupport()"
          (keyup.space)="openSupport()"
        >
          <mat-icon>help_outline</mat-icon>
          <span>Support</span>
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
      padding: 0 12px;
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
      gap: 4px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      transition: all 0.15s ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
      }

      span {
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
      }

      &.clickable {
        cursor: pointer;

        &:hover {
          background-color: #f3f4f6;
        }

        &:focus {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }
      }

      // Environment colors
      &.dev {
        color: #2563eb;

        mat-icon {
          color: #2563eb;
        }
      }

      &.prod {
        color: #16a34a;

        mat-icon {
          color: #16a34a;
        }
      }

      // Connection status colors
      &.online {
        mat-icon {
          color: #16a34a;
        }
      }

      &.offline {
        mat-icon {
          color: #dc2626;
        }
      }
    }

    // Dark theme support
    .dark-theme .status-bar {
      background-color: #1f2937;
      border-top-color: #374151;
      color: #9ca3af;
      box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.2);
    }

    .dark-theme .status-item {
      &.clickable:hover {
        background-color: #374151;
      }

      &.clickable:focus {
        outline-color: #6366f1;
      }
    }

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
export class StatusBarComponent {
  // Environment info
  readonly version = '1.0.0'; // TODO: Read from package.json
  readonly buildDate = new Date().toISOString().split('T')[0];
  readonly environmentName = computed(() =>
    environment.production ? 'Production' : 'Development'
  );
  readonly isDevelopment = computed(() => !environment.production);
  readonly isProduction = computed(() => environment.production);
  readonly environmentIcon = computed(() => (environment.production ? 'cloud_done' : 'code'));

  // Connection status
  private online = signal<boolean>(navigator.onLine);
  readonly isOnline = this.online.asReadonly();
  readonly connectionStatus = computed(() => (this.online() ? 'Online' : 'Offline'));
  readonly connectionIcon = computed(() => (this.online() ? 'wifi' : 'wifi_off'));
  readonly connectionTooltip = computed(() =>
    this.online()
      ? 'Connected to server. Click to check connection.'
      : 'No internet connection. Click to retry.'
  );

  // Last sync time
  private lastSync = signal<Date | null>(null);
  readonly lastSyncTime = this.lastSync.asReadonly();

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));

    // Initialize last sync time
    this.updateSyncTime();

    // Update sync time every minute
    setInterval(() => this.updateSyncTime(), 60000);
  }

  /**
   * Check connection status
   */
  checkConnection(): void {
    this.online.set(navigator.onLine);
    if (navigator.onLine) {
      console.log('Connection check: Online');
    } else {
      console.log('Connection check: Offline');
    }
  }

  /**
   * Handle environment indicator click
   */
  onEnvironmentClick(): void {
    console.log(`Environment: ${this.environmentName()}`);
  }

  /**
   * Update last sync time
   */
  updateSyncTime(): void {
    this.lastSync.set(new Date());
  }

  /**
   * Format time for display
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Calculate time since last sync
   */
  timeSinceSync(): string {
    if (!this.lastSync()) return '';

    const now = new Date();
    const diff = now.getTime() - this.lastSync()!.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  /**
   * Open support page
   */
  openSupport(): void {
    // TODO: Link to actual support page
    window.open('https://support.tartware.com', '_blank');
  }
}
