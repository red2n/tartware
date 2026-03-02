import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import {
	type PropertyOption,
	TenantContextService,
} from "../../core/context/tenant-context.service";

@Component({
	selector: "app-select-property",
	standalone: true,
	imports: [
		FormsModule,
		MatButtonModule,
		MatDialogModule,
		MatIconModule,
		MatFormFieldModule,
		MatInputModule,
		MatProgressSpinnerModule,
	],
	templateUrl: "./select-property.html",
	styleUrl: "./select-property.scss",
})
export class SelectPropertyComponent {
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	private readonly dialog = inject(MatDialog);

	readonly properties = this.ctx.properties;
	readonly loading = this.ctx.loading;
	readonly tenantName = computed(() => this.auth.activeMembership()?.tenant_name ?? "");

	readonly search = signal("");
	readonly expandedId = signal<string | null>(null);

	/** True when the logged-in user has ADMIN or OWNER role */
	readonly canCreateProperty = computed(() => {
		const role = this.auth.activeMembership()?.role;
		return role === "OWNER" || role === "ADMIN";
	});

	readonly filtered = computed(() => {
		const term = this.search().toLowerCase().trim();
		const all = this.properties();
		if (!term) return all;
		return all.filter(
			(p) =>
				p.property_name.toLowerCase().includes(term) ||
				p.property_code.toLowerCase().includes(term) ||
				this.formatLocation(p.address).toLowerCase().includes(term),
		);
	});

	formatLocation(address: Record<string, unknown>): string {
		return [address["city"], address["state"], address["country"]]
			.filter((v) => !!v)
			.join(", ");
	}

	toggleExpand(property: PropertyOption): void {
		this.expandedId.update((current) => (current === property.id ? null : property.id));
	}

	continueWith(property: PropertyOption): void {
		this.ctx.selectProperty(property.id);
		this.router.navigate(["/dashboard"]);
	}

	openCreateDialog(): void {
		import("./create-property-dialog/create-property-dialog").then(
			({ CreatePropertyDialogComponent }) => {
				const ref = this.dialog.open(CreatePropertyDialogComponent, {
					width: "600px",
					disableClose: true,
				});
				ref.afterClosed().subscribe((created: boolean) => {
					if (created) {
						this.ctx.fetchProperties();
					}
				});
			},
		);
	}

	logout(): void {
		this.auth.logout();
		this.router.navigate(["/login"]);
	}
}
