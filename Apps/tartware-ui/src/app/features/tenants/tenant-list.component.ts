import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import type { TenantRole } from '@tartware/schemas';
import type { Tenant } from '../../core/models/tenant.model';
import type { AuthContext } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-tenant-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
  ],
  templateUrl: './tenant-list.component.html',
  styleUrl: './tenant-list.component.scss',
})
export class TenantListComponent implements OnInit {
  // Inject dependencies using modern inject() function
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  private router = inject(Router);
  readonly themeService = inject(ThemeService);
  private tenantContext = inject(TenantContextService);

  authContext = signal<AuthContext | null>(null);
  tenants = signal<Tenant[]>([]);
  loading = signal<boolean>(true);
  errorMessage = signal<string>('');

  dataSource = new MatTableDataSource<Tenant>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = ['name', 'type', 'status', 'email', 'stats', 'actions'];

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
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Open tenant and navigate to PMS dashboard
   */
  openTenant(tenant: Tenant): void {
    this.tenantContext.setActiveTenant(tenant, true);
  }

  getRoleBadgeColor(role: TenantRole): string {
    const colors: Record<TenantRole, string> = {
      OWNER: 'bg-purple-50 text-purple-700 border-purple-200',
      ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
      STAFF: 'bg-gray-50 text-gray-700 border-gray-200',
      VIEWER: 'bg-gray-50 text-gray-600 border-gray-200',
    };
    return colors[role] || 'bg-gray-50 text-gray-600 border-gray-200';
  }
}
