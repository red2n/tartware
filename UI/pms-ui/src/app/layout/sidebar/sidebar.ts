import { Component, computed, inject, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { ScreenPermissionsService } from "../../core/auth/screen-permissions.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import type { NavItem } from "../nav-config";
import { filterNavByAllowedScreens, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "../nav-config";

@Component({
	selector: "app-sidebar",
	standalone: true,
	imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, TranslatePipe],
	templateUrl: "./sidebar.html",
	styleUrl: "./sidebar.scss",
})
export class SidebarComponent {
	private readonly screenPerms = inject(ScreenPermissionsService);

	readonly collapsed = input(false);
	readonly activeParentLabel = input<string | null>(null);
	readonly toggleCollapse = output<void>();
	readonly parentSelect = output<NavItem>();

	readonly primaryNavItems = computed(() => {
		return filterNavByAllowedScreens(PRIMARY_NAV_ITEMS, this.screenPerms.allowedScreens());
	});

	readonly secondaryNavItems = computed(() => {
		return filterNavByAllowedScreens(SECONDARY_NAV_ITEMS, this.screenPerms.allowedScreens());
	});

	isParentActive(item: NavItem): boolean {
		return this.activeParentLabel() === item.label;
	}

	onParentClick(item: NavItem): void {
		this.parentSelect.emit(item);
	}
}
