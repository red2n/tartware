import { Component, type ElementRef, HostListener, inject, output, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import type { NotificationItem } from "@tartware/schemas";
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { I18nService, type LangCode, SUPPORTED_LANGUAGES } from "../../core/i18n/i18n.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import {
	NotificationService,
} from "../../core/notifications/notification.service";
import { RegistryService } from "../../core/registry/registry.service";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { ThemeService } from "../../core/theme/theme.service";
import { RelativeTimePipe } from "../../shared/pipes/relative-time.pipe";

@Component({
	selector: "app-topbar",
	standalone: true,
	imports: [
		MatIconModule,
		MatButtonModule,
		MatMenuModule,
		MatDividerModule,
		MatTooltipModule,
		FormsModule,
		RelativeTimePipe,
		TranslatePipe,
	],
	templateUrl: "./topbar.html",
	styleUrl: "./topbar.scss",
})
export class TopbarComponent {
	private readonly auth = inject(AuthService);
	private readonly theme = inject(ThemeService);
	private readonly ctx = inject(TenantContextService);
	private readonly i18n = inject(I18nService);
	private readonly registry = inject(RegistryService);
	private readonly router = inject(Router);
	readonly notifications = inject(NotificationService);
	readonly globalSearch = inject(GlobalSearchService);

	readonly menuToggle = output<void>();

	readonly supportedLanguages = SUPPORTED_LANGUAGES;
	readonly currentLang = this.i18n.currentLang;

	private readonly notifPanel = viewChild<ElementRef>("notifPanel");
	private readonly searchInput = viewChild<ElementRef>("searchInputEl");

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

	setLanguage(lang: LangCode): void {
		this.i18n.setLanguage(lang);
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

	markAsRead(notification: NotificationItem): void {
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

	onNotificationClick(notification: NotificationItem): void {
		this.markAsRead(notification);
		if (notification.action_url) {
			this.notifications.closePanel();
			this.router.navigateByUrl(notification.action_url);
		}
	}

	focusSearch(): void {
		this.searchInput()?.nativeElement?.focus();
	}

	@HostListener("document:keydown", ["$event"])
	onKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key === "k") {
			event.preventDefault();
			this.focusSearch();
		}
	}

	@HostListener("document:click", ["$event"])
	onDocumentClick(event: MouseEvent): void {
		if (!this.notifications.panelOpen()) return;
		const panel = this.notifPanel();
		const target = event.target;
		if (panel && target instanceof Node && !panel.nativeElement.contains(target)) {
			this.notifications.closePanel();
		}
	}
}
