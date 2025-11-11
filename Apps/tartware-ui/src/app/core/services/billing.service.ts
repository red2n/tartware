import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { BillingPayment } from '../models/billing.model';

export interface BillingFilters {
  propertyId?: string;
  status?: string;
  transactionType?: string;
  paymentMethod?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPayments(tenantId: string, filters: BillingFilters = {}): Observable<BillingPayment[]> {
    let params = new HttpParams().set('tenant_id', tenantId);

    if (filters.propertyId && filters.propertyId !== 'all') {
      params = params.set('property_id', filters.propertyId);
    }

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    if (filters.transactionType && filters.transactionType !== 'all') {
      params = params.set('transaction_type', filters.transactionType);
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      params = params.set('payment_method', filters.paymentMethod);
    }

    if (filters.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http.get<BillingPayment[]>(`${this.apiUrl}/billing/payments`, { params });
  }
}
