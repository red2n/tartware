import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { ChargebackListItem } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { ToastService } from "../../../shared/toast/toast.service";

type StatusFilter = "ALL" | "RECEIVED" | "EVIDENCE_SUBMITTED" | "WON" | "LOST";

type AdvanceTarget = "EVIDENCE_SUBMITTED" | "WON" | "LOST";

@Component({
	selector: "app-chargebacks",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./chargebacks.html",
	styleUrl: "./chargebacks.scss",
})
export class ChargebacksComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly chargebacks = signal<ChargebackListItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly statusFilter = signal<StatusFilter>("ALL");
	readonly startDate = signal("");
	readonly endDate = signal("");

	readonly advancingId = signal<string | null>(null);
	readonly advanceTarget = signal<AdvanceTarget>("EVIDENCE_SUBMITTED");
	readonly advanceNotes = signal("");
	readonly processingAdvance = signal(false);

	readonly filtered = computed(() => {
		const status = this.statusFilter();
		const items = this.chargebacks();
		if (status === "ALL") return items;
		return items.filter((c) => c.chargeback_status === status);
	});

	readonly totals = computed(() => {
		const items = this.chargebacks();
		const open = items.filter(
			(c) => c.chargeback_status === "RECEIVED" || c.chargeback_status === "EVIDENCE_SUBMITTED",
		);
		const openAmount = open.reduce((sum, c) => sum + (c.chargeback_amount ?? 0), 0);
		const lostAmount = items
			.filter((c) => c.chargeback_status === "LOST")
			.reduce((sum, c) => sum + (c.chargeback_amount ?? 0), 0);
		const wonCount = items.filter((c) => c.chargeback_status === "WON").length;
		return {
			openCount: open.length,
			openAmount,
			lostAmount,
			wonCount,
			currency: items[0]?.currency_code ?? "USD",
		};
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			void this.loadChargebacks();
		});
	}

	async loadChargebacks(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dataReady.set(false);
		this.error.set(null);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "200",
			};
			if (this.statusFilter() !== "ALL") {
				params["chargeback_status"] = this.statusFilter();
			}
			if (this.startDate()) params["start_date"] = this.startDate();
			if (this.endDate()) params["end_date"] = this.endDate();
			const res = await this.api.get<{ data: ChargebackListItem[] }>(
				"/billing/chargebacks",
				params,
			);
			this.chargebacks.set(res.data ?? []);
		} catch (e) {
			this.chargebacks.set([]);
			this.error.set(
				e instanceof Error ? e.message : "Chargeback list endpoint is not currently available.",
			);
		} finally {
			this.dataReady.set(true);
		}
	}

	setStatusFilter(f: StatusFilter): void {
		this.statusFilter.set(f);
		void this.loadChargebacks();
	}

	resetFilters(): void {
		this.statusFilter.set("ALL");
		this.startDate.set("");
		this.endDate.set("");
		void this.loadChargebacks();
	}

	allowedTargets(current: string): AdvanceTarget[] {
		switch (current) {
			case "RECEIVED":
				return ["EVIDENCE_SUBMITTED"];
			case "EVIDENCE_SUBMITTED":
				return ["WON", "LOST"];
			default:
				return [];
		}
	}

	canAdvance(c: ChargebackListItem): boolean {
		return this.allowedTargets(c.chargeback_status).length > 0;
	}

	showAdvance(c: ChargebackListItem): void {
		this.advancingId.set(c.refund_id);
		this.advanceTarget.set(this.allowedTargets(c.chargeback_status)[0] ?? "EVIDENCE_SUBMITTED");
		this.advanceNotes.set("");
	}

	cancelAdvance(): void {
		this.advancingId.set(null);
		this.advanceNotes.set("");
	}

	async advanceChargeback(c: ChargebackListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		const target = this.advanceTarget();
		if (!this.allowedTargets(c.chargeback_status).includes(target)) {
			this.toast.error(`Cannot transition ${c.chargeback_status} → ${target}`);
			return;
		}
		this.processingAdvance.set(true);
		try {
			await this.api.post<unknown>(
				`/tenants/${tenantId}/billing/chargebacks/${c.refund_id}/status`,
				{
					refund_id: c.refund_id,
					chargeback_status: target,
					notes: this.advanceNotes() || undefined,
				},
			);
			this.toast.success(`Chargeback advanced to ${target}.`);
			this.cancelAdvance();
			await settleCommandReadModel(() => this.loadChargebacks());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update chargeback status");
		} finally {
			this.processingAdvance.set(false);
		}
	}

	statusBadge(status: string): string {
		switch (status) {
			case "RECEIVED":
				return "badge badge-warning";
			case "EVIDENCE_SUBMITTED":
				return "badge badge-accent";
			case "WON":
				return "badge badge-success";
			case "LOST":
				return "badge badge-danger";
			default:
				return "badge badge-muted";
		}
	}

	formatDate(d: string | undefined): string {
		return d ? this.settings.formatDate(d) : "—";
	}

	formatCurrency(amount: number | string, currency = "USD"): string {
		return this.settings.formatCurrency(Number(amount), currency);
	}
}
