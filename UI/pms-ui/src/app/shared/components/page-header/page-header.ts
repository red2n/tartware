import { Component, input } from "@angular/core";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";

/**
 * Shared page header with translatable title and watermark-style tagline.
 *
 * Usage:
 * ```html
 * <app-page-header title="Rooms" description="Room inventory, status tracking, and assignments">
 *   <button class="btn btn-primary btn-sm" (click)="create()">New room</button>
 * </app-page-header>
 * ```
 *
 * Action buttons are projected via `<ng-content>` into the `.page-actions` slot.
 */
@Component({
	selector: "app-page-header",
	standalone: true,
	imports: [TranslatePipe],
	template: `
		<div class="page-header">
			<div class="page-header-text">
				<h1 class="page-title">{{ title() | translate }}</h1>
				@if (description(); as desc) {
					<p class="page-tagline">{{ desc | translate }}</p>
				}
			</div>
			<div class="page-actions">
				<ng-content />
			</div>
		</div>
	`,
})
export class PageHeaderComponent {
	readonly title = input.required<string>();
	readonly description = input("");
}
