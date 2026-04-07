import { Component, computed, effect, inject, type OnDestroy, type OnInit, signal } from "@angular/core";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter, type Subscription } from "rxjs";
import { ScreenPermissionsService } from "../../core/auth/screen-permissions.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { NotificationService } from "../../core/notifications/notification.service";
import { RegistryService } from "../../core/registry/registry.service";
import { SettingsService } from "../../core/settings/settings.service";
import { ToastContainerComponent } from "../../shared/toast/toast-container";
import type { NavItem } from "../nav-config";
import { findActiveParent } from "../nav-config";
import { SidebarComponent } from "../sidebar/sidebar";
import { StatusBarComponent } from "../status-bar/status-bar";
import { SubSidebarComponent } from "../sub-sidebar/sub-sidebar";
import { TopbarComponent } from "../topbar/topbar";

@Component({
	selector: "app-shell",
	standalone: true,
	imports: [
		RouterOutlet,
		SidebarComponent,
		SubSidebarComponent,
		TopbarComponent,
		ToastContainerComponent,
		StatusBarComponent,
		TranslatePipe,
	],
	templateUrl: "./shell.html",
	styleUrl: "./shell.scss",
})
export class ShellComponent implements OnInit, OnDestroy {
	private static readonly SIDEBAR_KEY = "sidebar-collapsed";
	private static readonly RIGHT_DOCK_KEY = "right-dock-collapsed";
	private readonly router = inject(Router);
	private readonly registry = inject(RegistryService);
	private readonly notificationService = inject(NotificationService);
	private readonly screenPerms = inject(ScreenPermissionsService);
	private readonly settings = inject(SettingsService);
	readonly sidebarCollapsed = signal(this.loadSidebarState());
	readonly rightDockCollapsed = signal(this.loadRightDockState());
	readonly statusBarVisible = this.registry.statusBarVisible;
	readonly activeParent = signal<NavItem | null>(null);
	readonly filteredActiveChildren = computed(() => {
		const parent = this.activeParent();
		if (!parent?.children) return [];
		const allowed = this.screenPerms.allowedScreens();
		if (!this.screenPerms.loaded() || allowed.size === 0) return parent.children;
		return parent.children.filter((c) => (c.screenKey ? allowed.has(c.screenKey) : true));
	});

	private routerSub?: Subscription;

	/** Apply brand color as a CSS custom property on the document root. */
	private readonly _brandColorEffect = effect(() => {
		const color = this.settings.getString("property.brand_color", "");
		if (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
			document.documentElement.style.setProperty("--brand-color", color);
		} else {
			document.documentElement.style.removeProperty("--brand-color");
		}
	});

	/** Apply logo URL as a CSS custom property for sidebar branding. */
	readonly logoUrl = computed(() => this.settings.getString("property.logo_url", ""));

	ngOnInit(): void {
		this.notificationService.connect();
		this.syncActiveParent(this.router.url);
		this.routerSub = this.router.events
			.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
			.subscribe((event) => this.syncActiveParent(event.urlAfterRedirects));
	}

	ngOnDestroy(): void {
		this.notificationService.disconnect();
		this.routerSub?.unsubscribe();
	}

	toggleSidebar(): void {
		this.sidebarCollapsed.update((v) => {
			const next = !v;
			localStorage.setItem(ShellComponent.SIDEBAR_KEY, String(next));
			return next;
		});
	}

	onParentSelect(item: NavItem): void {
		const current = this.activeParent();
		if (current?.label === item.label) {
			// Toggle: collapse children if same parent clicked
			this.activeParent.set(null);
		} else {
			this.activeParent.set(item);
			// Navigate to first child
			const firstChild = item.children?.[0];
			if (firstChild?.route) {
				this.router.navigate([firstChild.route]);
			}
		}
	}

	private syncActiveParent(url: string): void {
		this.activeParent.set(findActiveParent(url));
	}

	toggleRightDock(): void {
		this.rightDockCollapsed.update((v) => {
			const next = !v;
			localStorage.setItem(ShellComponent.RIGHT_DOCK_KEY, String(next));
			return next;
		});
	}

	private loadSidebarState(): boolean {
		const stored = localStorage.getItem(ShellComponent.SIDEBAR_KEY);
		return stored === "true";
	}

	private loadRightDockState(): boolean {
		const stored = localStorage.getItem(ShellComponent.RIGHT_DOCK_KEY);
		return stored === null ? true : stored === "true";
	}
}
