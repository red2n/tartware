import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * An item handed in by a room attendant or guest, held until claimed, returned
 * or disposed of. Backed by housekeeping-service's `/v1/lost-and-found` — the
 * one operations domain whose backend was already complete. See
 * ui-gaps/07-lost-and-found.md.
 */
type LostFoundItem = {
	item_id: string;
	property_id: string;
	item_number?: string;
	item_name: string;
	item_description: string;
	item_category: string;
	item_subcategory?: string;
	brand?: string;
	color?: string;
	estimated_value?: string | number;
	currency?: string;
	is_valuable?: boolean;
	found_date: string;
	found_time?: string;
	found_by_name?: string;
	found_location: string;
	room_number?: string;
	area_name?: string;
	guest_name?: string;
	guest_email?: string;
	item_status: string;
	storage_location?: string;
	storage_shelf?: string;
	storage_bin?: string;
	claimed?: boolean;
	claimed_by_name?: string;
	claim_date?: string;
	returned?: boolean;
	return_date?: string;
	return_method?: string;
	hold_until_date?: string;
	internal_notes?: string;
};

const ITEM_CATEGORIES = [
	"electronics",
	"jewelry",
	"clothing",
	"accessories",
	"documents",
	"keys",
	"bags",
	"wallets",
	"phones",
	"laptops",
	"tablets",
	"watches",
	"glasses",
	"books",
	"toys",
	"medical",
	"other",
] as const;

const ITEM_STATUSES = [
	"registered",
	"stored",
	"claimed",
	"returned",
	"shipped",
	"donated",
	"disposed",
	"lost_again",
	"pending_claim",
] as const;

const RETURN_METHODS = ["in_person", "shipped", "courier", "picked_up", "mailed"] as const;

/**
 * Statuses where the property still physically holds the item. Only these can be
 * claimed or returned — `returnLostAndFoundItem` enforces the same set server-side,
 * so offering the action outside it would produce a 409.
 */
const HELD_STATUSES = new Set(["registered", "stored", "pending_claim"]);

/** Claimed items are still on the shelf until someone actually collects them. */
const RETURNABLE_STATUSES = new Set([...HELD_STATUSES, "claimed"]);

