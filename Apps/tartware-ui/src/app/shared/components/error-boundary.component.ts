import { CommonModule } from '@angular/common';
import { Component, ErrorHandler, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

/**
 * Error Boundary Component
 * Catches and displays errors gracefully in the UI
 * Prevents the entire application from crashing due to component errors
 *
 * Reference: https://angular.dev/api/core/ErrorHandler
 *
 * @example Usage
 * ```html
 * <app-error-boundary>
 *   <my-component></my-component>
 * </app-error-boundary>
 * ```
 *
 * @example With Custom Error Message
 * ```html
 * <app-error-boundary [title]="'Data Loading Error'">
 *   <data-table></data-table>
 * </app-error-boundary>
 * ```
 */
@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @if (hasError()) {
      <mat-card class="error-boundary-card">
        <mat-card-content>
          <div class="error-content">
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h2 class="error-title">{{ title() }}</h2>
            <p class="error-message">{{ errorMessage() }}</p>

            @if (showDetails() && errorDetails()) {
              <details class="error-details">
                <summary>Technical Details</summary>
                <pre>{{ errorDetails() }}</pre>
              </details>
            }

            <div class="error-actions">
              <button mat-flat-button color="primary" (click)="retry()">
                <mat-icon>refresh</mat-icon>
                Try Again
              </button>

              @if (reported) {
                <button mat-button (click)="reportError()">
                  <mat-icon>bug_report</mat-icon>
                  Report Issue
                </button>
              }
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [
    `
    .error-boundary-card {
      margin: 1rem;
      background-color: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    .error-content {
      text-align: center;
      padding: 2rem;
    }

    .error-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--md-sys-color-error);
      margin-bottom: 1rem;
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: var(--md-sys-color-on-error-container);
    }

    .error-message {
      font-size: 1rem;
      margin-bottom: 1.5rem;
      color: var(--md-sys-color-on-error-container);
      opacity: 0.8;
    }

    .error-details {
      margin: 1rem 0;
      text-align: left;

      summary {
        cursor: pointer;
        font-weight: 500;
        margin-bottom: 0.5rem;
        user-select: none;

        &:hover {
          opacity: 0.8;
        }
      }

      pre {
        background-color: rgba(0, 0, 0, 0.1);
        padding: 1rem;
        border-radius: var(--md-sys-shape-corner-small);
        overflow-x: auto;
        font-size: 0.875rem;
        max-height: 200px;
        overflow-y: auto;
      }
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;

      button {
        min-width: 120px;
      }
    }
  `,
  ],
})
export class ErrorBoundaryComponent {
  private errorHandler = inject(ErrorHandler);

  // Inputs
  title = input<string>('Something went wrong');
  showDetails = input<boolean>(false);

  // Outputs
  retried = output<void>();
  reported = output<Error>();

  // State
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');
  errorDetails = signal<string>('');
  private capturedError = signal<Error | null>(null);

  /**
   * Manually trigger error state
   * Can be called from parent component
   * @param error - Error object or message
   */
  handleError(error: Error | string): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    this.hasError.set(true);
    this.capturedError.set(errorObj);
    this.errorMessage.set(this.getErrorMessage(errorObj));
    this.errorDetails.set(this.getErrorDetails(errorObj));

    // Log to error handler
    this.errorHandler.handleError(errorObj);
  }

  /**
   * Extract user-friendly error message
   * @private
   */
  private getErrorMessage(error: Error): string {
    // Check for known error patterns
    if (error.message.includes('HTTP')) {
      return 'Unable to connect to the server. Please check your connection.';
    }

    if (error.message.includes('timeout')) {
      return 'The request took too long. Please try again.';
    }

    if (error.message.includes('permission')) {
      return 'You do not have permission to perform this action.';
    }

    // Default message
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Get detailed error information for debugging
   * @private
   */
  private getErrorDetails(error: Error): string {
    const details: string[] = [];

    if (error.name) {
      details.push(`Error Type: ${error.name}`);
    }

    if (error.message) {
      details.push(`Message: ${error.message}`);
    }

    if (error.stack) {
      details.push(`\nStack Trace:\n${error.stack}`);
    }

    return details.join('\n');
  }

  /**
   * Retry action - clears error state and emits retry event
   */
  retry(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
    this.errorDetails.set('');
    this.capturedError.set(null);
    this.retried.emit();
  }

  /**
   * Report error to monitoring service
   */
  reportError(): void {
    const error = this.capturedError();
    if (error) {
      this.reported.emit(error);
    }
  }
}
