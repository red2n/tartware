import { Component, computed, inject, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import { ScreenPermissionsService } from "../../core/auth/screen-permissions.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import type { NavItem } from "../nav-config";
import { filterNavByAllowedScreens, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "../nav-config";

@Component({
	selector: "app-activity-bar",
	standalone: true,
	imports: [MatIconModule, MatTooltipModule, TranslatePipe],
	templateUrl: "./activity-bar.html",
	styleUrl: "./activity-bar.scss",
})
export class ActivityBarComponent {
	private readonly screenPerms = inject(ScreenPermissionsService);

	readonly activeItemLabel = input<string | null>(null);
	readonly itemSelect = output<NavItem>();

	readonly primaryNavItems = computed(() => {
		return filterNavByAllowedScreens(PRIMARY_NAV_ITEMS, this.screenPerms.allowedScreens(), this.screenPerms.loaded());
	});

	readonly secondaryNavItems = computed(() => {
		return filterNavByAllowedScreens(SECONDARY_NAV_ITEMS, this.screenPerms.allowedScreens(), this.screenPerms.loaded());
	});

	isActive(item: NavItem): boolean {
		return this.activeItemLabel() === item.label;
	}

	onItemClick(item: NavItem): void {
		this.itemSelect.emit(item);
	}
}
