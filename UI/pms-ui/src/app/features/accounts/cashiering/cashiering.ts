import { Component } from "@angular/core";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";

@Component({
	selector: "app-cashiering",
	standalone: true,
	imports: [PageHeaderComponent, TranslatePipe],
	template: `
		<app-page-header title="Cashiering" description="Cashier sessions, shift management, and float reconciliation" />
		<div class="empty-state">
			<span class="empty-icon">💰</span>
			<p>{{ 'Cashiering module coming soon' | translate }}</p>
		</div>
	`,
	styles: `
		:host { display: block; }
		.page-header { margin-bottom: var(--space-6); }
		.page-header h1 { font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--color-fg-default); margin: 0 0 var(--space-1); }
		.page-description { font-size: var(--font-size-sm); color: var(--color-fg-muted); margin: 0; }
		.empty-state { text-align: center; padding: var(--space-12) var(--space-6); color: var(--color-fg-muted); }
		.empty-icon { font-size: 48px; display: block; margin-bottom: var(--space-4); }
	`,
})
export class CashieringComponent {}
