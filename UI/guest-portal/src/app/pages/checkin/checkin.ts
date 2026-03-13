import { Component, signal, inject } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { portalConfig } from "../../portal-config";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatStepperModule } from "@angular/material/stepper";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import {
	GuestApiService,
	type CheckinStartResult,
	type CheckinCompleteResult,
} from "../../services/guest-api.service";

@Component({
	selector: "gp-checkin",
	standalone: true,
	imports: [
		FormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatCardModule,
		MatCheckboxModule,
		MatIconModule,
		MatStepperModule,
		MatProgressSpinnerModule,
	],
	template: `
		<mat-card class="checkin-card">
			<mat-card-header>
				<mat-icon matCardAvatar>how_to_reg</mat-icon>
				<mat-card-title>Online Check-in</mat-card-title>
			</mat-card-header>

			<mat-card-content>
				<mat-stepper [linear]="true" #stepper>
					<!-- Step 1: Identify -->
					<mat-step [completed]="!!startResult()">
						<ng-template matStepLabel>Identify</ng-template>
						<div class="step-content">
							<mat-form-field appearance="outline">
								<mat-label>Confirmation Code</mat-label>
								<input matInput [(ngModel)]="confirmationCode" />
							</mat-form-field>
							<mat-form-field appearance="outline">
								<mat-label>Last Name</mat-label>
								<input matInput [(ngModel)]="lastName" />
							</mat-form-field>
							@if (error()) {
								<p class="error">{{ error() }}</p>
							}
							<button
								mat-flat-button
								color="primary"
								(click)="startCheckin(stepper)"
								[disabled]="loading() || !confirmationCode || !lastName"
							>
								@if (loading()) {
									<mat-spinner diameter="20" />
								} @else {
									Find My Reservation
								}
							</button>
						</div>
					</mat-step>

					<!-- Step 2: Review & Accept -->
					<mat-step [completed]="!!completeResult()">
						<ng-template matStepLabel>Review</ng-template>
						@if (startResult(); as sr) {
							<div class="step-content">
								<div class="details">
									<div class="row"><span>Guest</span><span>{{ sr.guestName }}</span></div>
									<div class="row"><span>Check-in</span><span>{{ sr.checkInDate }}</span></div>
									<div class="row"><span>Check-out</span><span>{{ sr.checkOutDate }}</span></div>
									@if (sr.roomNumber) {
										<div class="row"><span>Room</span><span>{{ sr.roomNumber }}</span></div>
									}
								</div>
								@if (sr.requiresTerms) {
									<mat-checkbox [(ngModel)]="acceptedTerms">
										I accept the terms and conditions
									</mat-checkbox>
								}
								@if (completeError()) {
									<p class="error">{{ completeError() }}</p>
								}
								<button
									mat-flat-button
									color="primary"
									(click)="completeCheckin(stepper)"
									[disabled]="completing() || (sr.requiresTerms && !acceptedTerms)"
								>
									@if (completing()) {
										<mat-spinner diameter="20" />
									} @else {
										Complete Check-in
									}
								</button>
							</div>
						}
					</mat-step>

					<!-- Step 3: Done -->
					<mat-step>
						<ng-template matStepLabel>Done</ng-template>
						@if (completeResult(); as cr) {
							<div class="step-content done">
								<mat-icon class="done-icon">verified</mat-icon>
								<h2>You're checked in!</h2>
								<p class="room-number">Room <strong>{{ cr.roomNumber }}</strong></p>
								@if (cr.keyCode) {
									<p>Digital key code: <strong>{{ cr.keyCode }}</strong></p>
								}
								<button mat-flat-button color="primary" (click)="finish()">Done</button>
							</div>
						}
					</mat-step>
				</mat-stepper>
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 560px; margin: 2rem auto; }
		.checkin-card { padding: 1rem; }
		.step-content { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0; }
		.details { border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; }
		.row {
			display: flex; justify-content: space-between; padding: 0.3rem 0;
			border-bottom: 1px solid #f5f5f5;
		}
		.row span:first-child { color: #616161; }
		.error { color: #d32f2f; margin: 0; }
		.done { text-align: center; align-items: center; }
		.done-icon { font-size: 64px; width: 64px; height: 64px; color: #2e7d32; }
		.room-number { font-size: 1.4rem; }
	`,
})
export class CheckinPage {
	private readonly api = new GuestApiService();
	private readonly router = inject(Router);

	confirmationCode = "";
	lastName = "";
	acceptedTerms = false;

	loading = signal(false);
	completing = signal(false);
	error = signal("");
	completeError = signal("");

	startResult = signal<CheckinStartResult | null>(null);
	completeResult = signal<CheckinCompleteResult | null>(null);

	async startCheckin(stepper: { next: () => void }) {
		this.loading.set(true);
		this.error.set("");
		try {
			const result = await this.api.startCheckin({
				confirmation_code: this.confirmationCode.trim(),
				last_name: this.lastName.trim(),
				tenant_id: portalConfig.tenantId,
			});
			this.startResult.set(result);
			stepper.next();
		} catch (e: unknown) {
			this.error.set(e instanceof Error ? e.message : "Could not start check-in");
		} finally {
			this.loading.set(false);
		}
	}

	async completeCheckin(stepper: { next: () => void }) {
		const sr = this.startResult();
		if (!sr) return;
		this.completing.set(true);
		this.completeError.set("");
		try {
			const result = await this.api.completeCheckin(sr.checkinId, {
				tenant_id: portalConfig.tenantId,
				accepted_terms: this.acceptedTerms,
			});
			this.completeResult.set(result);
			stepper.next();
		} catch (e: unknown) {
			this.completeError.set(e instanceof Error ? e.message : "Check-in completion failed");
		} finally {
			this.completing.set(false);
		}
	}

	finish() {
		this.router.navigate(["/"]);
	}
}
