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
 * A guest waiting for inventory that is not currently available.
 *
 * Both halves of this domain already existed and neither was reachable: the
 * reads live on core-service (`/v1/waitlist`), the writes on
 * reservations-command-service behind `reservation.waitlist_add` and
 * `.waitlist_convert`. COV-16 assumed these were duplicate read surfaces to
 * collapse; they are not — it is one read surface and one write surface split
 * across two services. See ui-gaps/16-booking-reference-data.md.
 */
type WaitlistEntry = {
	waitlist_id: string;
	property_id: string;
	guest_id?: string;
	guest_name?: string;
	reservation_id?: string;
	requested_room_type_id?: string;
	room_type_name?: string;
	arrival_date: string;
	departure_date: string;
	nights: number;
	number_of_rooms: number;
	number_of_adults: number;
	number_of_children: number;
	flexibility: string;
	flexibility_display: string;
	waitlist_status: string;
	waitlist_status_display: string;
	priority_score: number;
	vip_flag: boolean;
	last_notified_at?: string;
	offer_expiration_at?: string;
	offer_response: string | null;
	notes: string | null;
	created_at: string;
};

const STATUSES = ["ACTIVE", "OFFERED", "CONFIRMED", "EXPIRED", "CANCELLED"] as const;

const FLEXIBILITY = ["NONE", "DATE", "ROOM_TYPE", "EITHER"] as const;

/** Only these can still be turned into a booking; the convert command enforces the same. */
const CONVERTIBLE_STATUSES = new Set(["ACTIVE", "OFFERED"]);

@Component({
	selector: "app-waitlist",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./waitlist.html",
})
export class WaitlistComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly statuses = STATUSES;
	readonly flexibilityOptions = FLEXIBILITY;

	readonly entries = signal<WaitlistEntry[]>([]);
	readonly loading = signal(false);
	readonly submitting = signal(false);
	readonly statusFilter = signal("");

	readonly adding = signal(false);
	readonly form = signal({
		guest_id: "",
		requested_room_type_id: "",
		arrival_date: "",
		departure_date: "",
		number_of_rooms: 1,
		number_of_adults: 2,
		number_of_children: 0,
		flexibility: "NONE" as string,
		vip_flag: false,
		notes: "",
	});

	readonly convertTarget = signal<WaitlistEntry | null>(null);

	/** An offer that has lapsed is a guest still waiting on an answer nobody gave. */
	readonly expiredOffers = computed(() => {
		const now = Date.now();
		return this.entries().filter(
			(e) =>
				e.waitlist_status === "OFFERED" &&
				e.offer_expiration_at != null &&
				Date.parse(e.offer_expiration_at) < now &&
				!e.offer_response,
		);
	});

	readonly vipWaiting = computed(() =>
		this.entries().filter((e) => e.vip_flag && CONVERTIBLE_STATUSES.has(e.waitlist_status)),
	);

	readonly canSubmit = computed(() => {
		const f = this.form();
		return (
			f.guest_id.trim().length > 0 &&
			f.requested_room_type_id.trim().length > 0 &&
			f.arrival_date.length > 0 &&
			f.departure_date.length > 0 &&
			f.departure_date > f.arrival_date
		);
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string): string {
		switch (status) {
			case "CONFIRMED":
				return "badge badge-accent badge-sm";
			case "OFFERED":
				return "badge badge-warning badge-sm";
			case "EXPIRED":
			case "CANCELLED":
				return "badge badge-muted badge-sm";
			default:
				return "badge badge-attention badge-sm";
		}
	}

	canConvert(entry: WaitlistEntry): boolean {
		return CONVERTIBLE_STATUSES.has(entry.waitlist_status);
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
			if (status) params["waitlist_status"] = status;

			const res = await this.api.get<{ data: WaitlistEntry[] } | WaitlistEntry[]>(
				"/waitlist",
				params,
			);
			this.entries.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load the waitlist");
		} finally {
			this.loading.set(false);
		}
	}

	openAdd(): void {
		const today = new Date();
		const tomorrow = new Date(today.getTime() + 86_400_000);
		this.form.set({
			guest_id: "",
			requested_room_type_id: "",
			arrival_date: today.toISOString().slice(0, 10),
			departure_date: tomorrow.toISOString().slice(0, 10),
			number_of_rooms: 1,
			number_of_adults: 2,
			number_of_children: 0,
			flexibility: "NONE",
			vip_flag: false,
			notes: "",
		});
		this.adding.set(true);
	}

	cancelAdd(): void {
		this.adding.set(false);
	}

	/**
	 * Add and convert are commands, so both answer 202 — the entry appears once the
	 * consumer has processed it. The screen reports acceptance and reloads rather
	 * than pretending the row is already there.
	 */
	async submitAdd(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmit() || this.submitting()) return;
		if (!propertyId) {
			this.toast.error("Select a property before adding to the waitlist.");
			return;
		}
		const f = this.form();
		this.submitting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/reservations/waitlist`, {
				property_id: propertyId,
				guest_id: f.guest_id.trim(),
				requested_room_type_id: f.requested_room_type_id.trim(),
				arrival_date: f.arrival_date,
				departure_date: f.departure_date,
				number_of_rooms: f.number_of_rooms,
				number_of_adults: f.number_of_adults,
				number_of_children: f.number_of_children,
				flexibility: f.flexibility,
				vip_flag: f.vip_flag,
				...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
			});
			this.toast.success("Waitlist request accepted.");
			this.adding.set(false);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to add to the waitlist");
		} finally {
			this.submitting.set(false);
		}
	}

	openConvert(entry: WaitlistEntry): void {
		this.convertTarget.set(entry);
	}

	cancelConvert(): void {
		this.convertTarget.set(null);
	}

	async confirmConvert(): Promise<void> {
		const entry = this.convertTarget();
		const tenantId = this.auth.tenantId();
		if (!entry || !tenantId || this.submitting()) return;
		this.submitting.set(true);
		try {
			await this.api.post(
				`/tenants/${tenantId}/reservations/waitlist/${entry.waitlist_id}/convert`,
				{},
			);
			this.toast.success("Conversion accepted — the reservation will appear shortly.");
			this.convertTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to convert the waitlist entry");
		} finally {
			this.submitting.set(false);
		}
	}
}
