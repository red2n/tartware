import { Injectable } from '@angular/core';

const API_BASE = '/v1';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const response = await fetch(this.buildUrl(path, params), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  async put<T>(path: string, body: unknown, params?: Record<string, string>): Promise<T> {
    const response = await fetch(this.buildUrl(path, params), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  private async handleError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch {
      // ignore parse errors
    }
    return new Error(message);
  }
}
