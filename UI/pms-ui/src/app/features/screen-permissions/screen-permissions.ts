import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { TenantRole } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";

/** Shape returned by GET /v1/settings/screen-permissions */
type AllPermissionsResponse = {
	permissions: { role: string; screens: { screen_key: string; is_visible: boolean }[] }[];
};

/** Ordered roles displayed as columns (highest → lowest privilege). */
const ROLES: TenantRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"];

/** Human-readable labels for each screen key. */
const SCREEN_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	reservations: "Reservations",
	groups: "Group Bookings",
	guests: "Guests",
	rooms: "Rooms",
	"room-types": "Room Types",
	buildings: "Buildings",
	rates: "Rates",
	"rate-calendar": "Rate Calendar",
	packages: "Packages",
	housekeeping: "Housekeeping",
	billing: "Billing",
	"accounts-receivable": "Accounts Receivable",
	cashiering: "Cashiering",
	"night-audit": "Night Audit",
	"tax-config": "Tax Configuration",
	reports: "Reports",
	settings: "Settings",
	"command-management": "Command Management",
	users: "User Management",
};

const SCREEN_ICONS: Record<string, string> = {
	dashboard: "dashboard",
	reservations: "book_online",
	groups: "groups",
	guests: "people",
	rooms: "hotel",
	"room-types": "category",
	buildings: "apartment",
	rates: "sell",
	"rate-calendar": "calendar_month",
	packages: "card_giftcard",
	housekeeping: "cleaning_services",
	billing: "receipt_long",
	"accounts-receivable": "request_quote",
	cashiering: "point_of_sale",
	"night-audit": "nightlight",
	"tax-config": "gavel",
	reports: "assessment",
	settings: "settings",
	"command-management": "terminal",
	users: "admin_panel_settings",
};

/** Canonical screen order for display. */
const SCREEN_ORDER = Object.keys(SCREEN_LABELS);

type ScreenRow = {
	screen_key: string;
	label: string;
	icon: string;
	/** Current visibility per role. */
	visibility: Record<TenantRole, boolean>;
};

@Component({
	selector: "app-screen-permissions",
	standalone: true,
	imports: [
		MatButtonModule,
		MatIconModule,
		MatProgressSpinnerModule,
		MatSlideToggleModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./screen-permissions.html",
	styleUrl: "./screen-permissions.scss",
})
export class ScreenPermissionsComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly screenRows = signal<ScreenRow[]>([]);
	readonly roles = ROLES;

	/** Server snapshot — used to detect dirty state. */
	private serverSnapshot = "";

	readonly hasChanges = computed(() => {
		const current = JSON.stringify(this.screenRows().map((r) => ({ k: r.screen_key, v: r.visibility })));
		return current !== this.serverSnapshot;
	});

	readonly pendingCount = computed(() => {
		if (!this.serverSnapshot) return 0;
		const server: { k: string; v: Record<TenantRole, boolean> }[] = JSON.parse(this.serverSnapshot);
		const serverMap = new Map(server.map((s) => [s.k, s.v]));
		let count = 0;
		for (const row of this.screenRows()) {
			const sv = serverMap.get(row.screen_key);
			if (!sv) continue;
			for (const role of ROLES) {
				if (row.visibility[role] !== sv[role]) count++;
			}
		}
		return count;
	});

	ngOnInit(): void {
		this.loadPermissions();
	}

	async loadPermissions(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		try {
			const tenantId = this.auth.tenantId();
			const data = await this.api.get<AllPermissionsResponse>(
				`/settings/screen-permissions?tenant_id=${tenantId}`,
			);

			// Build a lookup: role → screen_key → is_visible
			const roleMap = new Map<string, Map<string, boolean>>();
			for (const rp of data.permissions) {
				const screenMap = new Map<string, boolean>();
				for (const s of rp.screens) {
					screenMap.set(s.screen_key, s.is_visible);
				}
				roleMap.set(rp.role, screenMap);
			}

			// Build rows in canonical order
			const rows: ScreenRow[] = SCREEN_ORDER.map((key) => {
				const visibility = {} as Record<TenantRole, boolean>;
				for (const role of ROLES) {
					visibility[role] = roleMap.get(role)?.get(key) ?? false;
				}
				return {
					screen_key: key,
					label: SCREEN_LABELS[key] ?? key,
					icon: SCREEN_ICONS[key] ?? "web",
					visibility,
				};
			});

			this.screenRows.set(rows);
			this.serverSnapshot = JSON.stringify(rows.map((r) => ({ k: r.screen_key, v: r.visibility })));
		} catch {
			this.error.set("Failed to load screen permissions");
		} finally {
			this.loading.set(false);
		}
	}

	toggle(screenKey: string, role: TenantRole): void {
		this.screenRows.update((rows) =>
			rows.map((row) => {
				if (row.screen_key !== screenKey) return row;
				return {
					...row,
					visibility: { ...row.visibility, [role]: !row.visibility[role] },
				};
			}),
		);
	}

	discardChanges(): void {
		this.loadPermissions();
	}

	async saveChanges(): Promise<void> {
		this.saving.set(true);
		this.error.set(null);

		try {
			// Determine which roles have changes
			const server: { k: string; v: Record<TenantRole, boolean> }[] = JSON.parse(this.serverSnapshot);
			const serverMap = new Map(server.map((s) => [s.k, s.v]));
			const changedRoles = new Set<TenantRole>();

			for (const row of this.screenRows()) {
				const sv = serverMap.get(row.screen_key);
				if (!sv) continue;
				for (const role of ROLES) {
					if (row.visibility[role] !== sv[role]) changedRoles.add(role);
				}
			}

			// Save each changed role
			const rows = this.screenRows();
			const tenantId = this.auth.tenantId();
			for (const role of changedRoles) {
				await this.api.put(`/settings/screen-permissions?tenant_id=${tenantId}`, {
					role,
					screens: rows.map((r) => ({
						screen_key: r.screen_key,
						is_visible: r.visibility[role],
					})),
				});
			}

			this.serverSnapshot = JSON.stringify(rows.map((r) => ({ k: r.screen_key, v: r.visibility })));
			this.toast.success(`Permissions saved for ${changedRoles.size} role(s)`);
		} catch {
			this.toast.error("Failed to save screen permissions");
		} finally {
			this.saving.set(false);
		}
	}

	/** Enable all screens for a role. */
	enableAll(role: TenantRole): void {
		this.screenRows.update((rows) =>
			rows.map((row) => ({
				...row,
				visibility: { ...row.visibility, [role]: true },
			})),
		);
	}

	/** Disable all screens for a role (except dashboard). */
	disableAll(role: TenantRole): void {
		this.screenRows.update((rows) =>
			rows.map((row) => ({
				...row,
				visibility: {
					...row.visibility,
					[role]: row.screen_key === "dashboard" ? true : false,
				},
			})),
		);
	}
}
