import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ActivityItem, DashboardStats, TaskItem } from '@tartware/schemas';
import type { Observable } from 'rxjs';
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
  getRecentActivity(tenantId: string, propertyId?: string, limit = 10): Observable<ActivityItem[]> {
    const params = new HttpParams()
      .set('tenant_id', tenantId)
      .set('property_id', propertyId || 'all')
      .set('limit', limit.toString());

    return this.http.get<ActivityItem[]>(`${this.apiUrl}/dashboard/activity`, { params });
  }

  /**
   * Get upcoming tasks
   */
  getUpcomingTasks(tenantId: string, propertyId?: string, limit = 10): Observable<TaskItem[]> {
    const params = new HttpParams()
      .set('tenant_id', tenantId)
      .set('property_id', propertyId || 'all')
      .set('limit', limit.toString());

    return this.http.get<TaskItem[]>(`${this.apiUrl}/dashboard/tasks`, { params });
  }
}

// Re-export types from @tartware/schemas for convenience
export type { ActivityItem, DashboardStats, TaskItem } from '@tartware/schemas';
