import { Component, input, output } from "@angular/core";
import { IconComponent } from '../../shared/components/icon/icon';
import { TooltipModule } from 'primeng/tooltip';
import { RouterLink, RouterLinkActive } from "@angular/router";

import { TranslatePipe } from "../../core/i18n/translate.pipe";
import type { NavItem } from "../nav-config";

@Component({
	selector: "app-sub-sidebar",
	standalone: true,
	imports: [RouterLink, RouterLinkActive, IconComponent, TooltipModule, TranslatePipe],
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
