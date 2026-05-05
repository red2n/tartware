import { DatePipe } from "@angular/common";
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

type TierRule = {
	rule_id: string;
	tier_name: string;
	tier_rank: number;
	display_name?: string;
	min_nights?: number | null;
	min_stays?: number | null;
	min_points?: number | null;
	min_spend?: number | null;
	qualification_period_months?: number | null;
	points_per_dollar?: number | null;
	bonus_multiplier?: number | null;
	points_expiry_months?: number | null;
	welcome_bonus_points?: number | null;
	is_active?: boolean;
};

type LoyaltyTxn = {
	transaction_id: string;
	program_id: string;
	guest_id?: string;
	transaction_type: string;
	points: number;
	balance_after?: number | null;
	currency_value?: number | null;
	reference_type?: string | null;
	reference_id?: string | null;
	description?: string | null;
	expires_at?: string | null;
	created_at: string;
};

type Tab = "tiers" | "transactions";

@Component({
	selector: "app-loyalty",
	standalone: true,
	imports: [
		DatePipe,
		FormsModule,
		IconComponent,
		ProgressSpinnerModule,
		TooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./loyalty.html",
	styleUrl: "./loyalty.scss",
})
export class LoyaltyComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	readonly activeTab = signal<Tab>("tiers");
	readonly tiers = signal<TierRule[]>([]);
	readonly txns = signal<LoyaltyTxn[]>([]);
	readonly loadingTiers = signal(false);
	readonly loadingTxns = signal(false);
	readonly programIdInput = signal("");
	readonly txnTypeFilter = signal<string>("");

	readonly tiersSorted = computed(() =>
		[...this.tiers()].sort((a, b) => a.tier_rank - b.tier_rank),
	);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.loadTiers();
		});
	}

	setTab(tab: Tab): void {
		this.activeTab.set(tab);
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
			this.toast.error(e instanceof Error ? e.message : "Failed to load tier rules");
		} finally {
			this.loadingTiers.set(false);
		}
	}

	async loadTransactions(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const programId = this.programIdInput().trim();
		if (!tenantId || !programId) {
			this.toast.error("Enter a program ID to load transactions.");
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
			this.toast.error(e instanceof Error ? e.message : "Failed to load transactions");
		} finally {
			this.loadingTxns.set(false);
		}
	}
}
