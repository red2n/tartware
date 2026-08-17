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
			<a mat-button routerLink="/checkout">
				<mat-icon>logout</mat-icon>
				Check Out
			</a>
			<a mat-button routerLink="/rewards">
				<mat-icon>redeem</mat-icon>
				Rewards
			</a>
		</mat-toolbar>
	`,
	styles: `
		/* Deliberately the same dark bar in both themes — it is the product's
		   masthead, not a surface that follows the page. */
		.portal-header {
			background: var(--bgColor-emphasis);
			color: var(--fgColor-onEmphasis);
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
			color: var(--fgColor-onEmphasis);
			text-decoration: none;
			font-weight: 500;
			font-size: var(--base-text-size-lg);
		}
		.spacer {
			flex: 1;
		}
		/* Was 87% white, which drops nav links below the surrounding label
		   contrast for no design reason. */
		a[mat-button] {
			color: var(--fgColor-onEmphasis);
		}
	`,
})
export class HeaderComponent {}
