import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { Tenant } from '../../core/models/tenant.model';
import { AuthContext } from '../../core/models/user.model';
import type { TenantRole } from '@tartware/schemas';

@Component({
  selector: 'app-tenant-list',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule
  ],
  templateUrl: './tenant-list.component.html',
  styleUrl: './tenant-list.component.scss'
})
export class TenantListComponent implements OnInit {
  authContext = signal<AuthContext | null>(null);
  tenants = signal<Tenant[]>([]);
  loading = signal<boolean>(true);
  errorMessage = signal<string>('');

  dataSource = new MatTableDataSource<Tenant>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = ['name', 'type', 'status', 'email', 'stats'];

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const context = this.authService.authContext();
    if (!context) {
      this.router.navigate(['/login']);
      return;
    }

    this.authContext.set(context);
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.tenantService.getTenants(100).subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.dataSource.data = tenants;
        this.dataSource.paginator = this.paginator;
        this.loading.set(false);
      },
      error: (err) => {
        // Extract user-friendly message from API error response
        let errorMsg = 'Failed to load tenants';

        if (err.error?.message) {
          errorMsg = err.error.message;
        } else if (err.message) {
          errorMsg = err.message;
        }

        this.errorMessage.set(errorMsg);
        this.loading.set(false);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getRoleBadgeColor(role: TenantRole): string {
    const colors: Record<TenantRole, string> = {
      'OWNER': 'bg-purple-50 text-purple-700 border-purple-200',
      'ADMIN': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'MANAGER': 'bg-blue-50 text-blue-700 border-blue-200',
      'STAFF': 'bg-gray-50 text-gray-700 border-gray-200',
      'VIEWER': 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return colors[role] || 'bg-gray-50 text-gray-600 border-gray-200';
  }
}
