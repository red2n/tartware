import { computed, Injectable, NgZone, OnDestroy, signal } from "@angular/core";

import type { AuthMembership, LoginResponse, TokenRefreshResponse } from "@tartware/schemas";

import { ApiService } from "../api/api.service";

export type UserInfo = Pick<
	LoginResponse,
	"id" | "username" | "email" | "first_name" | "last_name"
>;

/** Refresh the token 5 minutes before it expires. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Maximum age (ms) of an expired token that can still be refreshed.
 * Must match the server-side REFRESH_GRACE_SECONDS (600s = 10 min).
 */
const REFRESH_GRACE_MS = 10 * 60 * 1000;

/** Max retry attempts for transient refresh failures (network, 5xx). */
const REFRESH_MAX_RETRIES = 3;

/** Base delay (ms) for exponential backoff between retries. */
const REFRESH_RETRY_BASE_MS = 1_000;

/**
 * Periodic health-check interval (ms) while the tab is active.
 * Acts as a safety net for throttled/missed setTimeout timers.
 */
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AuthService implements OnDestroy {
	private readonly _user = signal<UserInfo | null>(null);
	private readonly _tenantId = signal<string | null>(null);
	private readonly _memberships = signal<AuthMembership[]>([]);
	private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
	private healthCheckTimerId: ReturnType<typeof setInterval> | null = null;
	private isRefreshing = false;
	private consecutiveRefreshFailures = 0;

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
		this.clearHealthCheck();
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
		this.clearHealthCheck();
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
		if (!token) {
			this.logout();
			return;
		}

		// If the token is expired beyond the grace window, force logout.
		// If it's expired but within grace, try a silent refresh instead of logging out.
		if (this.isTokenExpired(token)) {
			if (this.isWithinRefreshGrace(token)) {
				if (!this.restoreLocalState()) {
					this.logout();
					return;
				}
				this.refreshToken();
				return;
			}
			this.logout();
			return;
		}

		if (!this.restoreLocalState()) {
			this.logout();
			return;
		}
		this.scheduleTokenRefresh(token);
	}

	/** Restore user, tenant, and membership signals from localStorage. */
	private restoreLocalState(): boolean {
		const stored = localStorage.getItem("user_info");
		if (stored) {
			try {
				this._user.set(JSON.parse(stored) as UserInfo);
			} catch {
				return false;
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

		return true;
	}

	/**
	 * Schedule a silent token refresh before the current token expires.
	 * Runs outside Angular zone so the timer doesn't trigger change detection.
	 * Also starts a periodic health check as a safety net for throttled timers.
	 */
	private scheduleTokenRefresh(token: string): void {
		this.clearRefreshTimer();
		this.consecutiveRefreshFailures = 0;

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

		this.startHealthCheck();
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

		if (this.isTokenExpired(token)) {
			if (this.isWithinRefreshGrace(token)) {
				this.refreshToken();
			} else {
				// Beyond grace — no point retrying
				this.ngZone.run(() => this.forceLogout());
			}
			return;
		}

		const expiresAt = this.getTokenExpiry(token);
		if (!expiresAt) return;

		const remainingMs = expiresAt - Date.now();
		if (remainingMs <= REFRESH_BUFFER_MS) {
			this.refreshToken();
		} else {
			this.scheduleTokenRefresh(token);
		}
	}

	/**
	 * Attempt to refresh the access token with retry + exponential backoff.
	 *
	 * Only force-logs out on definitive auth failures (401/403).
	 * Transient errors (network, 5xx) are retried up to REFRESH_MAX_RETRIES
	 * before giving up. After all retries, checks if the current token is
	 * still within the grace window — if so, schedules another attempt later
	 * rather than force-logging out.
	 */
	private async refreshToken(): Promise<void> {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			const token = localStorage.getItem("access_token");
			if (!token) {
				this.ngZone.run(() => this.forceLogout());
				return;
			}

			let lastStatus = 0;
			for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
				if (attempt > 0) {
					const delay = REFRESH_RETRY_BASE_MS * 2 ** (attempt - 1);
					const jitter = Math.floor(Math.random() * delay * 0.25);
					await new Promise((r) => setTimeout(r, delay + jitter));
				}

				try {
					const response = await fetch("/v1/auth/refresh", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${localStorage.getItem("access_token") ?? token}`,
						},
					});

					lastStatus = response.status;

					if (response.ok) {
						const data: TokenRefreshResponse = await response.json();
						localStorage.setItem("access_token", data.access_token);
						this.consecutiveRefreshFailures = 0;
						this.scheduleTokenRefresh(data.access_token);
						return;
					}

					// Definitive auth failure — no point retrying
					if (response.status === 401 || response.status === 403) {
						console.warn("[auth] refresh rejected by server (", response.status, ")");
						this.ngZone.run(() => this.forceLogout());
						return;
					}

					// 429 (rate limited) or 5xx — retry
					console.warn(
						`[auth] refresh attempt ${attempt + 1}/${REFRESH_MAX_RETRIES + 1} failed: ${response.status}`,
					);
				} catch {
					// Network error — retry
					console.warn(
						`[auth] refresh attempt ${attempt + 1}/${REFRESH_MAX_RETRIES + 1} network error`,
					);
				}
			}

			// All retries exhausted — check if we still have a usable token
			this.consecutiveRefreshFailures++;
			const currentToken = localStorage.getItem("access_token");
			if (currentToken && !this.isTokenExpired(currentToken)) {
				// Token is still valid — reschedule and try again later
				console.warn("[auth] refresh failed but token still valid, rescheduling");
				this.scheduleTokenRefresh(currentToken);
				return;
			}

			if (currentToken && this.isWithinRefreshGrace(currentToken)) {
				// Token expired but within grace — schedule a retry in 30s
				console.warn("[auth] token expired, within grace — retrying in 30s");
				this.ngZone.runOutsideAngular(() => {
					this.refreshTimerId = setTimeout(() => this.refreshToken(), 30_000);
				});
				return;
			}

			// Token fully expired beyond grace, all retries failed
			console.warn("[auth] token expired beyond grace after", REFRESH_MAX_RETRIES + 1, "attempts, status:", lastStatus);
			this.ngZone.run(() => this.forceLogout());
		} finally {
			this.isRefreshing = false;
		}
	}

	/** Log out and redirect to login. Used when token refresh fails. */
	private forceLogout(): void {
		this.clearHealthCheck();
		this.logout();
		window.location.assign("/login");
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimerId !== null) {
			clearTimeout(this.refreshTimerId);
			this.refreshTimerId = null;
		}
	}

	/**
	 * Periodic health check — runs every 2 minutes while the tab is active.
	 * Catches cases where setTimeout is throttled or silently dropped.
	 */
	private startHealthCheck(): void {
		this.clearHealthCheck();
		this.ngZone.runOutsideAngular(() => {
			this.healthCheckTimerId = setInterval(() => {
				if (document.visibilityState !== "visible") return;
				this.checkAndRefreshToken();
			}, HEALTH_CHECK_INTERVAL_MS);
		});
	}

	private clearHealthCheck(): void {
		if (this.healthCheckTimerId !== null) {
			clearInterval(this.healthCheckTimerId);
			this.healthCheckTimerId = null;
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

	/** True if the token is expired but the server would still accept it for refresh. */
	private isWithinRefreshGrace(token: string): boolean {
		const expiresAt = this.getTokenExpiry(token);
		if (!expiresAt) return false;
		return Date.now() < expiresAt + REFRESH_GRACE_MS;
	}
}
