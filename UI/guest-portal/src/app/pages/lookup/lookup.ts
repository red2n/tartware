import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import type { BookingLookupResponse } from "@tartware/schemas";
import { GuestApiService } from "../../services/guest-api.service";

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

				@if (error(); as message) {
					<p class="error" role="alert">{{ message }}</p>
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
		.warn { color: var(--fgColor-attention); margin-top: 1rem; }
		.error { color: var(--fgColor-danger); margin-top: 1rem; }
		.details { border-top: 1px solid var(--borderColor-default); margin-top: 1.5rem; padding-top: 1rem; }
		.details h3 { margin: 0 0 0.75rem; }
		.row {
			display: flex; justify-content: space-between; padding: 0.4rem 0;
			border-bottom: 1px solid var(--borderColor-muted);
		}
		.row span:first-child { color: var(--fgColor-muted); }
		.status { text-transform: capitalize; font-weight: 500; color: var(--fgColor-accent); }
	`,
})
export class LookupPage {
	private readonly api = inject(GuestApiService);

	code = "";
	loading = signal(false);
	notFound = signal(false);
	error = signal<string | null>(null);
	searched = signal("");
	booking = signal<BookingLookupResponse | null>(null);

	async lookup() {
		const code = this.code.trim();
		if (!code) return;
		this.loading.set(true);
		this.notFound.set(false);
		this.error.set(null);
		this.booking.set(null);
		this.searched.set(code);
		try {
			const result = await this.api.lookupBooking(code);
			if (result) {
				this.booking.set(result);
			} else {
				this.notFound.set(true);
			}
		} catch (e: unknown) {
			// A failed request is not a missing booking. Telling a guest their
			// reservation does not exist because the gateway is down sends them
			// to the phone; every other page in the portal reports the failure.
			this.error.set(
				e instanceof Error ? e.message : "We could not reach the booking system. Please retry.",
			);
		} finally {
			this.loading.set(false);
		}
	}
}
