import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { concat, filter, first, interval } from 'rxjs';

/**
 * PWA Service
 * Manages Progressive Web App features including:
 * - Service Worker updates
 * - Update notifications
 * - Version checking
 * - Update installation
 *
 * Follows Angular PWA best practices:
 * https://angular.dev/ecosystem/service-workers/communications
 */
@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);

  /**
   * Initialize PWA features
   * - Check for updates when app becomes stable
   * - Check for updates every 6 hours
   * - Listen for version updates
   */
  initialize(): void {
    if (!this.swUpdate.isEnabled) {
      console.log('Service Worker not enabled');
      return;
    }

    // Check for updates when app stabilizes
    this.checkForUpdatesOnStable();

    // Check for updates periodically (every 6 hours)
    this.checkForUpdatesPeriodically();

    // Listen for version updates
    this.listenForVersionUpdates();

    // Listen for unrecoverable state
    this.listenForUnrecoverableState();
  }

  /**
   * Check for updates when application becomes stable
   * @private
   */
  private checkForUpdatesOnStable(): void {
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));

    const everySixHours$ = interval(6 * 60 * 60 * 1000); // 6 hours
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(async () => {
      try {
        const updateFound = await this.swUpdate.checkForUpdate();
        console.log(updateFound ? 'A new version is available.' : 'Already on the latest version.');
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });
  }

  /**
   * Check for updates periodically
   * @private
   */
  private checkForUpdatesPeriodically(): void {
    if (this.swUpdate.isEnabled) {
      interval(30 * 60 * 1000).subscribe(() => {
        // Check every 30 minutes
        this.swUpdate.checkForUpdate().catch((err) => {
          console.error('Failed to check for updates:', err);
        });
      });
    }
  }

  /**
   * Listen for new version available
   * @private
   */
  private listenForVersionUpdates(): void {
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe((evt) => {
        console.log('New version available:', evt.latestVersion);

        // Prompt user to update
        if (confirm('New version available. Load new version?')) {
          this.activateUpdate();
        }
      });
  }

  /**
   * Listen for unrecoverable state
   * @private
   */
  private listenForUnrecoverableState(): void {
    this.swUpdate.unrecoverable.subscribe((event) => {
      console.error('Unrecoverable state:', event.reason);

      // Notify user to reload
      if (
        confirm(
          'An error occurred that we cannot recover from:\n' +
            event.reason +
            '\n\nPlease reload the page.'
        )
      ) {
        window.location.reload();
      }
    });
  }

  /**
   * Activate the latest service worker update
   */
  async activateUpdate(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
      console.log('Update activated');
      window.location.reload();
    } catch (err) {
      console.error('Failed to activate update:', err);
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      return false;
    }

    try {
      return await this.swUpdate.checkForUpdate();
    } catch (err) {
      console.error('Failed to check for updates:', err);
      return false;
    }
  }
}