@Component({
	selector: "app-lost-and-found",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./lost-and-found.html",
})
export class LostAndFoundComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly categories = ITEM_CATEGORIES;
	readonly statuses = ITEM_STATUSES;
	readonly returnMethods = RETURN_METHODS;

	readonly items = signal<LostFoundItem[]>([]);
	readonly loading = signal(false);
	readonly statusFilter = signal("");
	readonly categoryFilter = signal("");
	readonly dateFromFilter = signal("");
	/** Retention view — items held past their hold-until date, for disposal decisions. */
	readonly overdueOnly = signal(false);

	readonly registering = signal(false);
	readonly submitting = signal(false);
	readonly editing = signal<LostFoundItem | null>(null);
	readonly form = signal({
		item_name: "",
		item_description: "",
		item_category: "other" as string,
		brand: "",
		color: "",
		estimated_value: null as number | null,
		found_date: "",
		found_time: "",
		found_by_name: "",
		found_location: "",
		room_number: "",
		area_name: "",
		guest_name: "",
		guest_email: "",
		storage_location: "",
		hold_days: 90 as number | null,
		is_valuable: false,
		requires_secure_storage: false,
		special_handling_instructions: "",
		internal_notes: "",
	});

	readonly claimTarget = signal<LostFoundItem | null>(null);
	readonly claimForm = signal({ claimed_by_name: "", verification_notes: "" });

	readonly returnTarget = signal<LostFoundItem | null>(null);
	readonly returnForm = signal({
		return_method: "in_person" as string,
		returned_to_name: "",
		notes: "",
	});

	/** Items past their hold window and still on the shelf — the daily disposal worklist. */
	readonly pastRetention = computed(() =>
		this.items().filter((item) => this.isOverdue(item)),
	);

	readonly visibleItems = computed(() =>
		this.overdueOnly() ? this.pastRetention() : this.items(),
	);

	readonly canSubmitForm = computed(() => {
		const f = this.form();
		return (
			f.item_name.trim().length > 0 &&
			f.item_description.trim().length > 0 &&
			f.found_location.trim().length > 0 &&
			f.found_date.trim().length > 0
		);
	});

	readonly canSubmitClaim = computed(() => this.claimForm().claimed_by_name.trim().length > 0);
	readonly canSubmitReturn = computed(
		() => this.returnForm().returned_to_name.trim().length > 0,
	);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * `lost_and_found.days_in_storage` is a plain column nothing writes, so it is
	 * always null. Derive the age from `found_date` rather than showing a blank.
	 */
	daysInStorage(item: LostFoundItem): number {
		const found = Date.parse(item.found_date);
		if (Number.isNaN(found)) return 0;
		return Math.max(0, Math.floor((Date.now() - found) / 86_400_000));
	}

	isOverdue(item: LostFoundItem): boolean {
		if (!HELD_STATUSES.has(item.item_status)) return false;
		if (!item.hold_until_date) return false;
		return item.hold_until_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
	}

	canClaim(item: LostFoundItem): boolean {
		return HELD_STATUSES.has(item.item_status);
	}

	canReturn(item: LostFoundItem): boolean {
		return RETURNABLE_STATUSES.has(item.item_status);
	}

	statusClass(status: string): string {
		switch (status) {
			case "returned":
				return "badge badge-accent badge-sm";
			case "disposed":
			case "donated":
			case "lost_again":
				return "badge badge-muted badge-sm";
			case "claimed":
			case "pending_claim":
				return "badge badge-warning badge-sm";
			default:
				return "badge badge-attention badge-sm";
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
			const category = this.categoryFilter().trim();
			if (category) params["category"] = category;
			const dateFrom = this.dateFromFilter().trim();
			if (dateFrom) params["date_from"] = dateFrom;

			const res = await this.api.get<{ data: LostFoundItem[] } | LostFoundItem[]>(
				"/lost-and-found",
				params,
			);
			this.items.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load lost & found items");
		} finally {
			this.loading.set(false);
		}
	}

	openRegister(): void {
		this.editing.set(null);
		this.form.set({
			item_name: "",
			item_description: "",
			item_category: "other",
			brand: "",
			color: "",
			estimated_value: null,
			// Items are almost always handed in the day they are found.
			found_date: new Date().toISOString().slice(0, 10),
			found_time: "",
			found_by_name: "",
			found_location: "",
			room_number: "",
			area_name: "",
			guest_name: "",
			guest_email: "",
			storage_location: "",
			hold_days: 90,
			is_valuable: false,
			requires_secure_storage: false,
			special_handling_instructions: "",
			internal_notes: "",
		});
		this.registering.set(true);
	}

	openEdit(item: LostFoundItem): void {
		this.editing.set(item);
		this.form.set({
			item_name: item.item_name,
			item_description: item.item_description,
			item_category: item.item_category,
			brand: item.brand ?? "",
			color: item.color ?? "",
			estimated_value: item.estimated_value != null ? Number(item.estimated_value) : null,
			found_date: item.found_date.slice(0, 10),
			found_time: item.found_time ?? "",
			found_by_name: item.found_by_name ?? "",
			found_location: item.found_location,
			room_number: item.room_number ?? "",
			area_name: item.area_name ?? "",
			guest_name: item.guest_name ?? "",
			guest_email: item.guest_email ?? "",
			storage_location: item.storage_location ?? "",
			hold_days: null,
			is_valuable: item.is_valuable ?? false,
			requires_secure_storage: false,
			special_handling_instructions: "",
			internal_notes: item.internal_notes ?? "",
		});
		this.registering.set(true);
	}

	cancelForm(): void {
		this.registering.set(false);
		this.editing.set(null);
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmitForm() || this.submitting()) return;

		const existing = this.editing();
		if (!existing && !propertyId) {
			this.toast.error("Select a property before registering an item.");
			return;
		}

		const f = this.form();
		const optionalText = (value: string) => value.trim();

		this.submitting.set(true);
		try {
			if (existing) {
				// PUT accepts a narrower field set than POST — storage moves and corrections.
				await this.api.put(`/lost-and-found/${existing.item_id}`, {
					tenant_id: tenantId,
					item_name: f.item_name.trim(),
					item_description: f.item_description.trim(),
					item_category: f.item_category,
					...(optionalText(f.brand) ? { brand: optionalText(f.brand) } : {}),
					...(optionalText(f.color) ? { color: optionalText(f.color) } : {}),
					...(f.estimated_value != null ? { estimated_value: f.estimated_value } : {}),
					...(optionalText(f.storage_location)
						? { storage_location: optionalText(f.storage_location) }
						: {}),
					...(optionalText(f.guest_name) ? { guest_name: optionalText(f.guest_name) } : {}),
					...(optionalText(f.guest_email) ? { guest_email: optionalText(f.guest_email) } : {}),
					...(optionalText(f.internal_notes)
						? { internal_notes: optionalText(f.internal_notes) }
						: {}),
					is_valuable: f.is_valuable,
					requires_secure_storage: f.requires_secure_storage,
				});
				this.toast.success("Item updated.");
			} else {
				await this.api.post("/lost-and-found", {
					tenant_id: tenantId,
					property_id: propertyId,
					item_name: f.item_name.trim(),
					item_description: f.item_description.trim(),
					item_category: f.item_category,
					found_date: f.found_date,
					found_location: f.found_location.trim(),
					...(optionalText(f.brand) ? { brand: optionalText(f.brand) } : {}),
					...(optionalText(f.color) ? { color: optionalText(f.color) } : {}),
					...(f.estimated_value != null ? { estimated_value: f.estimated_value } : {}),
					...(f.found_time ? { found_time: f.found_time } : {}),
					...(optionalText(f.found_by_name) ? { found_by_name: optionalText(f.found_by_name) } : {}),
					...(optionalText(f.room_number) ? { room_number: optionalText(f.room_number) } : {}),
					...(optionalText(f.area_name) ? { area_name: optionalText(f.area_name) } : {}),
					...(optionalText(f.guest_name) ? { guest_name: optionalText(f.guest_name) } : {}),
					...(optionalText(f.guest_email) ? { guest_email: optionalText(f.guest_email) } : {}),
					...(optionalText(f.storage_location)
						? { storage_location: optionalText(f.storage_location) }
						: {}),
					...(f.hold_days != null ? { hold_days: f.hold_days } : {}),
					is_valuable: f.is_valuable,
					requires_secure_storage: f.requires_secure_storage,
					...(optionalText(f.special_handling_instructions)
						? { special_handling_instructions: optionalText(f.special_handling_instructions) }
						: {}),
					...(optionalText(f.internal_notes)
						? { internal_notes: optionalText(f.internal_notes) }
						: {}),
				});
				this.toast.success("Item registered.");
			}
			this.registering.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save item");
		} finally {
			this.submitting.set(false);
		}
	}

	openClaim(item: LostFoundItem): void {
		this.claimForm.set({ claimed_by_name: item.guest_name ?? "", verification_notes: "" });
		this.claimTarget.set(item);
	}

	cancelClaim(): void {
		this.claimTarget.set(null);
	}

	async submitClaim(): Promise<void> {
		const item = this.claimTarget();
		const tenantId = this.auth.tenantId();
		if (!item || !tenantId || !this.canSubmitClaim() || this.submitting()) return;
		const f = this.claimForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/lost-and-found/${item.item_id}/claim`, {
				tenant_id: tenantId,
				claimed_by_name: f.claimed_by_name.trim(),
				...(f.verification_notes.trim() ? { verification_notes: f.verification_notes.trim() } : {}),
			});
			this.toast.success("Claim recorded.");
			this.claimTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record claim");
		} finally {
			this.submitting.set(false);
		}
	}

	openReturn(item: LostFoundItem): void {
		this.returnForm.set({
			return_method: "in_person",
			returned_to_name: item.claimed_by_name ?? item.guest_name ?? "",
			notes: "",
		});
		this.returnTarget.set(item);
	}

	cancelReturn(): void {
		this.returnTarget.set(null);
	}

	async submitReturn(): Promise<void> {
		const item = this.returnTarget();
		const tenantId = this.auth.tenantId();
		if (!item || !tenantId || !this.canSubmitReturn() || this.submitting()) return;
		const f = this.returnForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/lost-and-found/${item.item_id}/return`, {
				tenant_id: tenantId,
				return_method: f.return_method,
				returned_to_name: f.returned_to_name.trim(),
				...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
			});
			this.toast.success("Return recorded.");
			this.returnTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record return");
		} finally {
			this.submitting.set(false);
		}
	}
}
