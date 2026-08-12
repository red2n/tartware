import { DecimalPipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/** Row of GET /v1/billing/ar/accounts. */
type ArAccount = {
	ar_account_id: string;
	account_number: string;
	company_name: string;
	contact_name?: string;
	contact_email?: string;
	credit_limit: string | number;
	outstanding_balance: string | number;
	available_credit: string | number;
	payment_terms: string;
	currency: string;
	account_status: string;
	dunning_level?: number;
	created_at: string;
};

/** Row of GET /v1/billing/ar/aging-report. */
type AgingRow = {
	ar_account_id: string;
	company_name: string;
	account_number: string;
	current_amount: string | number;
	bucket_1_30: string | number;
	bucket_31_60: string | number;
	bucket_61_90: string | number;
	bucket_91_120: string | number;
	bucket_over_120: string | number;
	total_outstanding: string | number;
	currency: string;
};

/** Entry of GET /v1/billing/ar/accounts/:id/statement. */
type StatementEntry = {
	entry_id: string;
	entry_number: string;
	transfer_date: string;
	due_date: string;
	original_amount?: string | number;
	outstanding_balance?: string | number;
	entry_status?: string;
};

/**
 * Row of GET /v1/companies. The list returns `company_id` — not `id` — and
 * binding a picker to `id` silently produced empty option values, so no company
 * could be chosen even when some existed.
 */
type Company = { company_id: string; company_name: string; company_type?: string };

const PAYMENT_TERMS = ["NET30", "NET45", "NET60", "DUE_ON_RECEIPT"] as const;
const ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "COLLECTIONS"] as const;

/** Lowercase to match the `companies.company_type` CHECK constraint. */
const COMPANY_TYPES = [
	"corporate",
	"travel_agency",
	"wholesaler",
	"ota",
	"event_planner",
	"airline",
	"government",
	"educational",
	"consortium",
	"partner",
] as const;

/**
 * AR account management — the missing link for direct billing.
 *
 * `ar_accounts` had no way in: `ar.account.create` and `ar.account.update_terms`
 * are handled in billing-service and catalogued, but nothing dispatched them, so
 * the table was empty in every environment and city-ledger transfer at checkout
 * had no account to resolve. See ui-gaps/03-ar-account-management.md.
 *
 * Commands are dispatched directly (`/tenants/:id/commands/<name>`), the pattern
 * the billing and loyalty screens already use — no gateway wrapper needed.
 */
