import { Component, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { GuestApiService, type BookingDetail } from "../../services/guest-api.service";

@Component({
	selector: "gp-lookup",
	standalone: true,
	imports: [
		FormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatCardModule,
		MatIconModule,
		MatProgressSpinnerModule,
	],
	template: `
		<mat-card class="lookup-card">
			<mat-card-header>
				<mat-icon matCardAvatar>search</mat-icon>
				<mat-card-title>Look Up Your Booking</mat-card-title>
			</mat-card-header>

			<mat-card-content>
				<div class="search-row">
					<mat-form-field appearance="outline" class="code-field">
						<mat-label>Confirmation Code</mat-label>
						<input matInput [(ngModel)]="code" (keyup.enter)="lookup()" placeholder="e.g. ABC123" />
					</mat-form-field>
					<button mat-flat-button color="primary" (click)="lookup()" [disabled]="loading() || !code">
						@if (loading()) {
							<mat-spinner diameter="20" />
						} @else {
							Find
						}
					</button>
				</div>

				@if (notFound()) {
					<p class="warn">No booking found for "{{ searched() }}".</p>
				}

				@if (booking(); as b) {
					<div class="details">
						<h3>{{ b.guestName }}</h3>
						<div class="row"><span>Confirmation</span><span>{{ b.confirmationCode }}</span></div>
						<div class="row"><span>Property</span><span>{{ b.propertyName }}</span></div>
						<div class="row"><span>Check-in</span><span>{{ b.checkInDate }}</span></div>
						<div class="row"><span>Check-out</span><span>{{ b.checkOutDate }}</span></div>
						<div class="row"><span>Guests</span><span>{{ b.adults }} adults, {{ b.children }} children</span></div>
						<div class="row"><span>Status</span><span class="status">{{ b.status }}</span></div>
					</div>
				}
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 500px; margin: 2rem auto; }
		.lookup-card { padding: 1rem; }
		.search-row { display: flex; gap: 1rem; align-items: center; padding-top: 1rem; }
		.code-field { flex: 1; }
		.warn { color: #ed6c02; margin-top: 1rem; }
		.details { border-top: 1px solid #e0e0e0; margin-top: 1.5rem; padding-top: 1rem; }
		.details h3 { margin: 0 0 0.75rem; }
		.row {
			display: flex; justify-content: space-between; padding: 0.4rem 0;
			border-bottom: 1px solid #f5f5f5;
		}
		.row span:first-child { color: #616161; }
		.status { text-transform: capitalize; font-weight: 500; color: #1565c0; }
	`,
})
export class LookupPage {
	private readonly api = new GuestApiService();
	private readonly router: Router;

	code = "";
	loading = signal(false);
	notFound = signal(false);
	searched = signal("");
	booking = signal<BookingDetail | null>(null);

	constructor(router: Router) {
		this.router = router;
	}

	async lookup() {
		if (!this.code.trim()) return;
		this.loading.set(true);
		this.notFound.set(false);
		this.booking.set(null);
		this.searched.set(this.code.trim());
		try {
			const result = await this.api.lookupBooking(this.code.trim());
			if (result) {
				this.booking.set(result);
			} else {
				this.notFound.set(true);
			}
		} catch {
			this.notFound.set(true);
		} finally {
			this.loading.set(false);
		}
	}
}
