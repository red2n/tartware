import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { TenantRole } from "@tartware/schemas";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { TENANT_ROLES } from "../../../shared/user-roles";
import { ToastService } from "../../../shared/toast/toast.service";

type DialogData = {
	tenantId: string;
};

@Component({
	selector: "app-create-user-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./create-user-dialog.html",
	styleUrl: "./create-user-dialog.scss",
})
export class CreateUserDialogComponent {
	private readonly api = inject(ApiService);
	private readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent>);
	private readonly data: DialogData = inject(MAT_DIALOG_DATA);
	private readonly toast = inject(ToastService);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly fieldErrors = signal<Record<string, string>>({});

	touched: Record<string, boolean> = {};

	readonly roles = TENANT_ROLES;

	// Form fields
	username = "";
	email = "";
	firstName = "";
	lastName = "";
	phone = "";
	role: TenantRole = "STAFF";

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	get usernameError(): string | null {
		const val = this.username.trim();
		if (!val) return "Username is required";
		if (val.length < 3) return "Username must be at least 3 characters";
		if (val.length > 50) return "Username must be at most 50 characters";
		return null;
	}

	get emailError(): string | null {
		const val = this.email.trim();
		if (!val) return "Email is required";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Enter a valid email address";
		return null;
	}

	get isValid(): boolean {
		return !!(
			this.username.trim() &&
			!this.usernameError &&
			this.email.trim() &&
			!this.emailError &&
			this.firstName.trim() &&
			this.lastName.trim() &&
			this.role
		);
	}

	hasFieldError(field: string): boolean {
		return !!this.fieldErrors()[field];
	}

	getFieldError(field: string): string {
		return this.fieldErrors()[field] ?? "";
	}

	async save(): Promise<void> {
		if (!this.isValid) return;

		this.saving.set(true);
		this.error.set(null);
		this.fieldErrors.set({});

		try {
			await this.api.post("/users", {
				tenant_id: this.data.tenantId,
				username: this.username.trim(),
				email: this.email.trim(),
				first_name: this.firstName.trim(),
				last_name: this.lastName.trim(),
				phone: this.phone.trim() || undefined,
				role: this.role,
			});
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				const errors: Record<string, string> = {};
				for (const fe of e.fieldErrors) {
					errors[fe.path] = fe.message;
				}
				this.fieldErrors.set(errors);
				this.error.set(e.message);
			} else if (e instanceof Error) {
				if (e.message.includes("USER_ALREADY_EXISTS")) {
					this.error.set("A user with this username or email already exists.");
				} else if (e.message.includes("USER_ALREADY_ASSOCIATED")) {
					this.error.set("This user is already associated with your organization.");
				} else {
					this.error.set(e.message);
				}
			} else {
				this.toast.error("Failed to create user");
				this.dialogRef.close(false);
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
