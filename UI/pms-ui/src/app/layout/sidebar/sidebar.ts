import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink, RouterLinkActive } from "@angular/router";

import type { NavItem } from "../nav-config";
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "../nav-config";

@Component({
	selector: "app-sidebar",
	standalone: true,
	imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
	templateUrl: "./sidebar.html",
	styleUrl: "./sidebar.scss",
})
export class SidebarComponent {
	readonly collapsed = input(false);
	readonly activeParentLabel = input<string | null>(null);
	readonly toggleCollapse = output<void>();
	readonly parentSelect = output<NavItem>();

	readonly primaryNavItems = PRIMARY_NAV_ITEMS;
	readonly secondaryNavItems = SECONDARY_NAV_ITEMS;

	isParentActive(item: NavItem): boolean {
		return this.activeParentLabel() === item.label;
	}

	onParentClick(item: NavItem): void {
		this.parentSelect.emit(item);
	}
}
