import { computed, Injectable, signal } from "@angular/core";

import type { AuthMembership, LoginResponse } from "@tartware/schemas";

import { ApiService } from "../api/api.service";

export type UserInfo = Pick<
	LoginResponse,
	"id" | "username" | "email" | "first_name" | "last_name"
>;

@Injectable({ providedIn: "root" })
export class AuthService {
	private readonly _user = signal<UserInfo | null>(null);
	private readonly _tenantId = signal<string | null>(null);
	private readonly _memberships = signal<AuthMembership[]>([]);

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

	constructor(private readonly api: ApiService) {
		this.restoreSession();
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

		return response;
	}

	logout(): void {
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
	}

	private isTokenExpired(token: string): boolean {
		try {
			const parts = token.split(".");
			if (parts.length !== 3) return true;
			// JWT uses base64url encoding: replace URL-safe chars and add padding
			const base64 =
				parts[1].replace(/-/g, "+").replace(/_/g, "/") +
				"=".repeat((4 - (parts[1].length % 4)) % 4);
			const payload = JSON.parse(atob(base64));
			if (typeof payload.exp !== "number") return true;
			// expired if less than 30s remaining
			return payload.exp * 1000 < Date.now() + 30_000;
		} catch {
			return true;
		}
	}
}
