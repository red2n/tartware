import { Component, computed, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

@Component({
	selector: "app-pagination",
	standalone: true,
	imports: [MatIconModule],
	template: `
		@if (totalPages() > 1) {
			<nav class="pagination" aria-label="Table pagination">
				<span class="pagination-info">
					{{ startItem() }}–{{ endItem() }} of {{ totalItems() }}
				</span>
				<div class="pagination-controls">
					<button type="button" class="btn btn-invisible btn-sm"
							[disabled]="currentPage() <= 1"
							(click)="pageChange.emit(1)"
							aria-label="First page">
						<mat-icon>first_page</mat-icon>
					</button>
					<button type="button" class="btn btn-invisible btn-sm"
							[disabled]="currentPage() <= 1"
							(click)="pageChange.emit(currentPage() - 1)"
							aria-label="Previous page">
						<mat-icon>chevron_left</mat-icon>
					</button>
					<span class="pagination-page">
						Page {{ currentPage() }} of {{ totalPages() }}
					</span>
					<button type="button" class="btn btn-invisible btn-sm"
							[disabled]="currentPage() >= totalPages()"
							(click)="pageChange.emit(currentPage() + 1)"
							aria-label="Next page">
						<mat-icon>chevron_right</mat-icon>
					</button>
					<button type="button" class="btn btn-invisible btn-sm"
							[disabled]="currentPage() >= totalPages()"
							(click)="pageChange.emit(totalPages())"
							aria-label="Last page">
						<mat-icon>last_page</mat-icon>
					</button>
				</div>
			</nav>
		}
	`,
	styles: [`
		.pagination {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-3) var(--space-4);
			font-size: var(--font-size-sm);
			color: var(--color-fg-muted);
			border: 1px solid var(--color-border-default);
			border-top: none;
			border-radius: 0 0 var(--radius-md) var(--radius-md);
			background: var(--color-canvas-default);
		}

		.pagination-controls {
			display: flex;
			align-items: center;
			gap: var(--space-1);
		}

		.pagination-page {
			padding: 0 var(--space-2);
			font-weight: var(--font-weight-medium);
			white-space: nowrap;
		}
	`],
})
export class PaginationComponent {
	readonly totalItems = input.required<number>();
	readonly currentPage = input.required<number>();
	readonly pageSize = input<number>(25);
	readonly pageChange = output<number>();

	readonly totalPages = computed(() =>
		Math.ceil(this.totalItems() / this.pageSize()),
	);

	readonly startItem = computed(() =>
		(this.currentPage() - 1) * this.pageSize() + 1,
	);

	readonly endItem = computed(() =>
		Math.min(this.currentPage() * this.pageSize(), this.totalItems()),
	);
}
