import { Component, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { ToastContainerComponent } from "../../shared/toast/toast-container";
import { SidebarComponent } from "../sidebar/sidebar";
import { TopbarComponent } from "../topbar/topbar";

@Component({
	selector: "app-shell",
	standalone: true,
	imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastContainerComponent],
	templateUrl: "./shell.html",
	styleUrl: "./shell.scss",
})
export class ShellComponent {
	readonly sidebarCollapsed = signal(false);

	toggleSidebar(): void {
		this.sidebarCollapsed.update((v) => !v);
	}
}
