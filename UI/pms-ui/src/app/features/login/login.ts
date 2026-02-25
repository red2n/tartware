import { Component, inject, signal, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { ThemeService } from "../../core/theme/theme.service";

@Component({
	selector: "app-login",
	standalone: true,
	imports: [
		FormsModule,
		MatButtonModule,
		MatCheckboxModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatProgressSpinnerModule,
	],
	templateUrl: "./login.html",
	styleUrl: "./login.scss",
})
export class LoginComponent implements AfterViewInit {
	private static readonly REMEMBER_KEY = "tartware_remember_username";

	private readonly auth = inject(AuthService);
	private readonly theme = inject(ThemeService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);

	@ViewChild("passwordInput") passwordInput!: ElementRef<HTMLInputElement>;

	username = "";
	password = "";
	rememberMe = false;
	hidePassword = signal(true);
	loading = signal(false);
	error = signal<string | null>(null);

	togglePasswordVisibility(): void {
		this.hidePassword.update((v) => !v);
	}

	constructor() {
		// Login screen always starts in light mode
		this.theme.setLoginDefault();

		// Restore saved username if "Remember me" was checked
		const saved = localStorage.getItem(LoginComponent.REMEMBER_KEY);
		if (saved) {
			this.username = saved;
			this.rememberMe = true;
		}
	}

	ngAfterViewInit(): void {
		// If username was restored, focus the password field for quick entry
		if (this.username && this.passwordInput) {
			setTimeout(() => this.passwordInput.nativeElement.focus());
		}
	}

	async onSubmit(): Promise<void> {
		if (!this.username || !this.password) {
			this.error.set("Username and password are required.");
			return;
		}

		this.loading.set(true);
		this.error.set(null);

		try {
			await this.auth.login(this.username, this.password);

			// Persist or clear username based on "Remember me"
			if (this.rememberMe) {
				localStorage.setItem(LoginComponent.REMEMBER_KEY, this.username);
			} else {
				localStorage.removeItem(LoginComponent.REMEMBER_KEY);
			}

			// Signal the browser to save credentials
			if ("PasswordCredential" in window) {
				const cred = new (window as any).PasswordCredential({
					id: this.username,
					password: this.password,
				});
				navigator.credentials.store(cred).catch(() => {});
			}
			// Load user theme preference after login
			await this.theme.loadPreferences();

			// Load properties and handle selection
			const properties = await this.ctx.fetchProperties();

			if (this.ctx.hasPropertySelected()) {
				// Returning user — saved property still valid, go straight in
				this.router.navigate(["/dashboard"]);
			} else if (properties.length <= 1) {
				// 0 or 1 property — auto-selected by service, no picker needed
				this.router.navigate(["/dashboard"]);
			} else {
				// Multiple properties, none saved — navigate to selection screen
				this.router.navigate(["/select-property"]);
			}
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Login failed. Please try again.");
		} finally {
			this.loading.set(false);
		}
	}
}
