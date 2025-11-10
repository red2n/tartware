import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Install Prompt Service
 * Manages PWA installation prompts
 *
 * Follows best practices from:
 * https://web.dev/articles/customize-install
 */
@Injectable({
  providedIn: 'root',
})
export class InstallPromptService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private canInstallSubject = new BehaviorSubject<boolean>(false);

  canInstall$: Observable<boolean> = this.canInstallSubject.asObservable();

  constructor() {
    this.initializeInstallPrompt();
  }

  /**
   * Initialize install prompt listener
   * @private
   */
  private initializeInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event so it can be triggered later
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstallSubject.next(true);

      console.log('Install prompt ready');
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredPrompt = null;
      this.canInstallSubject.next(false);
    });
  }

  /**
   * Show the install prompt
   */
  async showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) {
      console.log('Install prompt not available');
      return 'unavailable';
    }

    try {
      // Show the install prompt
      await this.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;

      console.log(`User response to the install prompt: ${outcome}`);

      // Clear the deferred prompt
      this.deferredPrompt = null;
      this.canInstallSubject.next(false);

      return outcome;
    } catch (err) {
      console.error('Error showing install prompt:', err);
      return 'unavailable';
    }
  }

  /**
   * Check if app is installed
   */
  isInstalled(): boolean {
    // Check if running in standalone mode (installed PWA)
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }

  /**
   * Check if install prompt is available
   */
  canInstall(): boolean {
    return this.canInstallSubject.value;
  }
}
