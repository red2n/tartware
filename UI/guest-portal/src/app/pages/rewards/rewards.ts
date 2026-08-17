import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { portalConfig } from "../../portal-config";
import type { Redemption, Reward } from "../../services/guest-api.service";
import { GuestApiService } from "../../services/guest-api.service";

/**
 * Reward catalogue and redemption history.
 *
 * `/rewards`, `/rewards/redeem` and `/rewards/redemptions` existed with no client.
 * See ui-gaps/11-self-service-coverage.md.
 *
 * Redemption needs a `guest_id`, and the portal has no session — a guest arrives
 * with a confirmation code, not a login. So the catalogue is browsable by anyone
 * and redeeming asks for the code, which is the same trust model the rest of the
 * portal already uses. A real account system would replace this.
 */
@Component({
	selector: "gp-rewards",
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
		<mat-card class="rewards-card">
			<mat-card-header>
				<mat-icon matCardAvatar>redeem</mat-icon>
				<mat-card-title>Rewards</mat-card-title>
			</mat-card-header>

			<mat-card-content>
				@if (error(); as message) {
					<p class="warn">{{ message }}</p>
				}

				@if (loading()) {
					<div class="centre"><mat-spinner diameter="28" /></div>
				} @else if (rewards().length === 0) {
					<p class="muted">No rewards are available for this property yet.</p>
				} @else {
					@for (reward of rewards(); track reward.reward_id) {
						<div class="reward">
							<div class="reward-main">
								<strong>{{ reward.reward_name || reward.reward_code }}</strong>
								@if (reward.description) {
									<span class="muted">{{ reward.description }}</span>
								}
							</div>
							<div class="reward-side">
								<span class="points">{{ reward.points_required ?? 0 }} pts</span>
								<button
									mat-stroked-button
									color="primary"
									(click)="select(reward)"
									[disabled]="submitting()"
								>
									Redeem
								</button>
							</div>
						</div>
					}
				}

				@if (selected(); as reward) {
					<div class="details">
						<h4>Redeem {{ reward.reward_name || reward.reward_code }}</h4>
						<!-- No session: the confirmation code is what ties a redemption to a stay. -->
						<mat-form-field appearance="outline" class="full">
							<mat-label>Confirmation Code</mat-label>
							<input matInput [(ngModel)]="code" placeholder="e.g. ABC123" />
						</mat-form-field>
						<mat-form-field appearance="outline" class="full">
							<mat-label>Guest ID</mat-label>
							<input matInput [(ngModel)]="guestId" placeholder="Shown on your booking" />
						</mat-form-field>
						<div class="actions">
							<button mat-button (click)="selected.set(null)" [disabled]="submitting()">
								Cancel
							</button>
							<button
								mat-flat-button
								color="primary"
								(click)="redeem()"
								[disabled]="submitting() || !guestId.trim()"
							>
								@if (submitting()) {
									<mat-spinner diameter="20" />
								} @else {
									Confirm
								}
							</button>
						</div>
					</div>
				}

				@if (redemptions().length > 0) {
					<div class="details">
						<h4>Your redemptions</h4>
						@for (redemption of redemptions(); track redemption.redemption_id) {
							<div class="row">
								<span>{{ redemption.reward_name || redemption.redemption_code }}</span>
								<span class="status">{{ redemption.status }}</span>
							</div>
						}
					</div>
				}
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 560px; margin: 2rem auto; }
		.rewards-card { padding: 1rem; }
		.centre { display: flex; justify-content: center; padding: 2rem 0; }
		.warn { color: var(--fgColor-attention); margin-top: 1rem; }
		.muted { color: var(--fgColor-muted); }
		.full { width: 100%; }
		.reward {
			display: flex; justify-content: space-between; align-items: center; gap: 1rem;
			padding: 0.75rem 0; border-bottom: 1px solid var(--borderColor-muted);
		}
		.reward-main { display: flex; flex-direction: column; gap: 0.15rem; }
		.reward-side { display: flex; align-items: center; gap: 0.75rem; white-space: nowrap; }
		.points { font-weight: 600; color: var(--fgColor-accent); }
		.details { border-top: 1px solid var(--borderColor-default); margin-top: 1.5rem; padding-top: 1rem; }
		.details h4 { margin: 0 0 0.75rem; }
		.actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
		.row {
			display: flex; justify-content: space-between; padding: 0.4rem 0;
			border-bottom: 1px solid var(--borderColor-muted);
		}
		.status { text-transform: capitalize; color: var(--fgColor-accent); }
	`,
})
export class RewardsPage {
	private readonly api = new GuestApiService();

	code = "";
	guestId = "";
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly error = signal<string | null>(null);
	readonly rewards = signal<Reward[]>([]);
	readonly redemptions = signal<Redemption[]>([]);
	readonly selected = signal<Reward | null>(null);

	constructor() {
		void this.load();
	}

	async load(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		try {
			this.rewards.set(
				await this.api.getRewards({
					tenant_id: portalConfig.tenantId,
					property_id: portalConfig.propertyId,
				}),
			);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Rewards are unavailable right now.");
		} finally {
			this.loading.set(false);
		}
	}

	select(reward: Reward): void {
		this.selected.set(reward);
	}

	async redeem(): Promise<void> {
		const reward = this.selected();
		if (!reward?.reward_id || !this.guestId.trim() || this.submitting()) return;
		this.submitting.set(true);
		this.error.set(null);
		try {
			await this.api.redeemReward({
				tenant_id: portalConfig.tenantId,
				property_id: portalConfig.propertyId,
				guest_id: this.guestId.trim(),
				reward_id: reward.reward_id,
			});
			this.selected.set(null);
			await this.loadRedemptions();
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Redemption failed.");
		} finally {
			this.submitting.set(false);
		}
	}

	async loadRedemptions(): Promise<void> {
		if (!this.guestId.trim()) return;
		try {
			this.redemptions.set(
				await this.api.getRedemptions({
					tenant_id: portalConfig.tenantId,
					guest_id: this.guestId.trim(),
				}),
			);
		} catch {
			/* history is supplementary — a failure must not mask a successful redemption */
		}
	}
}
