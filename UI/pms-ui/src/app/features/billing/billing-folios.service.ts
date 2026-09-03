import { Injectable, inject, signal } from "@angular/core";

import type { ChargePostingListItem, FolioListItem, StepUpGrantResponse } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { settleCommandReadModel } from "../../shared/command-refresh";
import { ToastService } from "../../shared/toast/toast.service";
import { BillingDataService } from "./billing-data.service";

@Injectable()
export class BillingFoliosService {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
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
	readonly transferringChargeId = signal<string | null>(null);
	readonly transferChargeForm = signal({
		target_folio_id: "",
		reason: "",
	});
	readonly processingChargeTransfer = signal(false);
	readonly closingFolioId = signal<string | null>(null);
	readonly closeFolioReason = signal("");
	readonly closeFolioForce = signal(false);
	/**
	 * A FOLIO_CLOSE_OVERRIDE code, mandatory whenever the close is forced.
	 *
	 * Forcing this closes a folio carrying a balance the property is not
	 * collecting — the same control `folio_settlement_check` refuses a departure
	 * over, reached from the side. It used to be a bare checkbox on a STAFF-tier
	 * command, so the screen could ask for a balance to be abandoned and record
	 * nothing but `force: true` inside an audit blob.
	 */
	readonly closeFolioReasonCode = signal("");
	/** What the picked code demands, when this operator does not hold it. */
	readonly closeFolioAuthorityShortfall = signal<string | null>(null);
	/** A supervisor's authorisation for this one close, when one was given. */
	readonly closeFolioStepUp = signal<StepUpGrantResponse | null>(null);
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
			this.toast.success(this.i18n.t("Folio create submitted. Refreshing folios..."));
			this.showCreateFolioForm.set(false);
			this.createFolioForm.set({
				folio_type: "HOUSE_ACCOUNT",
				folio_name: "",
				notes: "",
			});
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to create folio"));
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
			this.toast.success(this.i18n.t("Charge post submitted. Refreshing folios..."));
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
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to post charge"));
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
			this.toast.success(this.i18n.t("Charge void submitted. Refreshing folios..."));
			this.voidingChargeId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to void charge"));
		} finally {
			this.processingChargeVoid.set(false);
		}
	}

	showTransferCharge(postingId: string): void {
		this.transferringChargeId.set(postingId);
		this.transferChargeForm.set({ target_folio_id: "", reason: "" });
	}

	cancelTransferCharge(): void {
		this.transferringChargeId.set(null);
	}

	updateTransferChargeForm(partial: Partial<{ target_folio_id: string; reason: string }>): void {
		this.transferChargeForm.set({ ...this.transferChargeForm(), ...partial });
	}

	async transferCharge(charge: ChargePostingListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		const form = this.transferChargeForm();
		if (!form.target_folio_id) {
			this.toast.error(this.i18n.t("Select a destination folio."));
			return;
		}
		if (form.target_folio_id === charge.folio_id) {
			this.toast.error(this.i18n.t("Destination folio must differ from the source folio."));
			return;
		}
		this.processingChargeTransfer.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges/${charge.id}/transfer`, {
				posting_id: charge.id,
				to_folio_id: form.target_folio_id,
				reason: form.reason || undefined,
			});
			this.toast.success(this.i18n.t("Charge transfer submitted. Refreshing folios..."));
			this.transferringChargeId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to transfer charge"));
		} finally {
			this.processingChargeTransfer.set(false);
		}
	}

	showCloseFolio(folioId: string): void {
		this.closingFolioId.set(folioId);
		this.closeFolioReason.set("");
		this.closeFolioForce.set(false);
		this.resetCloseFolioAuthority();
	}

	cancelCloseFolio(): void {
		this.closingFolioId.set(null);
		this.resetCloseFolioAuthority();
	}

	/**
	 * What the picked code would cost, straight from the picker.
	 *
	 * A grant is bound to the command and the folio, not to a reason code — but
	 * an operator who picks a different code after being authorised may no longer
	 * need, or hold, the authority they were given. Making them ask again is the
	 * honest reading.
	 */
	onCloseFolioAuthorityShortfall(needed: string | null): void {
		this.closeFolioAuthorityShortfall.set(needed);
		if (needed === null) this.closeFolioStepUp.set(null);
	}

	private resetCloseFolioAuthority(): void {
		this.closeFolioReasonCode.set("");
		this.closeFolioAuthorityShortfall.set(null);
		this.closeFolioStepUp.set(null);
	}

	async closeFolio(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.processingFolioClose.set(true);
		try {
			await this.api.post(
				`/tenants/${tenantId}/billing/folios/close`,
				{
					property_id: propertyId,
					folio_id: folio.id,
					close_reason: this.closeFolioReason() || undefined,
					force: this.closeFolioForce(),
					// Only on a forced close: the payload refuses one without a
					// code, and demands none on an ordinary settle.
					...(this.closeFolioForce() ? { reason_code: this.closeFolioReasonCode() } : {}),
				},
				// Carried as a header, not in the payload. Absent unless a
				// supervisor authorised this one close at the terminal.
				{ stepUpGrantId: this.closeFolioStepUp()?.grant_id },
			);
			this.toast.success(this.i18n.t("Folio close submitted. Refreshing folios..."));
			this.closingFolioId.set(null);
			this.resetCloseFolioAuthority();
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to close folio"));
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
			this.toast.success(this.i18n.t("Folio reopen submitted. Refreshing folios..."));
			this.reopeningFolioId.set(null);
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to reopen folio"));
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
			this.toast.success(this.i18n.t("Folio merge submitted. Refreshing folios..."));
			this.mergingFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to merge folios"));
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
			this.toast.success(this.i18n.t("Folio window submitted. Refreshing folios..."));
			this.creatingWindowFolioId.set(null);
			await settleCommandReadModel(() => this.data.loadFolios());
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to create folio window"),
			);
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
			this.toast.success(this.i18n.t("Tax exemption submitted. Refreshing folios..."));
			this.taxExemptionFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(
				e instanceof Error ? e.message : this.i18n.t("Failed to apply tax exemption"),
			);
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
			this.toast.success(this.i18n.t("Comp posting submitted. Refreshing folios..."));
			this.compPostingFolioId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadFolios(), this.data.loadCharges()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to post comp charge"));
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
			this.toast.error(this.i18n.t("Split amount must be less than the original charge amount."));
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
			this.toast.success(this.i18n.t("Charge split submitted. Refreshing folios..."));
			this.splittingChargeId.set(null);
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadCharges(), this.data.loadFolios()]),
			);
			this.selectedFolioId.set(null);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to split charge"));
		} finally {
			this.processingChargeSplit.set(false);
		}
	}

	async selectFolio(folio: FolioListItem): Promise<void> {
		await this.data.selectFolio(folio);
	}
}
