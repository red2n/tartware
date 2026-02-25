import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
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

	readonly properties = this.ctx.properties;
	readonly loading = this.ctx.loading;
	readonly tenantName = computed(() => this.auth.activeMembership()?.tenant_name ?? "");

	readonly search = signal("");

	readonly filtered = computed(() => {
		const term = this.search().toLowerCase().trim();
		const all = this.properties();
		if (!term) return all;
		return all.filter(
			(p) =>
				p.property_name.toLowerCase().includes(term) ||
				p.property_code.toLowerCase().includes(term),
		);
	});

	select(property: PropertyOption): void {
		this.ctx.selectProperty(property.id);
		this.router.navigate(["/dashboard"]);
	}

	logout(): void {
		this.auth.logout();
		this.router.navigate(["/login"]);
	}
}
