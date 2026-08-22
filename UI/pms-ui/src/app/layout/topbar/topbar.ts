import {
	Component,
	computed,
	type ElementRef,
	HostListener,
	inject,
	output,
	signal,
	viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { PopoverModule } from "primeng/popover";
import { TooltipModule } from "primeng/tooltip";
import { AuthService } from "../../core/auth/auth.service";
import { ScreenPermissionsService } from "../../core/auth/screen-permissions.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { I18nService, type LangCode, SUPPORTED_LANGUAGES } from "../../core/i18n/i18n.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import {
	type InAppNotification,
	NotificationService,
} from "../../core/notifications/notification.service";
import { RegistryService } from "../../core/registry/registry.service";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { type ThemeMode, ThemeService } from "../../core/theme/theme.service";
import { IconComponent } from "../../shared/components/icon/icon";
import { UnsavedChangesService } from "../../shared/forms/unsaved-changes.service";
import { RelativeTimePipe } from "../../shared/pipes/relative-time.pipe";
import { type ScreenMatch, searchScreens } from "../nav-config";
import { TOPBAR_MOTIF_LEFT, TOPBAR_MOTIF_RIGHT } from "./topbar-motif";

/** One button cycles the three modes rather than spending topbar width on a
 *  menu. Order puts SYSTEM last so the two explicit choices are one click
 *  apart, and every mode is reachable within two clicks from any other. */
const THEME_NEXT: Record<ThemeMode, ThemeMode> = {
	LIGHT: "DARK",
	DARK: "SYSTEM",
	SYSTEM: "LIGHT",
};

const THEME_ICON: Record<ThemeMode, string> = {
	LIGHT: "light_mode",
	DARK: "dark_mode",
	SYSTEM: "brightness_auto",
};

/* Whole phrases, not composed fragments — the translate pipe keys off the
   complete English string. */
/* i18n-keys */
const THEME_ACTION: Record<ThemeMode, string> = {
	LIGHT: "Switch to dark theme",
	DARK: "Switch to system theme",
	SYSTEM: "Switch to light theme",
};

@Component({
	selector: "app-topbar",
	standalone: true,
	imports: [
		IconComponent,
		PopoverModule,
		TooltipModule,
		FormsModule,
		RouterLink,
		RelativeTimePipe,
		TranslatePipe,
	],
	templateUrl: "./topbar.html",
	styleUrls: ["./topbar.scss", "./topbar-motif.scss"],
})
export class TopbarComponent {
	private readonly auth = inject(AuthService);
	private readonly theme = inject(ThemeService);
	private readonly ctx = inject(TenantContextService);
	private readonly unsaved = inject(UnsavedChangesService);
	private readonly screenPerms = inject(ScreenPermissionsService);
	private readonly i18n = inject(I18nService);
	private readonly registry = inject(RegistryService);
	private readonly router = inject(Router);
	readonly notifications = inject(NotificationService);
	readonly globalSearch = inject(GlobalSearchService);

	readonly menuToggle = output<void>();

	readonly supportedLanguages = SUPPORTED_LANGUAGES;
	readonly currentLang = this.i18n.currentLang;

	/**
	 * Decorative watermark printed behind the title bar — a hospitality
	 * landscape standing on the bar's bottom edge, in two wings either side of
	 * the search field. Composition and depth live in topbar-motif.ts, inking
	 * in topbar-motif.scss.
	 */
	readonly motifsLeft = TOPBAR_MOTIF_LEFT;
	readonly motifsRight = TOPBAR_MOTIF_RIGHT;

	private readonly notifPanel = viewChild<ElementRef>("notifPanel");
	private readonly searchInput = viewChild<ElementRef>("searchInputEl");
	private readonly searchWidget = viewChild<ElementRef>("searchWidgetEl");

	readonly user = this.auth.user;
	readonly isDark = this.theme.isDark;
	readonly themeMode = this.theme.themeMode;

	/** Icon reflects the chosen mode, so SYSTEM stays distinguishable from the
	 *  light or dark it happens to be resolving to right now. */
	readonly themeIcon = computed(() => THEME_ICON[this.themeMode()]);
	readonly themeAction = computed(() => THEME_ACTION[this.themeMode()]);

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

	async switchTenant(tenantId: string): Promise<void> {
		if (!(await this.unsaved.confirmLeave())) return;
		this.auth.selectTenant(tenantId);
		// Force reload to re-fetch all data for the new tenant
		window.location.reload();
	}

	/**
	 * Switching property re-scopes every screen underneath. A form left half
	 * filled would either lose its input or, worse, post against the property
	 * the user just switched to — so ask first.
	 */
	async selectProperty(propertyId: string): Promise<void> {
		if (!(await this.unsaved.confirmLeave())) return;
		this.ctx.selectProperty(propertyId);
	}

	cycleTheme(): void {
		this.theme.setTheme(THEME_NEXT[this.themeMode()]);
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

	/**
	 * Screens matching what's typed. The query also filters the list on the
	 * current page, so this offers navigation on top of that rather than
	 * replacing it — searching "reservation" from Guests still reaches
	 * Reservations.
	 */
	readonly screenResults = computed<ScreenMatch[]>(() =>
		searchScreens(
			this.globalSearch.query(),
			this.screenPerms.allowedScreens(),
			this.screenPerms.loaded(),
		),
	);

	readonly resultsOpen = signal(false);
	readonly highlighted = signal(0);

	onSearchInput(value: string): void {
		this.globalSearch.setQuery(value);
		this.highlighted.set(0);
		this.resultsOpen.set(true);
	}

	openScreen(screen: ScreenMatch): void {
		this.closeResults();
		this.router.navigateByUrl(screen.route);
	}

	closeResults(): void {
		this.resultsOpen.set(false);
		this.highlighted.set(0);
	}

	onSearchKeydown(event: KeyboardEvent): void {
		const results = this.screenResults();
		switch (event.key) {
			case "ArrowDown":
				if (!results.length) return;
				event.preventDefault();
				// Reopening lands on the first result rather than skipping past it.
				if (!this.resultsOpen()) {
					this.resultsOpen.set(true);
					return;
				}
				this.highlighted.update((i) => (i + 1) % results.length);
				break;
			case "ArrowUp":
				if (!results.length) return;
				event.preventDefault();
				this.highlighted.update((i) => (i - 1 + results.length) % results.length);
				break;
			case "Enter": {
				const target = results[this.highlighted()];
				if (!target) return;
				event.preventDefault();
				this.openScreen(target);
				break;
			}
			case "Escape":
				event.preventDefault();
				if (this.resultsOpen() && this.globalSearch.query()) {
					this.closeResults();
				} else {
					this.globalSearch.clear();
					this.searchInput()?.nativeElement?.blur();
				}
				break;
		}
	}

	focusSearch(): void {
		this.resultsOpen.set(true);
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
		const target = event.target;
		if (
			this.resultsOpen() &&
			target instanceof Node &&
			!this.searchWidget()?.nativeElement.contains(target)
		) {
			this.closeResults();
		}
		if (!this.notifications.panelOpen()) return;
		const panel = this.notifPanel();
		if (panel && target instanceof Node && !panel.nativeElement.contains(target)) {
			this.notifications.closePanel();
		}
	}
}
