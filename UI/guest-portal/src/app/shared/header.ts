import { Component } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterLink } from "@angular/router";

@Component({
	selector: "gp-header",
	standalone: true,
	imports: [MatToolbarModule, MatIconModule, MatButtonModule, RouterLink],
	template: `
		<mat-toolbar color="primary" class="portal-header">
			<a routerLink="/" class="logo">
				<img src="assets/logo.png" class="logo-img" alt="Tartware" />
				<span class="logo-text">tartware</span>
			</a>
			<span class="spacer"></span>
			<a mat-button routerLink="/lookup">
				<mat-icon>search</mat-icon>
				My Booking
			</a>
			<a mat-button routerLink="/checkin">
				<mat-icon>smartphone</mat-icon>
				Check In
			</a>
		</mat-toolbar>
	`,
	styles: `
		.portal-header {
			background: #25292e;
			color: #fff;
		}
		.logo-img {
			width: 24px;
			height: 24px;
			flex-shrink: 0;
		}
		.logo {
			display: flex;
			align-items: center;
			gap: 8px;
			color: #fff;
			text-decoration: none;
			font-weight: 500;
			font-size: 18px;
		}
		.spacer {
			flex: 1;
		}
		a[mat-button] {
			color: rgba(255, 255, 255, 0.87);
		}
	`,
})
export class HeaderComponent {}
