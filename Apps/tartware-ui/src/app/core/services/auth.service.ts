import { HttpClient } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TenantRole } from '@tartware/schemas';
import { catchError, type Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthContext } from '../models/user.model';
import { ErrorHandlerService } from './error-handler.service';

/**
 * Login response interface from API
 */
export interface LoginResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  is_active: boolean;
  memberships: TenantMembership[];
}

/**
 * Tenant membership interface
 */
export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  role: TenantRole;
  is_active: boolean;
}

/**
 * Local storage keys constants
 */
const STORAGE_KEYS = {
  USER_ID: 'user_id',
  AUTH_CONTEXT: 'auth_context',
} as const;

/**
 * Authentication service
 * Manages user authentication, authorization, and session state
 * Uses Angular Signals for reactive state management
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Inject dependencies using modern inject() function
  private http = inject(HttpClient);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);

  private readonly apiUrl = environment.apiUrl;

  // Private signals for internal state management
  private currentUserIdSignal = signal<string | null>(null);
  private authContextSignal = signal<AuthContext | null>(null);

  // Public readonly signals for external consumption
  currentUserId = this.currentUserIdSignal.asReadonly();
  authContext = this.authContextSignal.asReadonly();

  // Computed signal for authentication status
  isAuthenticated = computed(() => this.currentUserIdSignal() !== null);

  // Computed signal for user display name
  userDisplayName = computed(() => {
    const context = this.authContextSignal();
    if (!context) return null;
    return `${context.first_name} ${context.last_name}`.trim() || context.email;
  });

  constructor() {
    this.initializeFromStorage();
  }

  /**
   * Initialize authentication state from local storage
   * @private
   */
  private initializeFromStorage(): void {
    try {
      const storedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const storedContext = localStorage.getItem(STORAGE_KEYS.AUTH_CONTEXT);

      if (storedUserId && storedContext) {
        this.currentUserIdSignal.set(storedUserId);
        this.authContextSignal.set(JSON.parse(storedContext));
      }
    } catch (error) {
      // If stored data is corrupted, clear it
      console.error('Failed to load auth state from storage:', error);
      this.clearStorage();
    }
  }

  /**
   * Authenticate user with username
   * @param username - User's username
   * @returns Observable of login response
   */
  login(username: string): Observable<LoginResponse> {
    if (!username?.trim()) {
      throw new Error('Username is required');
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { username }).pipe(
      tap((response) => this.handleLoginSuccess(response)),
      catchError((error) => this.errorHandler.handleHttpError(error))
    );
  }

  /**
   * Handle successful login response
   * @param response - Login response from API
   * @private
   */
  private handleLoginSuccess(response: LoginResponse): void {
    this.currentUserIdSignal.set(response.id);

    const authContext: AuthContext = {
      user_id: response.id,
      email: response.email,
      first_name: response.first_name,
      last_name: response.last_name,
      memberships: response.memberships,
      authorized_tenants: [],
    };

    this.authContextSignal.set(authContext);
    this.saveToStorage(response.id, authContext);
  }

  /**
   * Save authentication state to local storage
   * @param userId - User ID
   * @param context - Authentication context
   * @private
   */
  private saveToStorage(userId: string, context: AuthContext): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
      localStorage.setItem(STORAGE_KEYS.AUTH_CONTEXT, JSON.stringify(context));
    } catch (error) {
      console.error('Failed to save auth state to storage:', error);
    }
  }

  /**
   * Clear authentication data from local storage
   * @private
   */
  private clearStorage(): void {
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_CONTEXT);
  }

  /**
   * Log out current user and redirect to login
   */
  logout(): void {
    this.currentUserIdSignal.set(null);
    this.authContextSignal.set(null);
    this.clearStorage();
    this.router.navigate(['/login']);
  }

  /**
   * Get current user ID
   * @returns Current user ID or null
   */
  getUserId(): string | null {
    return this.currentUserIdSignal();
  }

  /**
   * Get authentication context
   * @returns Current authentication context or null
   */
  getAuthContext(): AuthContext | null {
    return this.authContextSignal();
  }

  /**
   * Check if user has specific role in tenant
   * @param tenantId - Tenant ID to check
   * @param role - Required role
   * @returns True if user has the role
   */
  hasRole(tenantId: string, role: string): boolean {
    const context = this.authContextSignal();
    if (!context) return false;

    return context.memberships.some(
      (membership) => membership.tenant_id === tenantId && membership.role === role
    );
  }

  /**
   * Get user's tenant memberships
   * @returns Array of tenant memberships
   */
  getTenantMemberships(): TenantMembership[] {
    return this.authContextSignal()?.memberships || [];
  }
}
