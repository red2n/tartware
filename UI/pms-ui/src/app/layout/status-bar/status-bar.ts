import { Component, computed, inject, type OnDestroy, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import { BUILD_VERSION } from "../../../environments/build-version";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { RegistryService } from "../../core/registry/registry.service";
import { ServiceDashboardComponent } from "./service-dashboard";

@Component({
	selector: "app-status-bar",
	standalone: true,
	imports: [MatIconModule, MatTooltipModule, ServiceDashboardComponent],
	templateUrl: "./status-bar.html",
	styleUrl: "./status-bar.scss",
})
export class StatusBarComponent implements OnInit, OnDestroy {
	readonly registry = inject(RegistryService);
	private readonly auth = inject(AuthService);
	private readonly tenantCtx = inject(TenantContextService);

	readonly dashboardOpen = signal(false);
	readonly buildVersion = BUILD_VERSION;
	readonly servicesVisible = this.registry.statusBarVisible;

	private readonly now = signal(Date.now());
	private tickTimer: ReturnType<typeof setInterval> | null = null;
	readonly online = signal(navigator.onLine);

	/** Logged-in user display: "First L." */
	readonly userName = computed(() => {
		const u = this.auth.user();
		if (!u) return "";
		const last = u.last_name ? ` ${u.last_name.charAt(0)}.` : "";
		return `${u.first_name ?? u.username}${last}`;
	});

	/** Current user's tenant role */
	readonly userRole = computed(() => {
		const m = this.auth.activeMembership();
		return m?.role ?? "";
	});

	/** Active property name */
	readonly propertyName = computed(() => {
		const p = this.tenantCtx.activeProperty();
		return p?.property_name ?? "";
	});

	/** Active property timezone */
	readonly propertyTimezone = computed(() => {
		const p = this.tenantCtx.activeProperty();
		return p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	});

	/** Live clock in property timezone */
	readonly clockText = computed(() => {
		const ts = this.now();
		const tz = this.propertyTimezone();
		const d = new Date(ts);
		return d.toLocaleString("en-US", {
			timeZone: tz,
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	});

	readonly lastUpdatedText = computed(() => {
		const d = this.registry.lastUpdated();
		if (!d) return "never";
		const secs = Math.round((this.now() - d.getTime()) / 1000);
		if (secs < 5) return "just now";
		if (secs < 60) return `${secs}s ago`;
		return `${Math.floor(secs / 60)}m ago`;
	});

	private readonly onOnline = () => this.online.set(true);
	private readonly onOffline = () => this.online.set(false);

	ngOnInit(): void {
		this.registry.startPolling();
		this.tickTimer = setInterval(() => this.now.set(Date.now()), 5_000);
		window.addEventListener("online", this.onOnline);
		window.addEventListener("offline", this.onOffline);
	}

	ngOnDestroy(): void {
		this.registry.stopPolling();
		if (this.tickTimer) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
		window.removeEventListener("online", this.onOnline);
		window.removeEventListener("offline", this.onOffline);
	}

	toggleDashboard(): void {
		this.dashboardOpen.update((v) => !v);
	}

	closeDashboard(): void {
		this.dashboardOpen.set(false);
	}
}