@Component({
	selector: "app-ar-accounts",
	standalone: true,
	imports: [DecimalPipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./ar-accounts.html",
	styleUrl: "./ar-accounts.scss",
})
export class ArAccountsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	/** Public: templates bind `settings.amountDigits()` so money columns follow
	 * the active property's ISO 4217 minor unit instead of a fixed 2 decimals. */
	readonly settings = inject(SettingsService);

	readonly paymentTerms = PAYMENT_TERMS;
	readonly accountStatuses = ACCOUNT_STATUSES;

	readonly accounts = signal<ArAccount[]>([]);
	readonly aging = signal<AgingRow[]>([]);
	readonly companies = signal<Company[]>([]);
	readonly loading = signal(false);
	readonly statusFilter = signal("");

	readonly dso = signal<number | null>(null);
	readonly dsoNote = signal<string>("");
	readonly collectionRate = signal<number | null>(null);
	readonly uncollected = signal<number>(0);

	readonly statementFor = signal<ArAccount | null>(null);
	readonly statement = signal<StatementEntry[]>([]);
	readonly loadingStatement = signal(false);

	readonly creating = signal(false);
	readonly editing = signal<ArAccount | null>(null);
	readonly submitting = signal(false);

	readonly createForm = signal({
		company_id: "",
		company_name: "",
		contact_name: "",
		contact_email: "",
		billing_address: "",
		credit_limit: null as number | null,
		payment_terms: "NET30" as string,
		currency: "USD",
		notes: "",
	});

	readonly termsForm = signal({
		credit_limit: null as number | null,
		payment_terms: "" as string,
		status: "" as string,
		notes: "",
	});

	/** Over the credit limit is the state a folio should stop routing against. */
	readonly overLimit = computed(() =>
		this.accounts().filter((account) => this.num(account.available_credit) < 0),
	);

	readonly totalOutstanding = computed(() =>
		this.accounts().reduce((sum, account) => sum + this.num(account.outstanding_balance), 0),
	);

	readonly canSubmitCreate = computed(() => {
		const f = this.createForm();
		return (
			f.company_id.trim().length > 0 && f.company_name.trim().length > 0 && f.credit_limit != null
		);
	});

	/** update_terms takes only what changed; an empty form would be a no-op command. */
	readonly canSubmitTerms = computed(() => {
		const f = this.termsForm();
		return f.credit_limit != null || f.payment_terms !== "" || f.status !== "";
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	num(value: string | number | undefined): number {
		if (value === undefined || value === null) return 0;
		return typeof value === "number" ? value : Number(value);
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string): string {
		switch (status?.toUpperCase()) {
			case "ACTIVE":
				return "badge badge-success badge-sm";
			case "SUSPENDED":
				return "badge badge-warning badge-sm";
			case "COLLECTIONS":
				return "badge badge-danger badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const status = this.statusFilter().trim();
			if (status) params["status"] = status;

			const res = await this.api.get<{ data: ArAccount[] }>("/billing/ar/accounts", params);
			this.accounts.set(res?.data ?? []);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load AR accounts");
		} finally {
			this.loading.set(false);
		}
		// KPIs and aging are property-scoped and independent; a failure in one must
		// not blank the account list, so they load separately and stay quiet.
		void this.loadKpis();
		void this.loadAging();
	}

	private async loadKpis(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		const params = { tenant_id: tenantId, property_id: propertyId };
		try {
			const dso = await this.api.get<{ dso: number | null; note?: string }>(
				"/billing/ar/dso",
				params,
			);
			this.dso.set(dso?.dso ?? null);
			this.dsoNote.set(dso?.note ?? "");
		} catch {
			/* KPI tile stays empty rather than blocking the screen */
		}
		try {
			const rate = await this.api.get<{ collection_rate_pct: number | null; uncollected: number }>(
				"/billing/ar/collection-rate",
				params,
			);
			this.collectionRate.set(rate?.collection_rate_pct ?? null);
			this.uncollected.set(rate?.uncollected ?? 0);
		} catch {
			/* as above */
		}
	}

	private async loadAging(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		try {
			const res = await this.api.get<{ data: AgingRow[] }>("/billing/ar/aging-report", {
				tenant_id: tenantId,
				property_id: propertyId,
			});
			this.aging.set(res?.data ?? []);
		} catch {
			/* aging snapshots are written by night audit; absent until it has run */
		}
	}

	async openStatement(account: ArAccount): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.statementFor.set(account);
		this.statement.set([]);
		this.loadingStatement.set(true);
		try {
			const res = await this.api.get<{ data: StatementEntry[] }>(
				`/billing/ar/accounts/${account.ar_account_id}/statement`,
				{ tenant_id: tenantId },
			);
			this.statement.set(res?.data ?? []);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load statement");
		} finally {
			this.loadingStatement.set(false);
		}
	}

	closeStatement(): void {
		this.statementFor.set(null);
	}

	async openCreate(): Promise<void> {
		this.createForm.set({
			company_id: "",
			company_name: "",
			contact_name: "",
			contact_email: "",
			billing_address: "",
			credit_limit: null,
			payment_terms: "NET30",
			currency: "USD",
			notes: "",
		});
		this.creating.set(true);
		await this.loadCompanies();
	}

	/**
	 * `ar.account.create` requires a `company_id`, and `/v1/companies` is read-only
	 * today — so an account can only be opened against a company that already
	 * exists. Company CRUD is COV-16.
	 */
	private async loadCompanies(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const res = await this.api.get<{ data: Company[] } | Company[]>("/companies", {
				tenant_id: tenantId,
				limit: "200",
			});
			this.companies.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch {
			this.companies.set([]);
		}
	}

	companyLabel(company: Company): string {
		return company.company_name || company.company_id;
	}

	onCompanyPicked(companyId: string): void {
		const company = this.companies().find((candidate) => candidate.company_id === companyId);
		this.createForm.set({
			...this.createForm(),
			company_id: companyId,
			// Keep the name in step with the picker; the command stores its own copy.
			company_name: company ? this.companyLabel(company) : this.createForm().company_name,
		});
	}

	cancelCreate(): void {
		this.creating.set(false);
		this.addingCompany.set(false);
	}

	/* ── Inline company creation ───────────────────────────────────────────────
	 * `/v1/companies` was read-only, so an AR account could only be opened against
	 * a company that already existed — and nothing could create one. The write path
	 * now exists (ui-gaps/16-booking-reference-data.md); offering it here means
	 * onboarding a new corporate client is one flow rather than a DB insert. */
	readonly addingCompany = signal(false);
	readonly companyTypes = COMPANY_TYPES;
	readonly companyForm = signal({
		company_name: "",
		company_type: "corporate" as string,
		primary_contact_name: "",
		primary_contact_email: "",
	});

	readonly canSubmitCompany = computed(() => this.companyForm().company_name.trim().length > 0);

	openAddCompany(): void {
		this.companyForm.set({
			company_name: "",
			company_type: "corporate",
			primary_contact_name: "",
			primary_contact_email: "",
		});
		this.addingCompany.set(true);
	}

	cancelAddCompany(): void {
		this.addingCompany.set(false);
	}

	async submitCompany(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmitCompany() || this.submitting()) return;
		const f = this.companyForm();
		this.submitting.set(true);
		try {
			const created = await this.api.post<Company>("/companies", {
				tenant_id: tenantId,
				company_name: f.company_name.trim(),
				company_type: f.company_type,
				...(f.primary_contact_name.trim()
					? { primary_contact_name: f.primary_contact_name.trim() }
					: {}),
				...(f.primary_contact_email.trim()
					? { primary_contact_email: f.primary_contact_email.trim() }
					: {}),
			});
			this.toast.success("Company created.");
			this.addingCompany.set(false);
			await this.loadCompanies();
			// Select it straight away — the operator created it to use it.
			if (created?.company_id) this.onCompanyPicked(created.company_id);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create company");
		} finally {
			this.submitting.set(false);
		}
	}

	async submitCreate(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmitCreate() || this.submitting()) return;
		if (!propertyId) {
			this.toast.error("Select a property before opening an AR account.");
			return;
		}
		const f = this.createForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/ar.account.create`, {
				property_id: propertyId,
				company_id: f.company_id.trim(),
				company_name: f.company_name.trim(),
				credit_limit: f.credit_limit,
				payment_terms: f.payment_terms,
				currency: f.currency.trim().toUpperCase() || "USD",
				...(f.contact_name.trim() ? { contact_name: f.contact_name.trim() } : {}),
				...(f.contact_email.trim() ? { contact_email: f.contact_email.trim() } : {}),
				...(f.billing_address.trim() ? { billing_address: f.billing_address.trim() } : {}),
				...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
			});
			this.toast.success("AR account requested. It appears once the command is processed.");
			this.creating.set(false);
			// Command dispatch is async through Kafka; give the handler a moment.
			setTimeout(() => this.load(), 1500);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create AR account");
		} finally {
			this.submitting.set(false);
		}
	}

	openTerms(account: ArAccount): void {
		this.termsForm.set({ credit_limit: null, payment_terms: "", status: "", notes: "" });
		this.editing.set(account);
	}

	cancelTerms(): void {
		this.editing.set(null);
	}

	async submitTerms(): Promise<void> {
		const account = this.editing();
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!account || !tenantId || !propertyId || !this.canSubmitTerms() || this.submitting()) return;
		const f = this.termsForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/ar.account.update_terms`, {
				ar_account_id: account.ar_account_id,
				property_id: propertyId,
				...(f.credit_limit != null ? { credit_limit: f.credit_limit } : {}),
				...(f.payment_terms ? { payment_terms: f.payment_terms } : {}),
				...(f.status ? { status: f.status } : {}),
				...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
			});
			this.toast.success("Credit terms update requested.");
			this.editing.set(null);
			setTimeout(() => this.load(), 1500);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update credit terms");
		} finally {
			this.submitting.set(false);
		}
	}
}
