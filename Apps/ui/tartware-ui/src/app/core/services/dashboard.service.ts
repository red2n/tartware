import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Dashboard Service
 * Fetches dashboard metrics and statistics from backend API
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Get dashboard statistics
   */
  getDashboardStats(tenantId: string, propertyId?: string): Observable<DashboardStats> {
    const params = new HttpParams()
      .set('tenant_id', tenantId)
      .set('property_id', propertyId || 'all');

    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard/stats`, { params });
  }

  /**
   * Get recent activity
   */
  getRecentActivity(tenantId: string, limit = 10): Observable<Activity[]> {
    const params = new HttpParams()
      .set('tenant_id', tenantId)
      .set('limit', limit.toString());

    return this.http.get<Activity[]>(`${this.apiUrl}/dashboard/activity`, { params });
  }

  /**
   * Get upcoming tasks
   */
  getUpcomingTasks(tenantId: string, limit = 10): Observable<Task[]> {
    const params = new HttpParams()
      .set('tenant_id', tenantId)
      .set('limit', limit.toString());

    return this.http.get<Task[]>(`${this.apiUrl}/dashboard/tasks`, { params });
  }
}

/**
 * Dashboard statistics interface
 */
export interface DashboardStats {
  occupancy: {
    rate: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  };
  revenue: {
    today: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
    currency: string;
  };
  checkIns: {
    total: number;
    pending: number;
  };
  checkOuts: {
    total: number;
    pending: number;
  };
}

/**
 * Activity item interface
 */
export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

/**
 * Task item interface
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  due_time: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon: string;
}
