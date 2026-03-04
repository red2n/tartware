import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink, RouterLinkActive } from "@angular/router";

import type { NavItem } from "../nav-config";

@Component({
	selector: "app-sub-sidebar",
	standalone: true,
	imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
	templateUrl: "./sub-sidebar.html",
	styleUrl: "./sub-sidebar.scss",
})
export class SubSidebarComponent {
	readonly parentLabel = input.required<string>();
	readonly parentIcon = input.required<string>();
	readonly items = input.required<NavItem[]>();
	readonly collapsed = input(true);
	readonly toggleCollapse = output<void>();
}
