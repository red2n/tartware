import { Injectable, inject, signal } from "@angular/core";

import type { ChargePostingListItem, FolioListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { settleCommandReadModel } from "../../shared/command-refresh";
import { ToastService } from "../../shared/toast/toast.service";

import { BillingDataService } from "./billing-data.service";

@Injectable()
export class BillingFoliosService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	private readonly data = inject(BillingDataService);

	readonly billedToTypeOptions = ["GUEST", "CORPORATE", "TRAVEL_AGENT", "OTHER"] as const;
	readonly taxExemptionTypeOptions = [
		"DIPLOMATIC",
		"GOVERNMENT",
		"NON_PROFIT",
		"RESALE",
		"EDUCATIONAL",
		"OTHER",
	] as const;
	readonly compTypeOptions = ["ROOM", "FOOD_BEVERAGE", "SPA", "ACTIVITY", "MISCELLANEOUS"] as const;

	readonly showCreateFolioForm = signal(false);
	readonly createFolioForm = signal({
		folio_type: "HOUSE_ACCOUNT",
		folio_name: "",
		notes: "",
	});
	readonly creatingFolio = signal(false);
	readonly selectedFolioId = this.data.selectedFolioId;
	readonly folioCharges = this.data.folioCharges;
	readonly folioChargesLoading = this.data.folioChargesLoading;
	readonly showPostChargeForm = signal(false);
	readonly postChargeForm = signal({
		folio_id: "",
		charge_code: "MISC",
		amount: 0,
		quantity: 1,
		description: "",
		department_code: "",
	});
	readonly postingCharge = signal(false);
	readonly openFolios = this.data.openFolios;
	readonly voidingChargeId = signal<string | null>(null);
	readonly voidChargeReason = signal("");
	readonly processingChargeVoid = signal(false);
	readonly closingFolioId = signal<string | null>(null);
	readonly closeFolioReason = signal("");
	readonly closeFolioForce = signal(false);
	readonly processingFolioClose = signal(false);
	readonly reopeningFolioId = signal<string | null>(null);
	readonly reopenFolioReason = signal("");
	readonly processingFolioReopen = signal(false);
	readonly mergingFolioId = signal<string | null>(null);
	readonly mergeFolioForm = signal({
		target_folio_id: "",
		reason: "",
	});
	readonly processingFolioMerge = signal(false);
	readonly creatingWindowFolioId = signal<string | null>(null);
	readonly folioWindowForm = signal({
		window_start: "",
		window_end: "",
		billed_to: "",
		billed_to_type: "GUEST",
		notes: "",
	});
	readonly processingFolioWindow = signal(false);
	readonly taxExemptionFolioId = signal<string | null>(null);
	readonly taxExemptionForm = signal({
		exemption_type: "OTHER",
		exemption_certificate: "",
		exemption_reason: "",
		expiry_date: "",
	});
	readonly processingTaxExemption = signal(false);
	readonly compPostingFolioId = signal<string | null>(null);
	readonly compPostingForm = signal({
		comp_type: "MISCELLANEOUS",
		amount: 0,
		charge_code: "",
		description: "",
	});
	readonly processingCompPosting = signal(false);
	readonly splittingChargeId = signal<string | null>(null);
	readonly splitChargeForm = signal({
		target_folio_id: "",
		amount: 0,
		reason: "",
	});
	readonly processingChargeSplit = signal(false);

	toggleCreateFolioForm(): void {
		this.showCreateFolioForm.set(!this.showCreateFolioForm());
	}

	updateCreateFolioForm(
		partial: Partial<{ folio_type: string; folio_name: string; notes: string }>,
	): void {
		this.createFolioForm.set({ ...this.createFolioForm(), ...partial });
	}

	async createFolio(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.creatingFolio.set(true);
		try {
			const form = this.createFolioForm();
			await this.api.post(`/tenants/${tenantId}/billing/folios`, {
				property_id: propertyId,
				folio_type: form.folio_type,
				folio_name: form.folio_name || undefined,
				notes: form.notes || undefined,
			});
			this.toast.success("Folio create submitted. Refreshing folios...");
			this.showCreateFolioForm.set(false);
			this.createFolioForm.set({
				folio_type: "HOUSE_ACCOUNT",
				folio_name: "",
				notes: "",
			});
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create folio");
		} finally {
			this.creatingFolio.set(false);
		}
	}

	togglePostChargeForm(): void {
		this.showPostChargeForm.set(!this.showPostChargeForm());
	}

	updatePostChargeForm(
		partial: Partial<{
			folio_id: string;
			charge_code: string;
			amount: number;
			quantity: number;
			description: string;
			department_code: string;
		}>,
	): void {
		this.postChargeForm.set({ ...this.postChargeForm(), ...partial });
	}

	async postCharge(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		const form = this.postChargeForm();
		if (!form.folio_id || form.amount <= 0) return;
		this.postingCharge.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges`, {
				property_id: propertyId,
				folio_id: form.folio_id,
				charge_code: form.charge_code || "MISC",
				amount: form.amount,
				quantity: form.quantity || 1,
				description: form.description || undefined,
				department_code: form.department_code || undefined,
			});
			this.toast.success("Charge post submitted. Refreshing folios...");
			this.showPostChargeForm.set(false);
			this.postChargeForm.set({
				folio_id: "",
				charge_code: "MISC",
				amount: 0,
				quantity: 1,
				description: "",
				department_code: "",
			});
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to post charge");
		} finally {
			this.postingCharge.set(false);
		}
	}

	showVoidCharge(postingId: string): void {
		this.voidingChargeId.set(postingId);
		this.voidChargeReason.set("");
	}

	cancelVoidCharge(): void {
		this.voidingChargeId.set(null);
	}

	async voidCharge(charge: ChargePostingListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingChargeVoid.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges/${charge.id}/void`, {
				posting_id: charge.id,
				void_reason: this.voidChargeReason() || undefined,
			});
			this.toast.success("Charge void submitted. Refreshing folios...");
			this.voidingChargeId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to void charge");
		} finally {
			this.processingChargeVoid.set(false);
		}
	}

	showCloseFolio(folioId: string): void {
		this.closingFolioId.set(folioId);
		this.closeFolioReason.set("");
		this.closeFolioForce.set(false);
	}

	cancelCloseFolio(): void {
		this.closingFolioId.set(null);
	}

	async closeFolio(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.processingFolioClose.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/close`, {
				property_id: propertyId,
				folio_id: folio.id,
				close_reason: this.closeFolioReason() || undefined,
				force: this.closeFolioForce(),
			});
			this.toast.success("Folio close submitted. Refreshing folios...");
			this.closingFolioId.set(null);
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to close folio");
		} finally {
			this.processingFolioClose.set(false);
		}
	}

	showReopenFolio(folioId: string): void {
		this.reopeningFolioId.set(folioId);
		this.reopenFolioReason.set("");
	}

	cancelReopenFolio(): void {
		this.reopeningFolioId.set(null);
	}

	async reopenFolio(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId || !this.reopenFolioReason().trim()) return;
		this.processingFolioReopen.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/${folio.id}/reopen`, {
				property_id: propertyId,
				reason: this.reopenFolioReason().trim(),
			});
			this.toast.success("Folio reopen submitted. Refreshing folios...");
			this.reopeningFolioId.set(null);
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to reopen folio");
		} finally {
			this.processingFolioReopen.set(false);
		}
	}

	showMergeFolio(folioId: string): void {
		this.mergingFolioId.set(folioId);
		this.mergeFolioForm.set({ target_folio_id: "", reason: "" });
	}

	cancelMergeFolio(): void {
		this.mergingFolioId.set(null);
	}

	async mergeFolio(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.mergeFolioForm();
		if (!tenantId || !propertyId || !form.target_folio_id || !form.reason.trim()) return;
		this.processingFolioMerge.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/merge`, {
				property_id: propertyId,
				source_folio_id: folio.id,
				target_folio_id: form.target_folio_id,
				reason: form.reason.trim(),
			});
			this.toast.success("Folio merge submitted. Refreshing folios...");
			this.mergingFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to merge folios");
		} finally {
			this.processingFolioMerge.set(false);
		}
	}

	showCreateWindow(folioId: string): void {
		this.creatingWindowFolioId.set(folioId);
		this.folioWindowForm.set({
			window_start: "",
			window_end: "",
			billed_to: "",
			billed_to_type: "GUEST",
			notes: "",
		});
	}

	cancelCreateWindow(): void {
		this.creatingWindowFolioId.set(null);
	}

	async createFolioWindow(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.folioWindowForm();
		if (
			!tenantId ||
			!propertyId ||
			!folio.reservation_id ||
			!form.window_start ||
			!form.window_end ||
			!form.billed_to.trim()
		) {
			return;
		}
		this.processingFolioWindow.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/${folio.id}/windows`, {
				property_id: propertyId,
				reservation_id: folio.reservation_id,
				window_start: form.window_start,
				window_end: form.window_end,
				billed_to: form.billed_to.trim(),
				billed_to_type: form.billed_to_type,
				notes: form.notes || undefined,
			});
			this.toast.success("Folio window submitted. Refreshing folios...");
			this.creatingWindowFolioId.set(null);
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create folio window");
		} finally {
			this.processingFolioWindow.set(false);
		}
	}

	showTaxExemption(folioId: string): void {
		this.taxExemptionFolioId.set(folioId);
		this.taxExemptionForm.set({
			exemption_type: "OTHER",
			exemption_certificate: "",
			exemption_reason: "",
			expiry_date: "",
		});
	}

	cancelTaxExemption(): void {
		this.taxExemptionFolioId.set(null);
	}

	async applyTaxExemption(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.taxExemptionForm();
		if (!tenantId || !propertyId || !form.exemption_certificate.trim()) return;
		this.processingTaxExemption.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/${folio.id}/tax-exemption`, {
				property_id: propertyId,
				exemption_type: form.exemption_type,
				exemption_certificate: form.exemption_certificate.trim(),
				exemption_reason: form.exemption_reason || undefined,
				expiry_date: form.expiry_date || undefined,
			});
			this.toast.success("Tax exemption submitted. Refreshing folios...");
			this.taxExemptionFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to apply tax exemption");
		} finally {
			this.processingTaxExemption.set(false);
		}
	}

	showCompPosting(folioId: string): void {
		this.compPostingFolioId.set(folioId);
		this.compPostingForm.set({
			comp_type: "MISCELLANEOUS",
			amount: 0,
			charge_code: "",
			description: "",
		});
	}

	cancelCompPosting(): void {
		this.compPostingFolioId.set(null);
	}

	async postCompCharge(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const form = this.compPostingForm();
		if (!tenantId || !propertyId || form.amount <= 0) return;
		this.processingCompPosting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges/comp`, {
				property_id: propertyId,
				folio_id: folio.id,
				comp_type: form.comp_type,
				amount: form.amount,
				charge_code: form.charge_code || undefined,
				description: form.description || undefined,
				authorized_by: this.auth.user()?.id,
			});
			this.toast.success("Comp posting submitted. Refreshing folios...");
			this.compPostingFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to post comp charge");
		} finally {
			this.processingCompPosting.set(false);
		}
	}

	showSplitCharge(charge: ChargePostingListItem): void {
		this.splittingChargeId.set(charge.id);
		this.splitChargeForm.set({
			target_folio_id: "",
			amount: 0,
			reason: "",
		});
	}

	cancelSplitCharge(): void {
		this.splittingChargeId.set(null);
	}

	async splitCharge(charge: ChargePostingListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const sourceFolioId = this.selectedFolioId();
		const form = this.splitChargeForm();
		if (!tenantId || !sourceFolioId || !form.target_folio_id) return;
		if (form.amount <= 0 || form.amount >= charge.total_amount) {
			this.toast.error("Split amount must be less than the original charge amount.");
			return;
		}
		this.processingChargeSplit.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/${sourceFolioId}/split`, {
				posting_id: charge.id,
				reason: form.reason || undefined,
				splits: [
					{
						folio_id: sourceFolioId,
						amount: Number((charge.total_amount - form.amount).toFixed(2)),
					},
					{ folio_id: form.target_folio_id, amount: Number(form.amount.toFixed(2)) },
				],
			});
			this.toast.success("Charge split submitted. Refreshing folios...");
			this.splittingChargeId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
			this.selectedFolioId.set(null);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to split charge");
		} finally {
			this.processingChargeSplit.set(false);
		}
	}

	async selectFolio(folio: FolioListItem): Promise<void> {
		await this.data.selectFolio(folio);
	}
}
