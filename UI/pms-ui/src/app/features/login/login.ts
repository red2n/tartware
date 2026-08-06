import { NgTemplateOutlet } from "@angular/common";
import {
	AfterViewInit,
	Component,
	ElementRef,
	inject,
	OnDestroy,
	signal,
	ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { CheckboxModule } from "primeng/checkbox";
import { InputTextModule } from "primeng/inputtext";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { AuthService } from "../../core/auth/auth.service";
import { ScreenPermissionsService } from "../../core/auth/screen-permissions.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { ThemeService } from "../../core/theme/theme.service";
import { findFirstAllowedRoute } from "../../layout/nav-config";
import { IconComponent } from "../../shared/components/icon/icon";

/** One zone of the background floor plan — a labelled cluster of amenity marks. */
interface RoomZone {
	readonly label: string;
	readonly icons: readonly string[];
}

@Component({
	selector: "app-login",
	standalone: true,
	imports: [
		FormsModule,
		CheckboxModule,
		IconComponent,
		InputTextModule,
		NgTemplateOutlet,
		ProgressSpinnerModule,
		TranslatePipe,
	],
	templateUrl: "./login.html",
	styleUrls: ["./login-scene.scss", "./login.scss"],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
	private static readonly REMEMBER_KEY = "tartware_remember_username";

	private readonly auth = inject(AuthService);
	private readonly screenPerms = inject(ScreenPermissionsService);
	private readonly i18n = inject(I18nService);
	private readonly theme = inject(ThemeService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);

	@ViewChild("passwordInput") passwordInput!: ElementRef<HTMLInputElement>;
	@ViewChild("scene") scene!: ElementRef<HTMLElement>;
	@ViewChild("card") card!: ElementRef<HTMLElement>;

	/** Glow level the scene settles back to once the cursor leaves. */
	private static readonly REST_SPOT = "0.35";

	/**
	 * Background watermark, laid out as a suite floor plan rather than a random
	 * scatter — four zones, six amenity marks each, on a blueprint rule grid.
	 * Only ligatures from the classic Material Icons set are used.
	 */
	readonly roomPlan: readonly RoomZone[] = [
		{
			label: "Suite",
			icons: ["king_bed", "checkroom", "weekend", "lightbulb_outline", "ac_unit", "tv"],
		},
		{
			label: "Bath & Spa",
			icons: ["bathtub", "hot_tub", "spa", "local_laundry_service", "local_florist", "smoke_free"],
		},
		{
			label: "Dining",
			icons: ["room_service", "free_breakfast", "local_cafe", "local_bar", "restaurant", "kitchen"],
		},
		{
			label: "Leisure",
			icons: ["pool", "fitness_center", "beach_access", "business_center", "vpn_key", "wifi"],
		},
	];

	username = "";
	password = "";
	rememberMe = false;
	hidePassword = signal(true);
	loading = signal(false);
	error = signal<string | null>(null);

	/** Honour OS-level motion preferences — the parallax is decorative only. */
	private readonly reduceMotion =
		typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
	private pointerFrame = 0;

	togglePasswordVisibility(): void {
		this.hidePassword.update((v) => !v);
	}

	constructor() {
		// Login screen always starts in light mode
		this.theme.setLoginDefault();

		// Restore saved username if "Remember me" was checked
		const saved = localStorage.getItem(LoginComponent.REMEMBER_KEY);
		if (saved) {
			this.username = saved;
			this.rememberMe = true;
		}
	}

	ngAfterViewInit(): void {
		// If username was restored, focus the password field for quick entry
		if (this.username && this.passwordInput) {
			setTimeout(() => this.passwordInput.nativeElement.focus());
		}
	}

	ngOnDestroy(): void {
		if (this.pointerFrame) {
			cancelAnimationFrame(this.pointerFrame);
		}
	}

	/**
	 * Drives the scene's cursor-reactive CSS custom properties. Writes are
	 * coalesced to one per animation frame and go straight to the element's
	 * inline style, so pointer movement never triggers change detection.
	 */
	onPointerMove(event: PointerEvent): void {
		if (this.reduceMotion || this.pointerFrame) {
			return;
		}
		const { clientX, clientY } = event;
		this.pointerFrame = requestAnimationFrame(() => {
			this.pointerFrame = 0;
			const el = this.scene?.nativeElement;
			if (!el) {
				return;
			}
			const rect = el.getBoundingClientRect();
			if (!rect.width || !rect.height) {
				return;
			}
			const x = clientX - rect.left;
			const y = clientY - rect.top;
			el.style.setProperty("--mx", `${x}px`);
			el.style.setProperty("--my", `${y}px`);
			el.style.setProperty("--px", (x / rect.width - 0.5).toFixed(3));
			el.style.setProperty("--py", (y / rect.height - 0.5).toFixed(3));
			el.style.setProperty("--spot", "1");

			// The card's sheen and edge hairline need card-local coordinates.
			const cardEl = this.card?.nativeElement;
			if (cardEl) {
				const cardRect = cardEl.getBoundingClientRect();
				cardEl.style.setProperty("--cmx", `${clientX - cardRect.left}px`);
				cardEl.style.setProperty("--cmy", `${clientY - cardRect.top}px`);
			}
		});
	}

	/** Settle the scene back to rest when the cursor leaves. */
	onPointerLeave(): void {
		const el = this.scene?.nativeElement;
		if (!el) {
			return;
		}
		el.style.setProperty("--px", "0");
		el.style.setProperty("--py", "0");
		el.style.setProperty("--spot", LoginComponent.REST_SPOT);
	}

	async onSubmit(): Promise<void> {
		if (!this.username || !this.password) {
			this.error.set(this.i18n.t("Username and password are required."));
			return;
		}

		this.loading.set(true);
		this.error.set(null);

		try {
			await this.auth.login(this.username, this.password);

			// Persist or clear username based on "Remember me"
			if (this.rememberMe) {
				localStorage.setItem(LoginComponent.REMEMBER_KEY, this.username);
			} else {
				localStorage.removeItem(LoginComponent.REMEMBER_KEY);
			}

			// Signal the browser to save credentials
			if ("PasswordCredential" in window) {
				const cred = new (window as any).PasswordCredential({
					id: this.username,
					password: this.password,
				});
				navigator.credentials.store(cred).catch(() => {});
			}
			// Load user theme preference after login
			// Load role-based screen permissions from DB
			// Load properties and handle selection — all independent, run in parallel
			const [, , properties] = await Promise.all([
				this.theme.loadPreferences(),
				this.screenPerms.loadPermissions(),
				this.ctx.fetchProperties(),
			]);

			const landingRoute = findFirstAllowedRoute(this.screenPerms.allowedScreens());

			if (this.ctx.hasPropertySelected()) {
				// Returning user — saved property still valid, go straight in
				this.router.navigate([landingRoute]);
			} else if (properties.length <= 1) {
				// 0 or 1 property — auto-selected by service, no picker needed
				this.router.navigate([landingRoute]);
			} else {
				// Multiple properties, none saved — navigate to selection screen
				this.router.navigate(["/select-property"]);
			}
		} catch (e) {
			this.error.set(
				e instanceof Error ? e.message : this.i18n.t("Login failed. Please try again."),
			);
		} finally {
			this.loading.set(false);
		}
	}
}
