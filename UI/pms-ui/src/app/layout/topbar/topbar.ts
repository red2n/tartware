import { Component, type ElementRef, HostListener, inject, output, viewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import {
	NotificationService,
	type InAppNotification,
} from "../../core/notifications/notification.service";
import { RegistryService } from "../../core/registry/registry.service";
import { ThemeService } from "../../core/theme/theme.service";
import { RelativeTimePipe } from "../../shared/pipes/relative-time.pipe";

@Component({
	selector: "app-topbar",
	standalone: true,
	imports: [MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatTooltipModule, RelativeTimePipe],
	templateUrl: "./topbar.html",
	styleUrl: "./topbar.scss",
})
export class TopbarComponent {
	readonly menuToggle = output<void>();

	private readonly auth = inject(AuthService);
	private readonly theme = inject(ThemeService);
	private readonly ctx = inject(TenantContextService);
	private readonly registry = inject(RegistryService);
	private readonly router = inject(Router);
	readonly notifications = inject(NotificationService);

	private readonly notifPanel = viewChild<ElementRef>("notifPanel");

	readonly user = this.auth.user;
	readonly isDark = this.theme.isDark;
	readonly themeMode = this.theme.themeMode;

	readonly memberships = this.auth.memberships;
	readonly activeMembership = this.auth.activeMembership;
	readonly properties = this.ctx.properties;
	readonly activeProperty = this.ctx.activeProperty;
	readonly propertiesLoading = this.ctx.loading;
	readonly statusBarVisible = this.registry.statusBarVisible;

	/** Whether tenant switcher should be shown (multi-tenant user) */
	get showTenantSwitcher(): boolean {
		return this.memberships().length > 1;
	}

	switchTenant(tenantId: string): void {
		this.auth.selectTenant(tenantId);
		// Force reload to re-fetch all data for the new tenant
		window.location.reload();
	}

	selectProperty(propertyId: string): void {
		this.ctx.selectProperty(propertyId);
	}

	toggleTheme(): void {
		const next = this.isDark() ? "LIGHT" : "DARK";
		this.theme.setTheme(next);
	}

	async setTheme(mode: "LIGHT" | "DARK" | "SYSTEM"): Promise<void> {
		await this.theme.setTheme(mode);
	}

	toggleStatusBar(): void {
		this.registry.toggleStatusBar();
	}

	logout(): void {
		this.auth.logout();
		this.notifications.disconnect();
		this.router.navigate(["/login"]);
	}

	toggleNotifications(): void {
		this.notifications.togglePanel();
	}

	markAsRead(notification: InAppNotification): void {
		if (!notification.is_read) {
			this.notifications.markAsRead([notification.notification_id]);
		}
	}

	markAllRead(): void {
		this.notifications.markAllAsRead();
	}

	notificationIcon(category: string): string {
		return NotificationService.categoryIcon(category);
	}

	onNotificationClick(notification: InAppNotification): void {
		this.markAsRead(notification);
		if (notification.action_url) {
			this.notifications.closePanel();
			this.router.navigateByUrl(notification.action_url);
		}
	}

	@HostListener("document:click", ["$event"])
	onDocumentClick(event: MouseEvent): void {
		if (!this.notifications.panelOpen()) return;
		const panel = this.notifPanel();
		if (panel && !panel.nativeElement.contains(event.target)) {
			this.notifications.closePanel();
		}
	}
}
