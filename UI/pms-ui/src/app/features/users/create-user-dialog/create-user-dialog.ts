import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { TenantRole } from "@tartware/schemas";
import { DynamicDialogConfig, DynamicDialogModule, DynamicDialogRef } from "primeng/dynamicdialog";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { ToastService } from "../../../shared/toast/toast.service";
import { TENANT_ROLES } from "../../../shared/user-roles";

type DialogData = {
	tenantId: string;
};

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
@Component({
	selector: "app-create-user-dialog",
	standalone: true,
	imports: [FormsModule, DynamicDialogModule, IconComponent, ProgressSpinnerModule, TranslatePipe],
	templateUrl: "./create-user-dialog.html",
	styleUrl: "./create-user-dialog.scss",
})
export class CreateUserDialogComponent {
	private readonly api = inject(ApiService);
	private readonly dialogRef = inject(DynamicDialogRef);
	private readonly data: DialogData = inject(DynamicDialogConfig).data;
	private readonly toast = inject(ToastService);

	readonly saving = signal(false);
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
				this.toast.error(e.message);
			} else if (e instanceof Error) {
				if (e.message.includes("USER_ALREADY_EXISTS")) {
					this.toast.error("A user with this username or email already exists.");
				} else if (e.message.includes("USER_ALREADY_ASSOCIATED")) {
					this.toast.error("This user is already associated with your organization.");
				} else {
					this.toast.error(e.message);
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
