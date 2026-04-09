import { Injectable, inject, signal } from "@angular/core";

import type { FolioListItem, RoutingRuleListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { ToastService } from "../../shared/toast/toast.service";

@Injectable()
export class BillingRoutingService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly routingRules = signal<RoutingRuleListItem[]>([]);
	readonly routingTemplates = signal<RoutingRuleListItem[]>([]);
	readonly routingLoading = signal(false);
	readonly routingError = signal<string | null>(null);
	readonly showCreateRoutingRuleForm = signal(false);
	readonly creatingRoutingRule = signal(false);
	readonly editingRoutingRuleId = signal<string | null>(null);
	readonly editingRoutingRule = signal(false);
	readonly deletingRoutingRuleId = signal<string | null>(null);
	readonly deletingRoutingRule = signal(false);
	readonly cloningTemplateId = signal<string | null>(null);
	readonly cloningTemplate = signal(false);
	readonly routingTypeOptions = ["FULL", "PERCENTAGE", "FIXED_AMOUNT", "REMAINDER"] as const;
	readonly routingChargeCategoryOptions = [
		"ACCOMMODATION",
		"FOOD_BEVERAGE",
		"SERVICES",
		"TAXES_FEES",
		"INCIDENTALS",
	] as const;
	readonly routingDestinationTypeOptions = [
		"GUEST",
		"MASTER",
		"CITY_LEDGER",
		"INCIDENTAL",
		"HOUSE_ACCOUNT",
	] as const;
	readonly createRoutingRuleForm = signal({
		rule_name: "",
		description: "",
		is_template: false,
		source_folio_id: "",
		destination_folio_id: "",
		destination_folio_type: "GUEST",
		charge_code_pattern: "",
		charge_category: "",
		routing_type: "FULL",
		routing_percentage: 100,
		routing_fixed_amount: 0,
		priority: 100,
		stop_on_match: true,
	});
	readonly editRoutingRuleForm = signal({
		rule_name: "",
		description: "",
		destination_folio_id: "",
		destination_folio_type: "GUEST",
		charge_code_pattern: "",
		charge_category: "",
		routing_type: "FULL",
		routing_percentage: 100,
		routing_fixed_amount: 0,
		priority: 100,
		stop_on_match: true,
		is_active: true,
	});
	readonly cloneTemplateForm = signal({
		source_folio_id: "",
		destination_folio_id: "",
		priority: 100,
	});

	async loadRoutingRules(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.routingLoading.set(true);
		this.routingError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const [rules, templates] = await Promise.all([
				this.api.get<RoutingRuleListItem[]>("/billing/routing-rules", {
					...params,
					is_active: "true",
				}),
				this.api.get<RoutingRuleListItem[]>("/billing/routing-rules/templates", params),
			]);
			this.routingRules.set(rules ?? []);
			this.routingTemplates.set(templates ?? []);
		} catch (e) {
			this.routingError.set(e instanceof Error ? e.message : "Failed to load routing rules");
			this.routingRules.set([]);
			this.routingTemplates.set([]);
		} finally {
			this.routingLoading.set(false);
		}
	}

	toggleCreateRoutingRuleForm(): void {
		this.showCreateRoutingRuleForm.set(!this.showCreateRoutingRuleForm());
		this.editingRoutingRuleId.set(null);
	}

	updateCreateRoutingRuleForm(
		partial: Partial<typeof this.createRoutingRuleForm extends () => infer T ? T : never>,
	): void {
		this.createRoutingRuleForm.set({ ...this.createRoutingRuleForm(), ...partial });
	}

	async createRoutingRule(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.createRoutingRuleForm();
		if (!tenantId || !propertyId || !form.rule_name.trim()) return;
		if (!form.is_template && (!form.source_folio_id || !form.destination_folio_id)) {
			this.toast.error("Active routing rules require source and destination folios.");
			return;
		}
		this.creatingRoutingRule.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.routing_rule.create`, {
				property_id: propertyId,
				rule_name: form.rule_name.trim(),
				description: form.description || undefined,
				is_template: form.is_template,
				source_folio_id: form.is_template ? undefined : form.source_folio_id,
				destination_folio_id: form.destination_folio_id || undefined,
				destination_folio_type: form.destination_folio_type || undefined,
				charge_code_pattern: form.charge_code_pattern || undefined,
				charge_category: form.charge_category || undefined,
				routing_type: form.routing_type,
				routing_percentage:
					form.routing_type === "PERCENTAGE" ? form.routing_percentage : undefined,
				routing_fixed_amount:
					form.routing_type === "FIXED_AMOUNT" ? form.routing_fixed_amount : undefined,
				priority: form.priority,
				stop_on_match: form.stop_on_match,
			});
			this.toast.success("Routing rule submitted.");
			this.showCreateRoutingRuleForm.set(false);
			this.createRoutingRuleForm.set({
				rule_name: "",
				description: "",
				is_template: false,
				source_folio_id: "",
				destination_folio_id: "",
				destination_folio_type: "GUEST",
				charge_code_pattern: "",
				charge_category: "",
				routing_type: "FULL",
				routing_percentage: 100,
				routing_fixed_amount: 0,
				priority: 100,
				stop_on_match: true,
			});
			await this.loadRoutingRules();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create routing rule");
		} finally {
			this.creatingRoutingRule.set(false);
		}
	}

	startEditRoutingRule(rule: RoutingRuleListItem): void {
		this.editingRoutingRuleId.set(rule.rule_id);
		this.showCreateRoutingRuleForm.set(false);
		this.editRoutingRuleForm.set({
			rule_name: rule.rule_name,
			description: rule.description ?? "",
			destination_folio_id: rule.destination_folio_id ?? "",
			destination_folio_type: rule.destination_folio_type ?? "GUEST",
			charge_code_pattern: rule.charge_code_pattern ?? "",
			charge_category: rule.charge_category ?? "",
			routing_type: rule.routing_type,
			routing_percentage: rule.routing_percentage ?? 100,
			routing_fixed_amount: rule.routing_fixed_amount ?? 0,
			priority: rule.priority,
			stop_on_match: rule.stop_on_match,
			is_active: rule.is_active,
		});
	}

	cancelEditRoutingRule(): void {
		this.editingRoutingRuleId.set(null);
	}

	updateEditRoutingRuleForm(
		partial: Partial<typeof this.editRoutingRuleForm extends () => infer T ? T : never>,
	): void {
		this.editRoutingRuleForm.set({ ...this.editRoutingRuleForm(), ...partial });
	}

	async saveRoutingRule(rule: RoutingRuleListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.editRoutingRuleForm();
		if (!tenantId || !propertyId) return;
		this.editingRoutingRule.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.routing_rule.update`, {
				rule_id: rule.rule_id,
				property_id: propertyId,
				rule_name: form.rule_name || undefined,
				description: form.description || undefined,
				destination_folio_id: form.destination_folio_id || undefined,
				destination_folio_type: form.destination_folio_type || undefined,
				charge_code_pattern: form.charge_code_pattern || undefined,
				charge_category: form.charge_category || undefined,
				routing_type: form.routing_type || undefined,
				routing_percentage:
					form.routing_type === "PERCENTAGE" ? form.routing_percentage : undefined,
				routing_fixed_amount:
					form.routing_type === "FIXED_AMOUNT" ? form.routing_fixed_amount : undefined,
				priority: form.priority,
				stop_on_match: form.stop_on_match,
				is_active: form.is_active,
			});
			this.toast.success("Routing rule updated.");
			this.editingRoutingRuleId.set(null);
			await this.loadRoutingRules();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update routing rule");
		} finally {
			this.editingRoutingRule.set(false);
		}
	}

	showDeleteRoutingRule(ruleId: string): void {
		this.deletingRoutingRuleId.set(ruleId);
	}

	cancelDeleteRoutingRule(): void {
		this.deletingRoutingRuleId.set(null);
	}

	async deleteRoutingRule(rule: RoutingRuleListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.deletingRoutingRule.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.routing_rule.delete`, {
				rule_id: rule.rule_id,
				property_id: propertyId,
			});
			this.toast.success("Routing rule deleted.");
			this.deletingRoutingRuleId.set(null);
			await this.loadRoutingRules();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to delete routing rule");
		} finally {
			this.deletingRoutingRule.set(false);
		}
	}

	showCloneTemplate(templateId: string): void {
		this.cloningTemplateId.set(templateId);
		this.cloneTemplateForm.set({
			source_folio_id: "",
			destination_folio_id: "",
			priority: 100,
		});
	}

	cancelCloneTemplate(): void {
		this.cloningTemplateId.set(null);
	}

	async cloneTemplate(template: RoutingRuleListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.cloneTemplateForm();
		if (!tenantId || !propertyId || !form.source_folio_id || !form.destination_folio_id) {
			return;
		}
		this.cloningTemplate.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.routing_rule.clone_template`, {
				template_id: template.rule_id,
				property_id: propertyId,
				source_folio_id: form.source_folio_id,
				destination_folio_id: form.destination_folio_id,
				priority: form.priority || undefined,
			});
			this.toast.success("Routing rule cloned from template.");
			this.cloningTemplateId.set(null);
			await this.loadRoutingRules();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to clone template");
		} finally {
			this.cloningTemplate.set(false);
		}
	}

	openCreateForFolio(folio: FolioListItem): void {
		this.showCreateRoutingRuleForm.set(true);
		this.createRoutingRuleForm.set({
			...this.createRoutingRuleForm(),
			is_template: false,
			source_folio_id: folio.id,
		});
	}
}
