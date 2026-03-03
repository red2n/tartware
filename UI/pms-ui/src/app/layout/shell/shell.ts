import { Component, inject, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { RegistryService } from "../../core/registry/registry.service";
import { ToastContainerComponent } from "../../shared/toast/toast-container";
import { SidebarComponent } from "../sidebar/sidebar";
import { StatusBarComponent } from "../status-bar/status-bar";
import { TopbarComponent } from "../topbar/topbar";

@Component({
	selector: "app-shell",
	standalone: true,
	imports: [
		RouterOutlet,
		SidebarComponent,
		TopbarComponent,
		ToastContainerComponent,
		StatusBarComponent,
	],
	templateUrl: "./shell.html",
	styleUrl: "./shell.scss",
})
export class ShellComponent {
	private readonly registry = inject(RegistryService);
	readonly sidebarCollapsed = signal(false);
	readonly statusBarVisible = this.registry.statusBarVisible;

	toggleSidebar(): void {
		this.sidebarCollapsed.update((v) => !v);
	}
}
