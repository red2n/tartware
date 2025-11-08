import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

/**
 * Loading state service for managing global loading indicators
 * Uses BehaviorSubject for reactive loading state management
 */
@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingCounter = 0;

  /**
   * Observable stream of loading state
   */
  loading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Show loading indicator
   * Increments counter to handle multiple concurrent operations
   */
  show(): void {
    this.loadingCounter++;
    if (this.loadingCounter === 1) {
      this.loadingSubject.next(true);
    }
  }

  /**
   * Hide loading indicator
   * Decrements counter and only hides when all operations complete
   */
  hide(): void {
    if (this.loadingCounter > 0) {
      this.loadingCounter--;
    }
    if (this.loadingCounter === 0) {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Force hide loading indicator
   * Resets counter and immediately hides loading
   */
  forceHide(): void {
    this.loadingCounter = 0;
    this.loadingSubject.next(false);
  }

  /**
   * Get current loading state
   * @returns Current loading state
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }
}
