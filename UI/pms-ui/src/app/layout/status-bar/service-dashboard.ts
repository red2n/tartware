import { Component, computed, inject, output } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import { RegistryService, type ServiceInstance } from "../../core/registry/registry.service";

/** Hardcoded descriptions for known services — presentation data owned by the UI. */
const SERVICE_DESCRIPTIONS: Record<string, string> = {
	"@tartware/core-service": "Authentication, tenants, users, and service registry",
	"@tartware/api-gateway": "Unified entry point for all API requests",
	"@tartware/guests-service": "Guest profiles, history, and preferences",
	"@tartware/rooms-service": "Room inventory, types, and availability",
	"@tartware/reservations-command-service": "Reservation creation and lifecycle management",
	"@tartware/billing-service": "Charges, payments, and financial statements",
	"@tartware/housekeeping-service": "Room cleaning schedules and task management",
	"@tartware/availability-guard-service": "Room inventory locking and overbooking prevention",
	"@tartware/notification-service": "Booking confirmations and guest communications",
	"@tartware/revenue-service": "Revenue analytics and performance reporting",
};

@Component({
	selector: "app-service-dashboard",
	standalone: true,
	imports: [MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule],
	templateUrl: "./service-dashboard.html",
	styleUrl: "./service-dashboard.scss",
})
export class ServiceDashboardComponent {
	readonly close = output<void>();
	private readonly registry = inject(RegistryService);

	readonly services = this.registry.services;
	readonly summary = this.registry.summary;
	readonly loading = this.registry.loading;
	readonly error = this.registry.error;

	readonly upServices = computed(() => this.services().filter((s) => s.status === "UP"));
	readonly downServices = computed(() => this.services().filter((s) => s.status === "DOWN"));

	refresh(): void {
		this.registry.fetchServices();
	}

	onBackdropClick(event: MouseEvent): void {
		if ((event.target as HTMLElement).classList.contains("dashboard-backdrop")) {
			this.close.emit();
		}
	}

	onBackdropKeydown(event: KeyboardEvent): void {
		if (event.key === "Escape") {
			this.close.emit();
		}
	}

	/** Human-readable service name. Uses backend metadata if available, else derives from package name. */
	displayName(svc: ServiceInstance): string {
		const meta = svc.metadata?.["displayName"];
		if (typeof meta === "string" && meta) return meta;
		// Derive from package name: "@tartware/api-gateway" → "Api Gateway"
		const base = svc.name.replace(/^@[^/]+\//, "").replace(/-/g, " ");
		return base.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/** Short service description. Uses backend metadata if available, else falls back to known map. */
	description(svc: ServiceInstance): string | null {
		const meta = svc.metadata?.["description"];
		if (typeof meta === "string" && meta) return meta;
		return SERVICE_DESCRIPTIONS[svc.name] ?? null;
	}

	relativeTime(iso: string): string {
		const ms = Date.now() - new Date(iso).getTime();
		const secs = Math.round(ms / 1000);
		if (secs < 5) return "just now";
		if (secs < 60) return `${secs}s ago`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		return `${Math.floor(secs / 3600)}h ago`;
	}

	formatPort(instance: ServiceInstance): string {
		return `${instance.host}:${instance.port}`;
	}
}
