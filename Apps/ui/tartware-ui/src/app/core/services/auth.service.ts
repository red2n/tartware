import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthContext } from '../models/user.model';

interface LoginResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  is_active: boolean;
  memberships: any[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/v1';
  private currentUserIdSignal = signal<string | null>(null);
  private authContextSignal = signal<AuthContext | null>(null);

  currentUserId = this.currentUserIdSignal.asReadonly();
  authContext = this.authContextSignal.asReadonly();

  constructor(private http: HttpClient) {
    // Check if user is already logged in from localStorage
    const storedUserId = localStorage.getItem('user_id');
    const storedContext = localStorage.getItem('auth_context');
    if (storedUserId && storedContext) {
      this.currentUserIdSignal.set(storedUserId);
      this.authContextSignal.set(JSON.parse(storedContext));
    }
  }

  login(username: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/login`, { username }).pipe(
      tap(response => {
        this.currentUserIdSignal.set(response.id);

        const authContext: AuthContext = {
          user_id: response.id,
          email: response.email,
          first_name: response.first_name,
          last_name: response.last_name,
          memberships: response.memberships,
          authorized_tenants: []
        };

        this.authContextSignal.set(authContext);
        localStorage.setItem('user_id', response.id);
        localStorage.setItem('auth_context', JSON.stringify(authContext));
      })
    );
  }

  logout(): void {
    this.currentUserIdSignal.set(null);
    this.authContextSignal.set(null);
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_context');
  }

  isAuthenticated(): boolean {
    return this.currentUserIdSignal() !== null;
  }

  getUserId(): string | null {
    return this.currentUserIdSignal();
  }
}
