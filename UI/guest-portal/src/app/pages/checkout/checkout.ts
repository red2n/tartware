import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { portalConfig } from "../../portal-config";
import type { CheckoutPreview, MobileKey } from "../../services/guest-api.service";
import { GuestApiService } from "../../services/guest-api.service";

/**
 * Mobile check-out — folio preview, then commit.
 *
 * The portal covered booking and arrival and stopped there: `/check-out`,
 * `/check-out/preview` and `/keys` all existed with no client, so the second half
 * of the stay had no self-service path at all. See ui-gaps/11-self-service-coverage.md.
 *
 * The preview is not optional. A guest asked to confirm checkout without seeing the
 * bill has no way to dispute a charge before it settles, which is the whole reason
 * the preview endpoint exists.
 */
@Component({
	selector: "gp-checkout",
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
		<mat-card class="checkout-card">
			<mat-card-header>
				<mat-icon matCardAvatar>logout</mat-icon>
				<mat-card-title>Check Out</mat-card-title>
			</mat-card-header>

			<mat-card-content>
				@if (!done()) {
					<div class="search-row">
						<mat-form-field appearance="outline" class="code-field">
							<mat-label>Confirmation Code</mat-label>
							<input
								matInput
								[(ngModel)]="code"
								(keyup.enter)="loadPreview()"
								placeholder="e.g. ABC123"
							/>
						</mat-form-field>
						<button
							mat-flat-button
							color="primary"
							(click)="loadPreview()"
							[disabled]="loading() || !code"
						>
							@if (loading()) {
								<mat-spinner diameter="20" />
							} @else {
								View bill
							}
						</button>
					</div>
				}

				@if (error(); as message) {
					<p class="warn">{{ message }}</p>
				}

				@if (preview(); as p) {
					<div class="details">
						<h3>{{ p.guest_name || 'Your stay' }}</h3>
						<div class="row">
							<span>Confirmation</span><span>{{ p.confirmation_number || code }}</span>
						</div>
						@if (p.room_number) {
							<div class="row"><span>Room</span><span>{{ p.room_number }}</span></div>
						}
						@if (p.check_out_date) {
							<div class="row"><span>Departure</span><span>{{ p.check_out_date }}</span></div>
						}

						@if (p.charges?.length) {
							<h4>Charges</h4>
							@for (charge of p.charges; track $index) {
								<div class="row charge">
									<span>{{ charge.description || 'Charge' }}</span>
									<span>{{ money(charge.amount) }}</span>
								</div>
							}
						}

						<div class="row total">
							<span>Balance due</span>
							<span>{{ money(p.balance) }} {{ p.currency || '' }}</span>
						</div>

						@if (!done()) {
							@if (hasBalance()) {
								<!-- Settlement is a front-desk matter; the portal does not take payment. -->
								<p class="warn">
									There is a balance outstanding. Please settle it at reception — this screen
									cannot take payment.
								</p>
							}
							<button
								mat-flat-button
								color="primary"
								class="confirm"
								(click)="confirm()"
								[disabled]="submitting()"
							>
								@if (submitting()) {
									<mat-spinner diameter="20" />
								} @else {
									Confirm check-out
								}
							</button>
						}
					</div>
				}

				@if (done()) {
					<div class="details">
						<h3>Checked out</h3>
						<p>{{ doneMessage() }}</p>
						@if (keys().length > 0) {
							<p class="muted">Your room keys have been released.</p>
						}
					</div>
				}
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 520px; margin: 2rem auto; }
		.checkout-card { padding: 1rem; }
		.search-row { display: flex; gap: 1rem; align-items: center; padding-top: 1rem; }
		.code-field { flex: 1; }
		.warn { color: var(--fgColor-attention); margin-top: 1rem; }
		.muted { color: var(--fgColor-muted); }
		.details { border-top: 1px solid var(--borderColor-default); margin-top: 1.5rem; padding-top: 1rem; }
		.details h3 { margin: 0 0 0.75rem; }
		.details h4 { margin: 1rem 0 0.25rem; font-size: var(--base-text-size-sm); color: var(--fgColor-muted); }
		.row {
			display: flex; justify-content: space-between; padding: 0.4rem 0;
			border-bottom: 1px solid var(--borderColor-muted);
		}
		.row span:first-child { color: var(--fgColor-muted); }
		.row.charge span:first-child { color: var(--fgColor-default); }
		.row.total {
			border-bottom: none; margin-top: 0.5rem; padding-top: 0.75rem;
			border-top: 2px solid var(--borderColor-default); font-weight: 600;
		}
		.confirm { margin-top: 1.25rem; width: 100%; }
	`,
})
export class CheckoutPage {
	private readonly api = inject(GuestApiService);

	code = "";
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly error = signal<string | null>(null);
	readonly preview = signal<CheckoutPreview | null>(null);
	readonly keys = signal<MobileKey[]>([]);
	readonly done = signal(false);
	readonly doneMessage = signal("Thank you for staying with us.");

	readonly hasBalance = computed(() => {
		const balance = this.preview()?.balance;
		return this.toNumber(balance) > 0;
	});

	private toNumber(value: number | string | undefined): number {
		if (value === undefined || value === null) return 0;
		const parsed = typeof value === "number" ? value : Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	money(value: number | string | undefined): string {
		return this.toNumber(value).toFixed(2);
	}

	async loadPreview(): Promise<void> {
		const confirmationCode = this.code.trim();
		if (!confirmationCode || this.loading()) return;
		this.loading.set(true);
		this.error.set(null);
		this.preview.set(null);
		try {
			const result = await this.api.previewCheckout({
				tenant_id: portalConfig.tenantId,
				confirmation_code: confirmationCode,
			});
			this.preview.set(result);
			// Keys are shown only to say they were released on checkout; a failure here
			// must not block the bill.
			if (result?.reservation_id) {
				try {
					this.keys.set(await this.api.getKeys(result.reservation_id, portalConfig.tenantId));
				} catch {
					this.keys.set([]);
				}
			}
		} catch (e) {
			this.error.set(
				e instanceof Error ? e.message : "We could not find a stay for that confirmation code.",
			);
		} finally {
			this.loading.set(false);
		}
	}

	async confirm(): Promise<void> {
		const confirmationCode = this.code.trim();
		if (!confirmationCode || this.submitting()) return;
		this.submitting.set(true);
		this.error.set(null);
		try {
			const result = await this.api.completeCheckout({
				tenant_id: portalConfig.tenantId,
				confirmation_code: confirmationCode,
				express: true,
			});
			this.done.set(true);
			if (result?.message) this.doneMessage.set(result.message);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Check-out could not be completed.");
		} finally {
			this.submitting.set(false);
		}
	}
}
