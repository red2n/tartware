import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { TenantRole, UserWithTenants } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { TENANT_ROLES } from "../../../shared/user-roles";
import { ToastService } from "../../../shared/toast/toast.service";

type UserRow = UserWithTenants & { version: string };

type DialogData = {
	tenantId: string;
	user: UserRow;
	currentRole: string;
};

const VALID_ROLES = new Set<string>(["VIEWER", "STAFF", "MANAGER", "ADMIN", "OWNER"]);

@Component({
	selector: "app-edit-user-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./edit-user-dialog.html",
	styleUrl: "./edit-user-dialog.scss",
})
export class EditUserDialogComponent {
	private readonly api = inject(ApiService);
	private readonly dialogRef = inject(MatDialogRef<EditUserDialogComponent>);
	private readonly toast = inject(ToastService);
	readonly data: DialogData = inject(MAT_DIALOG_DATA);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	readonly roles = TENANT_ROLES;

	selectedRole: TenantRole;
	isActive: boolean;

	constructor() {
		const role = this.data.currentRole;
		this.selectedRole = VALID_ROLES.has(role) ? (role as TenantRole) : "STAFF";
		this.isActive = this.data.user.is_active ?? true;
	}

	get fullName(): string {
		return `${this.data.user.first_name} ${this.data.user.last_name}`;
	}

	get hasChanges(): boolean {
		return (
			this.selectedRole !== this.data.currentRole || this.isActive !== this.data.user.is_active
		);
	}

	get roleChanged(): boolean {
		return this.selectedRole !== this.data.currentRole;
	}

	get statusChanged(): boolean {
		return this.isActive !== this.data.user.is_active;
	}

	async save(): Promise<void> {
		if (!this.hasChanges) return;

		this.saving.set(true);
		this.error.set(null);

		try {
			if (this.roleChanged) {
				await this.api.post("/user-tenant-associations/role", {
					tenant_id: this.data.tenantId,
					user_id: this.data.user.id,
					role: this.selectedRole,
				});
			}

			if (this.statusChanged) {
				await this.api.post("/user-tenant-associations/status", {
					tenant_id: this.data.tenantId,
					user_id: this.data.user.id,
					is_active: this.isActive,
				});
			}

			const changes: string[] = [];
			if (this.roleChanged) changes.push("role updated");
			if (this.statusChanged) changes.push(this.isActive ? "activated" : "deactivated");
			this.toast.success(`User ${changes.join(" and ")}`);
			this.dialogRef.close(true);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to update user");
		} finally {
			this.saving.set(false);
		}
	}

	async resetPassword(): Promise<void> {
		this.saving.set(true);
		this.error.set(null);

		try {
			await this.api.post("/users/reset-password", {
				tenant_id: this.data.tenantId,
				user_id: this.data.user.id,
			});
			this.toast.success("Password reset to default. User will need to change it on next login.");
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to reset password");
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
