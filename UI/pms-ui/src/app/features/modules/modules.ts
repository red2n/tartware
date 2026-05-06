import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { ModuleDefinition, ModuleId, TenantModulesResponse } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";

type CatalogResponse =
	| { items?: ModuleDefinition[]; modules?: ModuleDefinition[] }
	| ModuleDefinition[];

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

	readonly catalog = signal<ModuleDefinition[]>([]);
	readonly enabled = signal<Set<ModuleId | string>>(new Set());
	readonly originalEnabled = signal<Set<ModuleId | string>>(new Set());
	readonly loading = signal(false);
	readonly saving = signal(false);
	readonly search = signal("");

	readonly filtered = computed(() => {
		const q = this.search().toLowerCase().trim();
		const list = this.catalog();
		if (!q) return list;
		return list.filter(
			(m) =>
				m.id.toLowerCase().includes(q) ||
				m.name.toLowerCase().includes(q) ||
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

			const enabledList = tenantRes.modules ?? [];
			const set = new Set<ModuleId | string>(enabledList);
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
				modules: Array.from(this.enabled()),
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
