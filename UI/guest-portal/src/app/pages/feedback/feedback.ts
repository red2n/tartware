import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { portalConfig } from "../../portal-config";
import { GuestApiService } from "../../services/guest-api.service";

/**
 * Post-stay feedback.
 *
 * Until this shipped, feedback was staff-entered or OTA-imported only — a guest
 * had no way to tell the property anything directly, so the inbox only ever saw
 * complaints that reached someone by phone. See ui-gaps/09-guest-feedback.md.
 *
 * The confirmation code is the credential. The portal is unauthenticated, so the
 * server derives guest, property and stay from the reservation the code resolves
 * to rather than trusting anything sent from here.
 */
@Component({
	selector: "gp-feedback",
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
		<mat-card class="feedback-card">
			<mat-card-header>
				<mat-icon matCardAvatar>rate_review</mat-icon>
				<mat-card-title>How was your stay?</mat-card-title>
			</mat-card-header>

			<mat-card-content>
				@if (done()) {
					<div class="thanks">
						<mat-icon class="thanks-icon">check_circle</mat-icon>
						<h3>Thank you</h3>
						<p class="muted">
							Your feedback has reached the property team. If it needs a reply, they will be in
							touch.
						</p>
					</div>
				} @else {
					<mat-form-field appearance="outline" class="full">
						<mat-label>Confirmation Code</mat-label>
						<input matInput [(ngModel)]="code" placeholder="e.g. ABC123" />
					</mat-form-field>

					<h4>Overall</h4>
					<div class="stars" role="radiogroup" aria-label="Overall rating">
						@for (star of starValues; track star) {
							<button
								type="button"
								class="star"
								role="radio"
								[attr.aria-checked]="overall() === star"
								[attr.aria-label]="star + ' out of 5'"
								(click)="overall.set(star)"
							>
								<mat-icon>{{ overall() >= star ? 'star' : 'star_border' }}</mat-icon>
							</button>
						}
					</div>

					<h4>Anything specific?</h4>
					<div class="sub-ratings">
						@for (category of categories; track category.key) {
							<div class="sub-row">
								<span>{{ category.label }}</span>
								<div class="stars small">
									@for (star of starValues; track star) {
										<button
											type="button"
											class="star"
											[attr.aria-label]="category.label + ': ' + star + ' out of 5'"
											(click)="setSub(category.key, star)"
										>
											<mat-icon>{{ sub()[category.key] >= star ? 'star' : 'star_border' }}</mat-icon>
										</button>
									}
								</div>
							</div>
						}
					</div>

					<mat-form-field appearance="outline" class="full">
						<mat-label>Title (optional)</mat-label>
						<input matInput [(ngModel)]="title" placeholder="Sum it up in a few words" />
					</mat-form-field>

					<mat-form-field appearance="outline" class="full">
						<mat-label>Your feedback</mat-label>
						<textarea
							matInput
							rows="5"
							[(ngModel)]="text"
							placeholder="What went well, and what could we have done better?"
						></textarea>
					</mat-form-field>

					<div class="intent">
						<button
							type="button"
							mat-stroked-button
							[color]="recommend() === true ? 'primary' : undefined"
							(click)="recommend.set(recommend() === true ? null : true)"
						>
							<mat-icon>thumb_up</mat-icon> Would recommend
						</button>
						<button
							type="button"
							mat-stroked-button
							[color]="stayAgain() === true ? 'primary' : undefined"
							(click)="stayAgain.set(stayAgain() === true ? null : true)"
						>
							<mat-icon>event_repeat</mat-icon> Would stay again
						</button>
					</div>

					@if (error()) {
						<p class="error">{{ error() }}</p>
					}

					<button
						mat-flat-button
						color="primary"
						class="submit"
						[disabled]="!canSubmit() || sending()"
						(click)="submit()"
					>
						@if (sending()) {
							<mat-spinner diameter="20" />
						} @else {
							Send feedback
						}
					</button>
				}
			</mat-card-content>
		</mat-card>
	`,
	styles: `
		:host { display: block; max-width: 520px; margin: 2rem auto; }
		.feedback-card { padding: 1rem; }
		.full { width: 100%; margin-top: 1rem; }
		h4 { margin: 1.25rem 0 0.25rem; font-size: var(--base-text-size-sm); color: var(--fgColor-muted); }
		.muted { color: var(--fgColor-muted); }
		.stars { display: flex; gap: 0.25rem; }
		.star {
			background: none; border: none; cursor: pointer; padding: 0.1rem;
			color: var(--fgColor-attention); line-height: 0;
		}
		.stars.small .star mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; }
		.sub-ratings { display: flex; flex-direction: column; gap: 0.35rem; }
		.sub-row {
			display: flex; justify-content: space-between; align-items: center;
			padding: 0.2rem 0; color: var(--fgColor-muted);
		}
		.intent { display: flex; gap: 0.75rem; margin-top: 1.25rem; flex-wrap: wrap; }
		.submit { width: 100%; margin-top: 1.5rem; }
		.error { color: var(--fgColor-danger); margin-top: 1rem; }
		.thanks { text-align: center; padding: 1.5rem 0; }
		.thanks-icon { color: var(--fgColor-success); font-size: 3rem; width: 3rem; height: 3rem; }
		.thanks h3 { margin: 0.75rem 0 0.25rem; }
	`,
})
export class FeedbackPage {
	private readonly api = new GuestApiService();

	readonly starValues = [1, 2, 3, 4, 5];
	readonly categories = [
		{ key: "cleanliness", label: "Cleanliness" },
		{ key: "staff", label: "Staff" },
		{ key: "location", label: "Location" },
		{ key: "value", label: "Value" },
	] as const;

	code = "";
	title = "";
	text = "";

	readonly overall = signal(0);
	readonly sub = signal<Record<string, number>>({
		cleanliness: 0,
		staff: 0,
		location: 0,
		value: 0,
	});
	/** Null means "not asked", which is different from a "no" — so it is not sent. */
	readonly recommend = signal<boolean | null>(null);
	readonly stayAgain = signal<boolean | null>(null);

	readonly sending = signal(false);
	readonly done = signal(false);
	readonly error = signal<string | null>(null);

	readonly canSubmit = computed(() => this.code.trim().length > 0 && this.text.trim().length > 0);

	setSub(key: string, value: number): void {
		this.sub.set({ ...this.sub(), [key]: value });
	}

	async submit(): Promise<void> {
		if (!this.canSubmit() || this.sending()) return;
		this.sending.set(true);
		this.error.set(null);
		const ratings = this.sub();
		try {
			await this.api.submitFeedback({
				tenant_id: portalConfig.tenantId,
				confirmation_code: this.code.trim(),
				review_text: this.text.trim(),
				...(this.title.trim() ? { review_title: this.title.trim() } : {}),
				// A zero star means the guest did not rate that category, so it is
				// omitted rather than sent as a genuine score of nought.
				...(this.overall() > 0 ? { overall_rating: this.overall() } : {}),
				...(ratings["cleanliness"] ? { cleanliness_rating: ratings["cleanliness"] } : {}),
				...(ratings["staff"] ? { staff_rating: ratings["staff"] } : {}),
				...(ratings["location"] ? { location_rating: ratings["location"] } : {}),
				...(ratings["value"] ? { value_rating: ratings["value"] } : {}),
				...(this.recommend() !== null ? { would_recommend: this.recommend() as boolean } : {}),
				...(this.stayAgain() !== null ? { would_return: this.stayAgain() as boolean } : {}),
			});
			this.done.set(true);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Could not send your feedback.");
		} finally {
			this.sending.set(false);
		}
	}
}
