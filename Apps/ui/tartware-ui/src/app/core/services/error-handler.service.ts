import type { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { type Observable, throwError } from 'rxjs';

export interface ApiError {
  message: string;
  statusCode: number;
  timestamp: Date;
  path?: string;
}

/**
 * Centralized error handling service
 * Implements global error handling and logging
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  /**
   * Handle HTTP errors and transform them into user-friendly messages
   * @param error - The HTTP error response
   * @returns Observable that throws formatted error
   */
  handleHttpError(error: HttpErrorResponse): Observable<never> {
    const apiError: ApiError = {
      message: this.getErrorMessage(error),
      statusCode: error.status,
      timestamp: new Date(),
      path: error.url || undefined,
    };

    // Log error for debugging (in production, send to logging service)
    console.error('HTTP Error:', apiError);

    return throwError(() => apiError);
  }

  /**
   * Extract user-friendly error message from HTTP error
   * @param error - The HTTP error response
   * @returns Formatted error message
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      return `Network error: ${error.error.message}`;
    }

    // Server-side error
    switch (error.status) {
      case 0:
        return 'Unable to connect to server. Please check your internet connection.';
      case 400:
        return error.error?.message || 'Invalid request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Access denied. You do not have permission to perform this action.';
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        return error.error?.message || `Error: ${error.statusText}`;
    }
  }

  /**
   * Handle general application errors
   * @param error - The error object
   */
  handleError(error: Error): void {
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    });
  }
}
