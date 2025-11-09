import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { PropertyService } from '../../core/services/property.service';
import { PropertyContextService } from '../../core/services/property-context.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { ThemeService } from '../../core/services/theme.service';

/**
 * PMS Layout Component
 * Main application layout with sidebar navigation for PMS features
 *
 * Features:
 * - Collapsible sidebar with PMS menu items
 * - Top bar with tenant switcher and user menu
 * - Responsive design (mobile hamburger menu)
 * - Active route highlighting
 * - Material Design 3 styled
 *
 * Reference: Modern PMS UI pattern (Opera PMS, Mews, Cloudbeds)
 *
 * @example Usage in Routes
 * ```typescript
 * {
 *   path: 'pms/:tenantId',
 *   component: PmsLayoutComponent,
 *   children: [...]
 * }
 * ```
 */
@Component({
  selector: 'app-pms-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatTooltipModule,
    MatMenuModule,
    MatBadgeModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './pms-layout.component.html',
  styleUrl: './pms-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PmsLayoutComponent implements OnInit {
  tenantContext = inject(TenantContextService);
  propertyContext = inject(PropertyContextService);
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  propertyService = inject(PropertyService);
  router = inject(Router);

  // Sidebar state
  sidebarOpen = signal(true);
  isMobile = signal(false);

  // Current tenant
  activeTenant = this.tenantContext.activeTenant;
  tenantName = this.tenantContext.tenantName;

  // Auth context
  authContext = this.authService.authContext;
  userName = computed(() => {
    const ctx = this.authContext();
    return ctx ? `${ctx.first_name} ${ctx.last_name}` : '';
  });

  // Property management (for multi-property tenants)
  selectedPropertyId = this.propertyContext.selectedPropertyId;
  properties = signal<PropertyOption[]>([]);
  loadingProperties = signal(false);

  // Computed: Check if tenant has multiple properties
  hasMultipleProperties = computed(() => this.properties().length > 1);

  // Menu items
  menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      icon: 'dashboard',
      label: 'Dashboard',
      route: 'dashboard',
      badge: null,
    },
    {
      id: 'reservations',
      icon: 'event',
      label: 'Reservations',
      route: 'reservations',
      badge: null,
    },
    {
      id: 'rooms',
      icon: 'hotel',
      label: 'Rooms & Inventory',
      route: 'rooms',
      badge: null,
    },
    {
      id: 'guests',
      icon: 'people',
      label: 'Guests',
      route: 'guests',
      badge: null,
    },
    {
      id: 'housekeeping',
      icon: 'cleaning_services',
      label: 'Housekeeping',
      route: 'housekeeping',
      badge: 3,
    },
    {
      id: 'billing',
      icon: 'receipt_long',
      label: 'Billing',
      route: 'billing',
      badge: null,
    },
    {
      id: 'reports',
      icon: 'analytics',
      label: 'Reports',
      route: 'reports',
      badge: null,
    },
    {
      id: 'settings',
      icon: 'settings',
      label: 'Settings',
      route: 'settings',
      badge: null,
    },
  ];

  constructor() {
    // Check screen size on init and resize
    this.checkScreenSize();
    window.addEventListener('resize', () => this.checkScreenSize());
  }

  ngOnInit(): void {
    // Load properties when component initializes
    this.loadProperties();
  }

  /**
   * Load properties from API
   * @private
   */
  private loadProperties(): void {
    const tenant = this.activeTenant();
    if (!tenant) {
      if (environment.enableDebugLogs) {
        console.warn('No active tenant found, skipping property load');
      }
      return;
    }

    if (environment.enableDebugLogs) {
      console.log('Loading properties for tenant:', tenant.id);
    }
    this.loadingProperties.set(true);
    this.propertyService.getProperties(tenant.id).subscribe({
      next: (properties) => {
        if (environment.enableDebugLogs) {
          console.log('Properties loaded successfully:', properties);
        }

        // Update property context service
        this.propertyContext.setProperties(properties);

        // Update dropdown options
        const options: PropertyOption[] = properties.map((p) => ({
          id: p.id,
          name: p.property_name,
        }));
        this.properties.set(options);
        this.loadingProperties.set(false);

        if (environment.enableDebugLogs) {
          console.log('First property auto-selected:', this.propertyContext.selectedPropertyId());
        }
      },
      error: (error) => {
        console.error('Failed to load properties:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
        });
        this.loadingProperties.set(false);
      },
    });
  }

  /**
   * Check if current screen is mobile
   * @private
   */
  private checkScreenSize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (mobile) {
      this.sidebarOpen.set(false);
    }
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  /**
   * Toggle theme
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Switch property (for multi-property tenants)
   */
  switchProperty(propertyId: string): void {
    this.propertyContext.selectProperty(propertyId);
    if (environment.enableDebugLogs) {
      console.log('Switched to property:', propertyId);
    }
  }

  /**
   * Navigate to tenant list
   */
  switchTenant(): void {
    this.propertyContext.clearProperties();
    this.tenantContext.clearActiveTenant();
  }

  /**
   * Logout
   */
  logout(): void {
    this.authService.logout();
  }

  /**
   * Check if route is active
   */
  isActiveRoute(route: string): boolean {
    return this.router.url.includes(route);
  }
}

/**
 * Menu item interface
 */
interface MenuItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge: number | null;
}

/**
 * Property option interface for dropdown
 */
interface PropertyOption {
  id: string;
  name: string;
}
