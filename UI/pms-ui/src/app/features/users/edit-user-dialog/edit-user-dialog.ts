import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { TenantRole, UserWithTenants } from "@tartware/schemas";
import { DynamicDialogConfig, DynamicDialogModule, DynamicDialogRef } from "primeng/dynamicdialog";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { ApiService } from "../../../core/api/api.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { ToastService } from "../../../shared/toast/toast.service";
import { TENANT_ROLES } from "../../../shared/user-roles";

type UserRow = UserWithTenants & { version: string };

type DialogData = {
	tenantId: string;
	user: UserRow;
	currentRole: string;
};

const VALID_ROLES = new Set<string>(["VIEWER", "STAFF", "MANAGER", "ADMIN", "OWNER"]);

import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell";
@Component({
	selector: "app-edit-user-dialog",
	standalone: true,
	imports: [
		FormsModule,
		DynamicDialogModule,
		IconComponent,
		ProgressSpinnerModule,
		TranslatePipe,
		DialogShellComponent,
	],
	templateUrl: "./edit-user-dialog.html",
	styleUrl: "./edit-user-dialog.scss",
})
export class EditUserDialogComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly dialogRef = inject(DynamicDialogRef);
	private readonly toast = inject(ToastService);
	readonly data: DialogData = inject(DynamicDialogConfig).data;

	readonly saving = signal(false);

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
			this.toast.success(this.i18n.t("User {p0}", { p0: changes.join(" and ") }));
			this.dialogRef.close(true);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to update user"));
		} finally {
			this.saving.set(false);
		}
	}

	async resetPassword(): Promise<void> {
		this.saving.set(true);

		try {
			await this.api.post("/users/reset-password", {
				tenant_id: this.data.tenantId,
				user_id: this.data.user.id,
			});
			this.toast.success(
				this.i18n.t("Password reset to default. User will need to change it on next login."),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to reset password"));
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
