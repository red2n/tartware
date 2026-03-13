import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { HeaderComponent } from "./shared/header";

@Component({
	selector: "gp-root",
	standalone: true,
	imports: [RouterOutlet, HeaderComponent],
	template: `
		<gp-header />
		<main class="portal-content">
			<router-outlet />
		</main>
	`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}
		.portal-content {
			flex: 1;
			max-width: 960px;
			margin: 0 auto;
			padding: 24px 16px;
			width: 100%;
		}
	`,
})
export class App {}
