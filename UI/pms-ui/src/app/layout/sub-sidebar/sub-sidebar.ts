import { Component, input, output } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { TooltipModule } from "primeng/tooltip";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
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
