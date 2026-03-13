import { Component, OnInit, signal, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { portalConfig } from "../../portal-config";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { GuestApiService, type BookingRequest } from "../../services/guest-api.service";

@Component({
	selector: "gp-booking",
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
		<mat-card class="booking-card">
			<mat-card-header>
				<mat-icon matCardAvatar>book_online</mat-icon>
				<mat-card-title>Complete Your Booking</mat-card-title>
				<mat-card-subtitle>
					{{ roomName() }} &mdash; {{ currency() }} {{ rate() }}/night
					&middot; {{ checkIn() }} to {{ checkOut() }}
				</mat-card-subtitle>
			</mat-card-header>

			<mat-card-content>
				<form class="form-grid" (ngSubmit)="submit()">
					<mat-form-field appearance="outline">
						<mat-label>First Name</mat-label>
						<input matInput [(ngModel)]="firstName" name="firstName" required />
					</mat-form-field>

					<mat-form-field appearance="outline">
						<mat-label>Last Name</mat-label>
						<input matInput [(ngModel)]="lastName" name="lastName" required />
					</mat-form-field>

					<mat-form-field appearance="outline">
						<mat-label>Email</mat-label>
						<input matInput type="email" [(ngModel)]="email" name="email" required />
					</mat-form-field>

					<mat-form-field appearance="outline">
						<mat-label>Phone</mat-label>
						<input matInput type="tel" [(ngModel)]="phone" name="phone" />
					</mat-form-field>

					<mat-form-field appearance="outline" class="full-width">
						<mat-label>Special Requests</mat-label>
						<textarea matInput [(ngModel)]="specialRequests" name="specialRequests" rows="3"></textarea>
					</mat-form-field>

					@if (error()) {
						<p class="error full-width">{{ error() }}</p>
					}

					<div class="actions full-width">
						<button mat-stroked-button type="button" (click)="goBack()">Back</button>
						<button mat-flat-button color="primary" type="submit" [disabled]="loading()">
							@if (loading()) {
								<mat-spinner diameter="20" />
							} @else {
								Confirm Booking
							}
						</button>
					</div>
				</form>
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 600px; margin: 2rem auto; }
		.booking-card { padding: 1rem; }
		.form-grid {
			display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1rem;
			padding-top: 1rem;
		}
		.full-width { grid-column: 1 / -1; }
		.actions { display: flex; justify-content: space-between; margin-top: 0.5rem; }
		.error { color: #d32f2f; }
	`,
})
export class BookingPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly api = new GuestApiService();

	roomTypeId = "";
	roomName = signal("");
	rate = signal(0);
	currency = signal("USD");
	checkIn = signal("");
	checkOut = signal("");
	adults = 2;
	children = 0;

	firstName = "";
	lastName = "";
	email = "";
	phone = "";
	specialRequests = "";

	loading = signal(false);
	error = signal("");

	ngOnInit() {
		this.roomTypeId = this.route.snapshot.paramMap.get("roomTypeId") ?? "";
		const q = this.route.snapshot.queryParamMap;
		this.checkIn.set(q.get("check_in") ?? "");
		this.checkOut.set(q.get("check_out") ?? "");
		this.adults = Number(q.get("adults")) || 2;
		this.children = Number(q.get("children")) || 0;
		this.roomName.set(q.get("name") ?? "Room");
		this.rate.set(Number(q.get("rate")) || 0);
		this.currency.set(q.get("currency") ?? "USD");
	}

	async submit() {
		if (!this.firstName || !this.lastName || !this.email) {
			this.error.set("Please fill in all required fields.");
			return;
		}
		this.loading.set(true);
		this.error.set("");
		try {
			const body: BookingRequest = {
				tenant_id: portalConfig.tenantId,
				property_id: portalConfig.propertyId,
				guest_first_name: this.firstName,
				guest_last_name: this.lastName,
				guest_email: this.email,
				guest_phone: this.phone || undefined,
				room_type_id: this.roomTypeId,
				check_in_date: this.checkIn(),
				check_out_date: this.checkOut(),
				adults: this.adults,
				children: this.children || undefined,
				special_requests: this.specialRequests || undefined,
				idempotency_key: crypto.randomUUID(),
			};
			const result = await this.api.createBooking(body);
			this.router.navigate(["/confirmation", result.confirmationCode]);
		} catch (e: unknown) {
			this.error.set(e instanceof Error ? e.message : "Booking failed");
		} finally {
			this.loading.set(false);
		}
	}

	goBack() {
		this.router.navigate(["/"]);
	}
}
