import { computed, Injectable, NgZone, OnDestroy, signal } from "@angular/core";

import type { AuthMembership, LoginResponse, TokenRefreshResponse } from "@tartware/schemas";

import { ApiService } from "../api/api.service";

export type UserInfo = Pick<
	LoginResponse,
	"id" | "username" | "email" | "first_name" | "last_name"
>;

/** Refresh the token 2 minutes before it expires. */
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AuthService implements OnDestroy {
	private readonly _user = signal<UserInfo | null>(null);
	private readonly _tenantId = signal<string | null>(null);
	private readonly _memberships = signal<AuthMembership[]>([]);
	private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
	private isRefreshing = false;

	readonly user = this._user.asReadonly();
	readonly tenantId = this._tenantId.asReadonly();
	readonly memberships = this._memberships.asReadonly();
	readonly isAuthenticated = computed(() => this._user() !== null);

	/** The currently-selected tenant's membership record */
	readonly activeMembership = computed(() => {
		const tid = this._tenantId();
		if (!tid) return null;
		return this._memberships().find((m) => m.tenant_id === tid) ?? null;
	});

	constructor(
		private readonly api: ApiService,
		private readonly ngZone: NgZone,
	) {
		this.restoreSession();
		this.setupVisibilityListeners();
	}

	ngOnDestroy(): void {
		this.clearRefreshTimer();
		document.removeEventListener("visibilitychange", this.onVisibilityChange);
		window.removeEventListener("focus", this.onWindowFocus);
		window.removeEventListener("auth:unauthorized", this.onUnauthorized);
	}

	async login(username: string, password: string): Promise<LoginResponse> {
		const response = await this.api.post<LoginResponse>("/auth/login", {
			username,
			password,
		});

		const userInfo: UserInfo = {
			id: response.id,
			username: response.username,
			email: response.email,
			first_name: response.first_name,
			last_name: response.last_name,
		};

		localStorage.setItem("access_token", response.access_token);
		localStorage.setItem("user_info", JSON.stringify(userInfo));
		this._user.set(userInfo);

		const memberships = response.memberships ?? [];
		this._memberships.set(memberships);
		localStorage.setItem("memberships", JSON.stringify(memberships));

		// Auto-select first tenant
		const firstTenant = memberships[0];
		if (firstTenant) {
			this._tenantId.set(firstTenant.tenant_id);
			localStorage.setItem("tenant_id", firstTenant.tenant_id);
		}

		this.scheduleTokenRefresh(response.access_token);

		return response;
	}

	logout(): void {
		this.clearRefreshTimer();
		localStorage.removeItem("access_token");
		localStorage.removeItem("tenant_id");
		localStorage.removeItem("user_info");
		localStorage.removeItem("memberships");
		localStorage.removeItem("property_id");
		this._user.set(null);
		this._tenantId.set(null);
		this._memberships.set([]);
	}

	selectTenant(tenantId: string): void {
		this._tenantId.set(tenantId);
		localStorage.setItem("tenant_id", tenantId);
		// Clear property selection when switching tenants
		localStorage.removeItem("property_id");
	}

	private restoreSession(): void {
		const token = localStorage.getItem("access_token");
		if (!token || this.isTokenExpired(token)) {
			this.logout();
			return;
		}

		const stored = localStorage.getItem("user_info");
		if (stored) {
			try {
				this._user.set(JSON.parse(stored) as UserInfo);
			} catch {
				this.logout();
				return;
			}
		}

		const tenantId = localStorage.getItem("tenant_id");
		if (tenantId) {
			this._tenantId.set(tenantId);
		}

		const membershipsJson = localStorage.getItem("memberships");
		if (membershipsJson) {
			try {
				this._memberships.set(JSON.parse(membershipsJson) as AuthMembership[]);
			} catch {
				// Non-critical — memberships will be empty until next login
			}
		}

		this.scheduleTokenRefresh(token);
	}

	/**
	 * Schedule a silent token refresh before the current token expires.
	 * Runs outside Angular zone so the timer doesn't trigger change detection.
	 */
	private scheduleTokenRefresh(token: string): void {
		this.clearRefreshTimer();

		const expiresAt = this.getTokenExpiry(token);
		if (!expiresAt) return;

		const delayMs = expiresAt - Date.now() - REFRESH_BUFFER_MS;
		if (delayMs <= 0) {
			// Token is about to expire — refresh immediately
			this.refreshToken();
			return;
		}

		this.ngZone.runOutsideAngular(() => {
			this.refreshTimerId = setTimeout(() => this.refreshToken(), delayMs);
		});
	}

	private readonly onVisibilityChange = (): void => {
		if (document.visibilityState === "visible") {
			this.checkAndRefreshToken();
		}
	};

	private readonly onWindowFocus = (): void => {
		this.checkAndRefreshToken();
	};

	private readonly onUnauthorized = (): void => {
		const token = localStorage.getItem("access_token");
		if (token) {
			this.refreshToken();
		}
	};

	private setupVisibilityListeners(): void {
		document.addEventListener("visibilitychange", this.onVisibilityChange);
		window.addEventListener("focus", this.onWindowFocus);
		window.addEventListener("auth:unauthorized", this.onUnauthorized);
	}

	/**
	 * Check token validity and refresh proactively when the tab becomes
	 * visible or receives focus. Reschedules the timer if the token is
	 * still valid (timer may have been throttled while the tab was hidden).
	 */
	private checkAndRefreshToken(): void {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		const expiresAt = this.getTokenExpiry(token);
		if (!expiresAt) return;

		const remainingMs = expiresAt - Date.now();
		if (remainingMs <= REFRESH_BUFFER_MS) {
			this.refreshToken();
		} else {
			this.scheduleTokenRefresh(token);
		}
	}

	private async refreshToken(): Promise<void> {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			const token = localStorage.getItem("access_token");
			if (!token) {
				this.ngZone.run(() => this.forceLogout());
				return;
			}

			// Use fetch directly to bypass ApiService's 401 error handler
			const response = await fetch("/v1/auth/refresh", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				throw new Error(`Refresh failed: ${response.status}`);
			}

			const data: TokenRefreshResponse = await response.json();
			localStorage.setItem("access_token", data.access_token);
			this.scheduleTokenRefresh(data.access_token);
		} catch {
			this.ngZone.run(() => this.forceLogout());
		} finally {
			this.isRefreshing = false;
		}
	}

	/** Log out and redirect to login. Used when token refresh fails. */
	private forceLogout(): void {
		this.logout();
		window.location.assign("/login");
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimerId !== null) {
			clearTimeout(this.refreshTimerId);
			this.refreshTimerId = null;
		}
	}

	private getTokenExpiry(token: string): number | null {
		try {
			const parts = token.split(".");
			if (parts.length !== 3) return null;
			const base64 =
				parts[1].replace(/-/g, "+").replace(/_/g, "/") +
				"=".repeat((4 - (parts[1].length % 4)) % 4);
			const payload = JSON.parse(atob(base64));
			if (typeof payload.exp !== "number") return null;
			return payload.exp * 1000;
		} catch {
			return null;
		}
	}

	private isTokenExpired(token: string): boolean {
		const expiresAt = this.getTokenExpiry(token);
		if (!expiresAt) return true;
		// expired if less than 30s remaining
		return expiresAt < Date.now() + 30_000;
	}
}
