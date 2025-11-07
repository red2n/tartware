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
        this.errorMessage.set(err.error?.message || 'Failed to load tenants');
        this.loading.set(false);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getRoleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      'OWNER': 'bg-purple-100 text-purple-800',
      'ADMIN': 'bg-blue-100 text-blue-800',
      'MANAGER': 'bg-green-100 text-green-800',
      'STAFF': 'bg-yellow-100 text-yellow-800',
      'VIEWER': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  }
}
