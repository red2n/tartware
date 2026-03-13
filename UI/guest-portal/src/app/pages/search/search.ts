import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { portalConfig } from "../../portal-config";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from "@angular/material/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import type { AvailableRoomType } from "@tartware/schemas";
import { GuestApiService } from "../../services/guest-api.service";

@Component({
	selector: "gp-search",
	standalone: true,
	imports: [
		FormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatDatepickerModule,
		MatNativeDateModule,
		MatButtonModule,
		MatCardModule,
		MatIconModule,
		MatProgressSpinnerModule,
	],
	template: `
		<section class="search-form">
			<h2>Find your perfect room</h2>
			<div class="fields">
				<mat-form-field appearance="outline">
					<mat-label>Check-in</mat-label>
					<input matInput [matDatepicker]="checkInPicker" [(ngModel)]="checkIn" [min]="today" />
					<mat-datepicker-toggle matIconSuffix [for]="checkInPicker" />
					<mat-datepicker #checkInPicker />
				</mat-form-field>

				<mat-form-field appearance="outline">
					<mat-label>Check-out</mat-label>
					<input matInput [matDatepicker]="checkOutPicker" [(ngModel)]="checkOut" [min]="checkIn" />
					<mat-datepicker-toggle matIconSuffix [for]="checkOutPicker" />
					<mat-datepicker #checkOutPicker />
				</mat-form-field>

				<mat-form-field appearance="outline">
					<mat-label>Adults</mat-label>
					<input matInput type="number" [(ngModel)]="adults" min="1" max="10" />
				</mat-form-field>

				<mat-form-field appearance="outline">
					<mat-label>Children</mat-label>
					<input matInput type="number" [(ngModel)]="children" min="0" max="10" />
				</mat-form-field>
			</div>

			<button mat-flat-button color="primary" (click)="search()" [disabled]="loading()">
				@if (loading()) {
					<mat-spinner diameter="20" />
				} @else {
					Search Availability
				}
			</button>

			@if (error()) {
				<p class="error">{{ error() }}</p>
			}
		</section>

		@if (results().length) {
			<section class="results">
				<h3>Available Rooms</h3>
				<div class="cards">
					@for (room of results(); track room.roomTypeId) {
						<mat-card class="room-card">
							<mat-card-header>
								<mat-icon matCardAvatar>hotel</mat-icon>
								<mat-card-title>{{ room.roomTypeName }}</mat-card-title>
								<mat-card-subtitle>Up to {{ room.maxOccupancy }} guests</mat-card-subtitle>
							</mat-card-header>
							<mat-card-content>
								<p>{{ room.description }}</p>
								<p class="amenities">
									@for (a of room.amenities; track a) {
										<span class="chip">{{ a }}</span>
									}
								</p>
								<p class="availability">{{ room.availableCount }} rooms left</p>
							</mat-card-content>
							<mat-card-actions>
								<span class="price">{{ room.currency }} {{ room.baseRate }} / night</span>
								<button mat-flat-button color="primary" (click)="selectRoom(room)">
									Book Now
								</button>
							</mat-card-actions>
						</mat-card>
					}
				</div>
			</section>
		}
	`,
	styles: `
		:host { display: block; }
		.search-form { text-align: center; padding: 2rem 0; }
		.search-form h2 { margin-bottom: 1.5rem; font-weight: 300; font-size: 1.8rem; }
		.fields { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
		.fields mat-form-field { width: 180px; }
		.error { color: #d32f2f; margin-top: 1rem; }
		.results { padding: 1rem 0; }
		.results h3 { margin-bottom: 1rem; }
		.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
		.room-card mat-card-content { padding-top: 0.5rem; }
		.amenities { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.5rem 0; }
		.chip {
			background: #e3f2fd; color: #1565c0; padding: 2px 10px; border-radius: 12px;
			font-size: 0.8rem;
		}
		.availability { color: #2e7d32; font-weight: 500; font-size: 0.9rem; }
		mat-card-actions {
			display: flex; align-items: center; justify-content: space-between; padding: 0 16px 8px;
		}
		.price { font-size: 1.1rem; font-weight: 600; color: #1565c0; }
	`,
})
export class SearchPage {
	private readonly api = new GuestApiService();
	private readonly router: Router;

	today = new Date();
	checkIn = new Date();
	checkOut = new Date(Date.now() + 86_400_000);
	adults = 2;
	children = 0;

	loading = signal(false);
	error = signal("");
	results = signal<AvailableRoomType[]>([]);

	constructor(router: Router) {
		this.router = router;
	}

	async search() {
		this.loading.set(true);
		this.error.set("");
		try {
			const fmt = (d: Date) => d.toISOString().slice(0, 10);
			const data = await this.api.searchRooms({
				tenant_id: portalConfig.tenantId,
				property_id: portalConfig.propertyId,
				check_in_date: fmt(this.checkIn),
				check_out_date: fmt(this.checkOut),
				adults: this.adults,
				children: this.children || undefined,
			});
			this.results.set(data.roomTypes ?? []);
		} catch (e: unknown) {
			this.error.set(e instanceof Error ? e.message : "Search failed");
		} finally {
			this.loading.set(false);
		}
	}

	selectRoom(room: AvailableRoomType) {
		this.router.navigate(["/book", room.roomTypeId], {
			queryParams: {
				check_in: this.checkIn.toISOString().slice(0, 10),
				check_out: this.checkOut.toISOString().slice(0, 10),
				adults: this.adults,
				children: this.children,
				name: room.roomTypeName,
				rate: room.baseRate,
				currency: room.currency,
			},
		});
	}
}
