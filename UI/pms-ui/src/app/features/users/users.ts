import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { UserWithTenants } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";
import { ToastService } from "../../shared/toast/toast.service";

type UserRow = UserWithTenants & { version: string };

@Component({
	selector: "app-users",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		PaginationComponent,
		TranslatePipe,
	],
	templateUrl: "./users.html",
	styleUrl: "./users.scss",
})
export class UsersComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);

	readonly users = signal<UserRow[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<"all" | "active" | "inactive">("all");
	readonly sortState = createSortState();
	readonly currentPage = signal(1);
	readonly pageSize = 25;

	readonly roleFilters: { key: "all" | "active" | "inactive"; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "active", label: "Active" },
		{ key: "inactive", label: "Inactive" },
	];

	readonly filteredUsers = computed(() => {
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase().trim();
		let items = this.users();

		if (filter === "active") {
			items = items.filter((u) => u.is_active);
		} else if (filter === "inactive") {
			items = items.filter((u) => !u.is_active);
		}

		if (query) {
			items = items.filter(
				(u) =>
					u.username.toLowerCase().includes(query) ||
					u.email.toLowerCase().includes(query) ||
					u.first_name.toLowerCase().includes(query) ||
					u.last_name.toLowerCase().includes(query),
			);
		}

		return items;
	});

	readonly sortedUsers = computed(() => {
		const state = this.sortState();
		return sortBy(this.filteredUsers(), state.column, state.direction);
	});

	readonly paginatedUsers = computed(() => {
		const start = (this.currentPage() - 1) * this.pageSize;
		return this.sortedUsers().slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.users();
		return {
			all: all.length,
			active: all.filter((u) => u.is_active).length,
			inactive: all.filter((u) => !u.is_active).length,
		};
	});

	readonly canManageUsers = computed(() => {
		const membership = this.auth.activeMembership();
		if (!membership) return false;
		return membership.role === "OWNER" || membership.role === "ADMIN";
	});

	constructor() {
		effect(() => {
			const tid = this.auth.tenantId();
			if (tid) {
				this.loadUsers();
			}
		});
	}

	async loadUsers(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const data = await this.api.get<UserRow[]>(`/users?tenant_id=${tenantId}&limit=100`);
			this.users.set(data);
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to load users");
		} finally {
			this.loading.set(false);
		}
	}

	setFilter(filter: "all" | "active" | "inactive"): void {
		this.activeFilter.set(filter);
		this.currentPage.set(1);
	}

	onSearch(value: string): void {
		this.searchQuery.set(value);
		this.currentPage.set(1);
	}

	onSort(column: string): void {
		this.sortState.update((current) => toggleSort(current, column));
	}

	sortIcon(column: string): string {
		const state = this.sortState();
		if (state.column !== column) return "unfold_more";
		return state.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}

	initials(user: UserRow): string {
		const f = user.first_name?.[0] ?? "";
		const l = user.last_name?.[0] ?? "";
		return (f + l).toUpperCase() || "?";
	}

	roleBadgeClass(role: string): string {
		switch (role) {
			case "OWNER":
				return "badge-danger";
			case "ADMIN":
				return "badge-warning";
			case "MANAGER":
				return "badge-accent";
			case "STAFF":
				return "badge-success";
			case "VIEWER":
				return "badge-muted";
			default:
				return "";
		}
	}

	getUserRole(user: UserRow): string {
		const tenantId = this.auth.tenantId();
		const tenant = user.tenants?.find((t) => t.tenant_id === tenantId);
		return tenant?.role ?? "—";
	}

	formatDate(date: Date | string | undefined): string {
		if (!date) return "—";
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	async openCreateDialog(): Promise<void> {
		const { CreateUserDialogComponent } = await import("./create-user-dialog/create-user-dialog");
		const dialogRef = this.dialog.open(CreateUserDialogComponent, {
			width: "480px",
			data: { tenantId: this.auth.tenantId() },
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result) {
				this.toast.success("User created successfully");
				this.loadUsers();
			}
		});
	}

	async openEditDialog(user: UserRow): Promise<void> {
		const { EditUserDialogComponent } = await import("./edit-user-dialog/edit-user-dialog");
		const dialogRef = this.dialog.open(EditUserDialogComponent, {
			width: "480px",
			data: {
				tenantId: this.auth.tenantId(),
				user,
				currentRole: this.getUserRole(user),
			},
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result) {
				this.loadUsers();
			}
		});
	}
}
