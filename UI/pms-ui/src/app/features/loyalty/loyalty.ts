import { Component, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import type { LoyaltyPointTransactions, LoyaltyTierRules } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { map } from "rxjs";
import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { LocaleDatePipe } from "../../core/i18n/locale-date.pipe";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../shared/forms/submit-on-enter.directive";
import { UnsavedGuardDirective } from "../../shared/forms/unsaved-guard.directive";
import { ToastService } from "../../shared/toast/toast.service";

type TierRule = LoyaltyTierRules;
type LoyaltyTxn = LoyaltyPointTransactions;

type Tab = "tiers" | "transactions";

@Component({
	selector: "app-loyalty",
	standalone: true,
	imports: [
		FormsModule,
		IconComponent,
		LocaleDatePipe,
		PageHeaderComponent,
		ProgressSpinnerModule,
		SubmitOnEnterDirective,
		TooltipModule,
		TranslatePipe,
		UnsavedGuardDirective,
	],
	templateUrl: "./loyalty.html",
	styleUrl: "./loyalty.scss",
})
export class LoyaltyComponent {
	private readonly api = inject(ApiService);
	private readonly i18n = inject(I18nService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	private readonly route = inject(ActivatedRoute);

	/** The open tab comes from the URL — the sub-sidebar link is what selects it. */
	readonly activeTab = toSignal(
		this.route.paramMap.pipe(
			map((p) => (p.get("tab") === "transactions" ? "transactions" : "tiers") as Tab),
		),
		{ initialValue: "tiers" as Tab },
	);
	readonly tiers = signal<TierRule[]>([]);
	readonly txns = signal<LoyaltyTxn[]>([]);
	readonly loadingTiers = signal(false);
	readonly loadingTxns = signal(false);
	readonly programIdInput = signal("");
	readonly txnTypeFilter = signal<string>("");

	/* ── Write actions ──────────────────────────────────────────────────────
	 * The screen was read-only: the backend has enroll/earn/redeem commands but
	 * nothing in the UI could reach them, so a member could never be enrolled or
	 * have points moved without calling the API directly. */
	readonly action = signal<"enroll" | "earn" | "redeem" | null>(null);
	readonly submitting = signal(false);
	readonly form = signal({
		guest_id: "",
		program_id: "",
		program_name: "Tartware Rewards",
		program_tier: "",
		points: null as number | null,
		description: "",
	});

	/** Points moves need an existing program; enrolment creates one. */
	readonly canSubmit = computed(() => {
		const f = this.form();
		if (!f.guest_id.trim()) return false;
		if (this.action() === "enroll") return f.program_name.trim().length > 0;
		return f.program_id.trim().length > 0 && f.points != null && f.points > 0;
	});

	openAction(kind: "enroll" | "earn" | "redeem"): void {
		this.form.set({
			guest_id: "",
			// Prefill from whatever the operator is already looking at.
			program_id: kind === "enroll" ? "" : this.programIdInput(),
			program_name: "Tartware Rewards",
			program_tier: "",
			points: null,
			description: "",
		});
		this.action.set(kind);
	}

	cancelAction(): void {
		this.action.set(null);
	}

	async submitAction(): Promise<void> {
		const kind = this.action();
		const tenantId = this.auth.tenantId();
		if (!kind || !tenantId || !this.canSubmit() || this.submitting()) return;

		const f = this.form();
		this.submitting.set(true);
		try {
			if (kind === "enroll") {
				// The command accepts a caller-supplied program_id because enrolment
				// is async and nothing lists a guest's programs afterwards — minting
				// it here is the only way the operator can address it later.
				const programId = crypto.randomUUID();
				await this.api.post(`/tenants/${tenantId}/commands/loyalty.program.enroll`, {
					guest_id: f.guest_id.trim(),
					program_id: programId,
					program_name: f.program_name.trim(),
					...(f.program_tier.trim() ? { program_tier: f.program_tier.trim() } : {}),
				});
				this.programIdInput.set(programId);
				this.toast.success(
					this.i18n.t("Enrolled. Program id {p0} — kept for the ledger lookup.", { p0: programId }),
				);
			} else {
				await this.api.post(`/tenants/${tenantId}/commands/loyalty.points.${kind}`, {
					guest_id: f.guest_id.trim(),
					program_id: f.program_id.trim(),
					points: f.points,
					reference_type: kind === "earn" ? "stay" : "reward",
					...(f.description.trim() ? { description: f.description.trim() } : {}),
				});
				this.toast.success(
					this.i18n.t("{p0} points {p1}.", {
						p0: f.points,
						p1: kind === "earn" ? "credited" : "redeemed",
					}),
				);
			}
			this.action.set(null);
			// Commands are async (Kafka); give the projection a moment before reloading.
			setTimeout(() => this.loadTransactions(), 1200);
		} catch (e) {
			this.toast.error(
				e instanceof Error
					? e.message
					: kind === "enroll"
						? this.i18n.t("Loyalty enrolment failed")
						: kind === "earn"
							? this.i18n.t("Loyalty points accrual failed")
							: this.i18n.t("Loyalty redemption failed"),
			);
		} finally {
			this.submitting.set(false);
		}
	}

	readonly tiersSorted = computed(() =>
		[...this.tiers()].sort((a, b) => a.tier_rank - b.tier_rank),
	);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.loadTiers();
		});
	}

	async loadTiers(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loadingTiers.set(true);
		try {
			const rows = await this.api.get<TierRule[]>("/loyalty/tier-rules", {
				tenant_id: tenantId,
			});
			this.tiers.set(Array.isArray(rows) ? rows : []);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to load tier rules"));
		} finally {
			this.loadingTiers.set(false);
		}
	}

	async loadTransactions(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const programId = this.programIdInput().trim();
		if (!tenantId || !programId) {
			this.toast.error(this.i18n.t("Enter a program ID to load transactions."));
			return;
		}
		this.loadingTxns.set(true);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				program_id: programId,
			};
			const t = this.txnTypeFilter().trim();
			if (t) params["transaction_type"] = t;
			const rows = await this.api.get<LoyaltyTxn[]>("/loyalty/transactions", params);
			this.txns.set(Array.isArray(rows) ? rows : []);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Failed to load transactions"));
		} finally {
			this.loadingTxns.set(false);
		}
	}
}
