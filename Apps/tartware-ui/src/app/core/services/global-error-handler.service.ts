import { type ErrorHandler, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Global Error Handler
 * Catches all unhandled errors in the application
 * Logs errors and can integrate with error tracking services (Sentry, LogRocket, etc.)
 *
 * Reference: https://angular.dev/api/core/ErrorHandler
 *
 * @example Integration in main.ts
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     { provide: ErrorHandler, useClass: GlobalErrorHandler }
 *   ]
 * });
 * ```
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  /**
   * Handle caught errors
   * @param error - Error object or any thrown value
   */
  handleError(error: Error | unknown): void {
    const chunkFailedMessage = /Loading chunk [\d]+ failed/;

    // Handle chunk load failures (usually due to outdated cached files)
    if (error instanceof Error && chunkFailedMessage.test(error.message)) {
      this.handleChunkLoadError();
      return;
    }

    // Log error details
    this.logError(error);

    // In production, send to error tracking service
    if (environment.production) {
      this.reportToErrorService(error);
    }
  }

  /**
   * Handle chunk load failures by prompting user to refresh
   * @private
   */
  private handleChunkLoadError(): void {
    if (confirm('A new version is available. Would you like to refresh the page?')) {
      window.location.reload();
    }
  }

  /**
   * Log error to console with formatted output
   * @private
   */
  private logError(error: Error | unknown): void {
    const timestamp = new Date().toISOString();

    console.group(`🚨 Error caught at ${timestamp}`);
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }

    console.groupEnd();
  }

  /**
   * Report error to external error tracking service
   * Integrate with Sentry, LogRocket, or similar service
   * @private
   */
  private reportToErrorService(error: Error | unknown): void {
    // TODO: Integrate with error tracking service
    // Example for Sentry:
    // Sentry.captureException(error);

    // For now, just log that we would report it
    console.log('[Production] Error would be reported to monitoring service:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString(),
    });
  }
}
