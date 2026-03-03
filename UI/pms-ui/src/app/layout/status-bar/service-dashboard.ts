import { Component, computed, inject, output } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import { RegistryService, type ServiceInstance } from "../../core/registry/registry.service";

@Component({
	selector: "app-service-dashboard",
	standalone: true,
	imports: [MatIconModule, MatButtonModule, MatTooltipModule],
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

	trackByInstanceId(_index: number, instance: ServiceInstance): string {
		return instance.instanceId;
	}
}
