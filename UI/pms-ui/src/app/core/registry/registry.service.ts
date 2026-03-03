import { computed, Injectable, signal } from "@angular/core";

import { ApiService } from "../api/api.service";

export interface ServiceInstance {
	instanceId: string;
	name: string;
	version: string;
	host: string;
	port: number;
	status: "UP" | "DOWN";
	registeredAt: string;
	lastHeartbeat: string;
	metadata?: Record<string, unknown>;
}

export interface RegistrySummary {
	total: number;
	up: number;
	down: number;
}

export interface RegistryResponse {
	services: ServiceInstance[];
	summary: RegistrySummary;
}

const POLL_INTERVAL_MS = 10_000;
const STATUSBAR_STORAGE_KEY = "statusbar_visible";

@Injectable({ providedIn: "root" })
export class RegistryService {
	private readonly api = new ApiService();
	private pollTimer: ReturnType<typeof setInterval> | null = null;

	private readonly _services = signal<ServiceInstance[]>([]);
	private readonly _summary = signal<RegistrySummary>({ total: 0, up: 0, down: 0 });
	private readonly _loading = signal(false);
	private readonly _error = signal<string | null>(null);
	private readonly _lastUpdated = signal<Date | null>(null);
	private readonly _statusBarVisible = signal(this.restoreVisibility());

	readonly services = this._services.asReadonly();
	readonly summary = this._summary.asReadonly();
	readonly loading = this._loading.asReadonly();
	readonly error = this._error.asReadonly();
	readonly lastUpdated = this._lastUpdated.asReadonly();
	readonly statusBarVisible = this._statusBarVisible.asReadonly();

	readonly hasIssues = computed(() => this._summary().down > 0 || this._error() !== null);

	constructor(private readonly apiService: ApiService) {}

	async fetchServices(): Promise<void> {
		this._loading.set(true);
		this._error.set(null);
		try {
			const res = await this.apiService.get<RegistryResponse>("/registry/services");
			this._services.set(res.services);
			this._summary.set(res.summary);
			this._lastUpdated.set(new Date());
		} catch (err) {
			this._error.set(err instanceof Error ? err.message : "Failed to fetch services");
		} finally {
			this._loading.set(false);
		}
	}

	startPolling(): void {
		if (this.pollTimer) return;
		this.fetchServices();
		this.pollTimer = setInterval(() => this.fetchServices(), POLL_INTERVAL_MS);
	}

	stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	setStatusBarVisible(visible: boolean): void {
		this._statusBarVisible.set(visible);
		localStorage.setItem(STATUSBAR_STORAGE_KEY, JSON.stringify(visible));
		if (visible) {
			this.startPolling();
		} else {
			this.stopPolling();
		}
	}

	toggleStatusBar(): void {
		this.setStatusBarVisible(!this._statusBarVisible());
	}

	private restoreVisibility(): boolean {
		const stored = localStorage.getItem(STATUSBAR_STORAGE_KEY);
		if (stored === null) return false;
		try {
			return JSON.parse(stored) === true;
		} catch {
			return false;
		}
	}
}
