import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-admin-bootstrap",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		ProgressSpinnerModule,
		PageHeaderComponent,
	],
	templateUrl: "./bootstrap.html",
	styleUrl: "./bootstrap.scss",
})
export class AdminBootstrapComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);
	private readonly toast = inject(ToastService);

	readonly loading = signal(false);
	readonly step = signal(1);

	readonly form = signal({
		tenant: {
			name: "",
			slug: "",
			type: "INDEPENDENT",
			email: "",
			phone: "",
			website: "",
		},
		property: {
			property_name: "",
			property_code: "",
			property_type: "HOTEL",
			star_rating: 4,
			total_rooms: 100,
			phone: "",
			email: "",
			website: "",
			address: {
				line1: "",
				city: "",
				state: "",
				postal_code: "",
				country: "USA",
			},
			currency: "USD",
			timezone: "UTC",
			default_language: "en-US",
		},
		owner: {
			username: "",
			email: "",
			password: "",
			first_name: "",
			last_name: "",
			phone: "",
		},
	});

	nextStep(): void {
		this.step.update((s) => s + 1);
	}

	prevStep(): void {
		this.step.update((s) => s - 1);
	}

	async bootstrap(): Promise<void> {
		this.loading.set(true);
		try {
			const payload = this.form();
			// Ensure slug is clean
			if (payload.tenant.slug) {
				payload.tenant.slug = payload.tenant.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
			}

			await this.api.post("/system/tenants/bootstrap", payload);
			this.toast.success("Tenant bootstrapped successfully!");
			this.router.navigate(["/dashboard"]);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Bootstrap failed");
		} finally {
			this.loading.set(false);
		}
	}

	generateSlug(): void {
		const current = this.form();
		if (!current.tenant.slug && current.tenant.name) {
			const slug = current.tenant.name
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
			this.form.set({
				...current,
				tenant: { ...current.tenant, slug },
			});
		}
	}

	generatePropertyCode(): void {
		const current = this.form();
		if (!current.property.property_code && current.property.property_name) {
			const code = current.property.property_name
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, "")
				.substring(0, 8);
			this.form.set({
				...current,
				property: { ...current.property, property_code: code },
			});
		}
	}
}
