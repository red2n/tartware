import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";

type CatalogModule = {
	module_key: string;
	module_name: string;
	description?: string;
	category?: string;
	is_paid?: boolean;
};

type CatalogResponse =
	| { items?: CatalogModule[]; modules?: CatalogModule[] }
	| CatalogModule[];

type TenantModulesResponse =
	| { enabled_modules?: string[]; modules?: string[] }
	| string[];

@Component({
	selector: "app-modules",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./modules.html",
	styleUrl: "./modules.scss",
})
export class ModulesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	readonly catalog = signal<CatalogModule[]>([]);
	readonly enabled = signal<Set<string>>(new Set());
	readonly originalEnabled = signal<Set<string>>(new Set());
	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly search = signal("");

	readonly filtered = computed(() => {
		const q = this.search().toLowerCase().trim();
		const list = this.catalog();
		if (!q) return list;
		return list.filter(
			(m) =>
				m.module_key.toLowerCase().includes(q) ||
				m.module_name.toLowerCase().includes(q) ||
				(m.description ?? "").toLowerCase().includes(q),
		);
	});

	readonly hasChanges = computed(() => {
		const cur = this.enabled();
		const orig = this.originalEnabled();
		if (cur.size !== orig.size) return true;
		for (const v of cur) if (!orig.has(v)) return true;
		return false;
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const [catalogRes, tenantRes] = await Promise.all([
				this.api.get<CatalogResponse>("/modules/catalog"),
				this.api.get<TenantModulesResponse>(`/tenants/${tenantId}/modules`),
			]);
			const list = Array.isArray(catalogRes)
				? catalogRes
				: (catalogRes.items ?? catalogRes.modules ?? []);
			this.catalog.set(list);

			const enabledList = Array.isArray(tenantRes)
				? tenantRes
				: (tenantRes.enabled_modules ?? tenantRes.modules ?? []);
			const set = new Set(enabledList);
			this.enabled.set(set);
			this.originalEnabled.set(new Set(set));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load modules");
		} finally {
			this.loading.set(false);
		}
	}

	isEnabled(key: string): boolean {
		return this.enabled().has(key);
	}

	toggle(key: string, on: boolean): void {
		const next = new Set(this.enabled());
		if (on) next.add(key);
		else next.delete(key);
		this.enabled.set(next);
	}

	resetChanges(): void {
		this.enabled.set(new Set(this.originalEnabled()));
	}

	async save(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.saving.set(true);
		try {
			await this.api.put(`/tenants/${tenantId}/modules`, {
				enabled_modules: Array.from(this.enabled()),
			});
			this.toast.success("Tenant modules updated.");
			this.originalEnabled.set(new Set(this.enabled()));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update modules");
		} finally {
			this.saving.set(false);
		}
	}
}
