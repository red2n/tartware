import { Component, inject, type OnDestroy, type OnInit, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

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
	readonly dashboardOpen = signal(false);

	ngOnInit(): void {
		this.registry.startPolling();
	}

	ngOnDestroy(): void {
		this.registry.stopPolling();
	}

	toggleDashboard(): void {
		this.dashboardOpen.update((v) => !v);
	}

	closeDashboard(): void {
		this.dashboardOpen.set(false);
	}

	formatLastUpdated(): string {
		const d = this.registry.lastUpdated();
		if (!d) return "never";
		const secs = Math.round((Date.now() - d.getTime()) / 1000);
		if (secs < 5) return "just now";
		if (secs < 60) return `${secs}s ago`;
		return `${Math.floor(secs / 60)}m ago`;
	}
}
