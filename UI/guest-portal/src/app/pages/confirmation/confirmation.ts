import { Component, OnInit, signal, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import type { BookingLookupResponse } from "@tartware/schemas";
import { GuestApiService } from "../../services/guest-api.service";

@Component({
	selector: "gp-confirmation",
	standalone: true,
	imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
	template: `
		@if (loading()) {
			<div class="center"><mat-spinner /></div>
		} @else if (booking(); as b) {
			<mat-card class="confirm-card">
				<div class="success-icon">
					<mat-icon>check_circle</mat-icon>
				</div>
				<h2>Booking Confirmed!</h2>
				<p class="code">Confirmation: <strong>{{ b.confirmationCode }}</strong></p>
				<div class="details">
					<div class="row"><span>Guest</span><span>{{ b.guestName }}</span></div>
					<div class="row"><span>Property</span><span>{{ b.propertyName }}</span></div>
					<div class="row"><span>Check-in</span><span>{{ b.checkInDate }}</span></div>
					<div class="row"><span>Check-out</span><span>{{ b.checkOutDate }}</span></div>
					<div class="row"><span>Guests</span><span>{{ b.adults }} adults, {{ b.children }} children</span></div>
					<div class="row"><span>Status</span><span class="status">{{ b.status }}</span></div>
				</div>
				<div class="actions">
					<a mat-stroked-button routerLink="/">Search Again</a>
					<a mat-flat-button color="primary" routerLink="/checkin">Online Check-in</a>
				</div>
			</mat-card>
		} @else {
			<mat-card class="confirm-card">
				<mat-icon class="warn-icon">warning</mat-icon>
				<h2>Booking Not Found</h2>
				<p>We couldn't find a booking with that confirmation code.</p>
				<a mat-flat-button color="primary" routerLink="/lookup">Look Up Booking</a>
			</mat-card>
		}
	`,
	styles: `
		:host { display: block; max-width: 500px; margin: 2rem auto; }
		.center { display: flex; justify-content: center; padding: 4rem; }
		.confirm-card { text-align: center; padding: 2rem; }
		.success-icon mat-icon { font-size: 64px; width: 64px; height: 64px; color: #2e7d32; }
		.warn-icon { font-size: 48px; width: 48px; height: 48px; color: #ed6c02; }
		h2 { margin: 1rem 0 0.5rem; }
		.code { font-size: 1.1rem; margin-bottom: 1.5rem; }
		.details { text-align: left; border-top: 1px solid #e0e0e0; padding-top: 1rem; }
		.row {
			display: flex; justify-content: space-between; padding: 0.4rem 0;
			border-bottom: 1px solid #f5f5f5;
		}
		.row span:first-child { color: #616161; }
		.status { text-transform: capitalize; font-weight: 500; color: #1565c0; }
		.actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; }
	`,
})
export class ConfirmationPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly api = new GuestApiService();

	loading = signal(true);
	booking = signal<BookingLookupResponse | null>(null);

	async ngOnInit() {
		const code = this.route.snapshot.paramMap.get("confirmationCode") ?? "";
		try {
			const result = await this.api.lookupBooking(code);
			this.booking.set(result);
		} finally {
			this.loading.set(false);
		}
	}
}
