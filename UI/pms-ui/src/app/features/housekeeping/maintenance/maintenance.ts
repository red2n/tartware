import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { MaintenanceRequestListItem, UserWithTenants } from "@tartware/schemas";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Property faults — the maintenance register.
 *
 * Distinct from `features/housekeeping/incidents`, which is the liability record
 * for what happens to people, and from housekeeping tasks, which are cleaning
 * work. A fault here is something broken.
 *
 * The write path landed 2026-08-18: four `operations.maintenance.*` commands had
 * handlers but nothing could dispatch them, so a guest could report a fault and
 * there was no way to log it — while `/v1/reports/maintenance-sla` reported on a
 * table nothing could fill. Writes are plain HTTP on housekeeping-service, not
 * commands, because every one touches `maintenance_requests` in that service
 * alone. See ui-gaps/18-write-path-gap.md.
 */
type MaintenanceRequest = MaintenanceRequestListItem;

const REQUEST_TYPES = [
	"CORRECTIVE",
	"PREVENTIVE",
	"EMERGENCY",
	"ROUTINE",
	"INSPECTION",
	"UPGRADE",
	"GUEST_REPORTED",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY"] as const;

const STATUSES = [
	"OPEN",
	"ASSIGNED",
	"IN_PROGRESS",
	"ON_HOLD",
	"COMPLETED",
	"CANCELLED",
	"VERIFIED",
] as const;

const ISSUE_CATEGORIES = [
	"PLUMBING",
	"ELECTRICAL",
	"HVAC",
	"APPLIANCE",
	"FURNITURE",
	"FIXTURE",
	"SAFETY",
	"CLEANLINESS",
	"PEST",
	"STRUCTURAL",
	"EQUIPMENT",
	"TECHNOLOGY",
	"OTHER",
] as const;

/** Statuses where the fault is still outstanding. */
const OPEN_STATUSES = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"]);

/**
 * housekeeping-service lowercases `request_status`, `priority` and
 * `issue_category` in its row mapper, while the table, its CHECK constraint and
 * `MaintenanceRequestStatusEnum` are all UPPERCASE. So the value on the wire is
 * `"completed"` and every constant here is `"COMPLETED"`.
 *
 * Comparing raw would have made all three banners read zero, "Open only" hide
 * every row, and each badge fall through to the neutral style — a screen that
 * looks right and is silently wrong. Found by exercising the API, not by types:
 * `MaintenanceRequestListItemSchema` types these as `z.string()`, so nothing
 * catches it at compile time. Same case drift `00-CONSOLIDATED.md` records for
 * the 41 enums on 2026-08-13.
 *
 * Filters are unaffected — the route's query schema `.toUpperCase()`s them, so
 * either casing matches.
 */
const norm = (value: string | null | undefined): string => (value ?? "").toUpperCase();

/** Priorities that should not sit in a queue overnight. */
const URGENT_PRIORITIES = new Set(["URGENT", "EMERGENCY"]);

type ActionMode = "assign" | "complete" | "escalate";

@Component({
	selector: "app-maintenance",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./maintenance.html",
})
export class MaintenanceComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly requestTypes = REQUEST_TYPES;
	readonly priorities = PRIORITIES;
	readonly statuses = STATUSES;
	readonly issueCategories = ISSUE_CATEGORIES;

	readonly requests = signal<MaintenanceRequest[]>([]);
	readonly staff = signal<UserWithTenants[]>([]);
	readonly loading = signal(false);

	readonly statusFilter = signal("");
	readonly priorityFilter = signal("");
	readonly categoryFilter = signal("");
	readonly openOnly = signal(false);

	readonly raising = signal(false);
	readonly submitting = signal(false);
	readonly form = signal({
		request_type: "CORRECTIVE" as string,
		issue_category: "PLUMBING" as string,
		issue_description: "",
		priority: "MEDIUM" as string,
		room_number: "",
		location_description: "",
		reporter_role: "",
		affects_occupancy: false,
	});

	/** Assign / complete / escalate all act on one row, so they share a target. */
	readonly actionTarget = signal<MaintenanceRequest | null>(null);
	readonly actionMode = signal<ActionMode | null>(null);
	readonly actionForm = signal({
		assigned_to: "",
		maintenance_team: "",
		scheduled_date: "",
		estimated_duration_minutes: null as number | null,
		notes: "",
		work_performed: "",
		parts_used: "",
		actual_duration_minutes: null as number | null,
		labor_cost: null as number | null,
		parts_cost: null as number | null,
		is_satisfactory: true,
		completion_notes: "",
		escalated_to: "",
		escalation_reason: "",
		new_priority: "" as string,
	});

	/**
	 * Rooms an unresolved fault is keeping off the market. This is the number that
	 * costs money — every one is a room that cannot be sold tonight — so it gets a
	 * banner rather than a column.
	 *
	 * Counts `affects_occupancy` as well as `room_out_of_service`, because they are
	 * different things and only the first is set when a fault is raised:
	 * `affects_occupancy` is the reporter's claim that the room cannot be sold,
	 * while `room_out_of_service` is the actual OOS state, set separately when
	 * someone takes the room down. Keying on the latter alone left the banner
	 * permanently at zero — every fault raised through this screen has it false.
	 */
	readonly roomsOutOfService = computed(() =>
		this.requests().filter(
			(r) =>
				(r.room_out_of_service || r.affects_occupancy) &&
				OPEN_STATUSES.has(norm(r.request_status)),
		),
	);

	readonly urgentOpen = computed(() =>
		this.requests().filter(
			(r) => OPEN_STATUSES.has(norm(r.request_status)) && URGENT_PRIORITIES.has(norm(r.priority)),
		),
	);

	readonly safetyOpen = computed(() =>
		this.requests().filter(
			(r) => OPEN_STATUSES.has(norm(r.request_status)) && (r.is_safety_issue || r.is_health_issue),
		),
	);

	readonly visibleRequests = computed(() =>
		this.openOnly()
			? this.requests().filter((r) => OPEN_STATUSES.has(norm(r.request_status)))
			: this.requests(),
	);

	readonly canSubmitForm = computed(() => {
		const f = this.form();
		return f.issue_description.trim().length > 1 && f.issue_category.trim().length > 1;
	});

	readonly canSubmitAction = computed(() => {
		const f = this.actionForm();
		switch (this.actionMode()) {
			case "assign":
				return f.assigned_to.trim().length > 0;
			case "complete":
				return f.work_performed.trim().length > 0;
			case "escalate":
				return f.escalated_to.trim().length > 0 && f.escalation_reason.trim().length > 0;
			default:
				return false;
		}
	});

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) {
				void this.load();
				void this.loadStaff();
			}
		});
	}

	labelFor(value: string | null | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	staffName(userId: string | undefined | null): string {
		if (!userId) return "Unassigned";
		const user = this.staff().find((s) => s.id === userId);
		if (!user) return userId.slice(0, 8);
		const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
		return name || user.email || userId.slice(0, 8);
	}

	priorityClass(priority: string): string {
		switch (norm(priority)) {
			case "EMERGENCY":
			case "URGENT":
				return "badge badge-danger badge-sm";
			case "HIGH":
				return "badge badge-warning badge-sm";
			case "MEDIUM":
				return "badge badge-accent badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	statusClass(status: string): string {
		switch (norm(status)) {
			case "COMPLETED":
			case "VERIFIED":
				return "badge badge-success badge-sm";
			case "CANCELLED":
				return "badge badge-muted badge-sm";
			case "ON_HOLD":
				return "badge badge-warning badge-sm";
			case "IN_PROGRESS":
			case "ASSIGNED":
				return "badge badge-accent badge-sm";
			default:
				return "badge badge-warning badge-sm";
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
			const priority = this.priorityFilter().trim();
			if (priority) params["priority"] = priority;
			const category = this.categoryFilter().trim();
			if (category) params["issue_category"] = category;

			const res = await this.api.get<{ data: MaintenanceRequest[] } | MaintenanceRequest[]>(
				"/maintenance/requests",
				params,
			);
			this.requests.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load maintenance requests");
		} finally {
			this.loading.set(false);
		}
	}

	/** Assignment and escalation both take a user id, so the picker is shared. */
	private async loadStaff(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const data = await this.api.get<UserWithTenants[]>(
				`/users?tenant_id=${tenantId}&limit=200`,
			);
			this.staff.set(data ?? []);
		} catch {
			// A missing picker must not block raising a fault.
			this.staff.set([]);
		}
	}

	openRaise(): void {
		this.form.set({
			request_type: "CORRECTIVE",
			issue_category: "PLUMBING",
			issue_description: "",
			priority: "MEDIUM",
			room_number: "",
			location_description: "",
			reporter_role: "",
			affects_occupancy: false,
		});
		this.raising.set(true);
	}

	cancelRaise(): void {
		this.raising.set(false);
	}

	async submitRaise(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmitForm()) return;
		if (!propertyId) {
			this.toast.error("Select a property before raising a maintenance request.");
			return;
		}

		this.submitting.set(true);
		try {
			const f = this.form();
			await this.api.post("/maintenance/requests", {
				tenant_id: tenantId,
				property_id: propertyId,
				request_type: f.request_type,
				issue_category: f.issue_category,
				issue_description: f.issue_description.trim(),
				priority: f.priority,
				...(f.room_number.trim() ? { room_number: f.room_number.trim() } : {}),
				...(f.location_description.trim()
					? { location_description: f.location_description.trim() }
					: {}),
				...(f.reporter_role.trim() ? { reporter_role: f.reporter_role.trim() } : {}),
				affects_occupancy: f.affects_occupancy,
			});
			this.toast.success("Maintenance request raised.");
			this.raising.set(false);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to raise the request");
		} finally {
			this.submitting.set(false);
		}
	}

	showAction(request: MaintenanceRequest, mode: ActionMode): void {
		this.actionTarget.set(request);
		this.actionMode.set(mode);
		this.actionForm.set({
			assigned_to: request.assigned_to ?? "",
			maintenance_team: request.maintenance_team ?? "",
			scheduled_date: "",
			estimated_duration_minutes: null,
			notes: "",
			work_performed: "",
			parts_used: "",
			actual_duration_minutes: null,
			labor_cost: null,
			parts_cost: null,
			is_satisfactory: true,
			completion_notes: "",
			escalated_to: "",
			escalation_reason: "",
			new_priority: "",
		});
	}

	cancelAction(): void {
		this.actionTarget.set(null);
		this.actionMode.set(null);
	}

	canAssign(request: MaintenanceRequest): boolean {
		return OPEN_STATUSES.has(norm(request.request_status));
	}

	canComplete(request: MaintenanceRequest): boolean {
		const status = norm(request.request_status);
		return status === "ASSIGNED" || status === "IN_PROGRESS";
	}

	canEscalate(request: MaintenanceRequest): boolean {
		return OPEN_STATUSES.has(request.request_status);
	}

	async submitAction(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const request = this.actionTarget();
		const mode = this.actionMode();
		if (!tenantId || !request || !mode || !this.canSubmitAction()) return;

		this.submitting.set(true);
		try {
			const f = this.actionForm();
			const base = `/maintenance/requests/${request.request_id}`;

			if (mode === "assign") {
				await this.api.post(`${base}/assign`, {
					tenant_id: tenantId,
					assigned_to: f.assigned_to,
					...(f.maintenance_team.trim() ? { maintenance_team: f.maintenance_team.trim() } : {}),
					...(f.scheduled_date.trim() ? { scheduled_date: f.scheduled_date.trim() } : {}),
					...(f.estimated_duration_minutes
						? { estimated_duration_minutes: f.estimated_duration_minutes }
						: {}),
					...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
				});
				this.toast.success(`Assigned to ${this.staffName(f.assigned_to)}.`);
			} else if (mode === "complete") {
				await this.api.post(`${base}/complete`, {
					tenant_id: tenantId,
					work_performed: f.work_performed.trim(),
					...(f.parts_used.trim() ? { parts_used: f.parts_used.trim() } : {}),
					...(f.actual_duration_minutes
						? { actual_duration_minutes: f.actual_duration_minutes }
						: {}),
					...(f.labor_cost !== null ? { labor_cost: f.labor_cost } : {}),
					...(f.parts_cost !== null ? { parts_cost: f.parts_cost } : {}),
					is_satisfactory: f.is_satisfactory,
					...(f.completion_notes.trim() ? { completion_notes: f.completion_notes.trim() } : {}),
				});
				this.toast.success("Marked complete.");
			} else {
				await this.api.post(`${base}/escalate`, {
					tenant_id: tenantId,
					escalated_to: f.escalated_to,
					escalation_reason: f.escalation_reason.trim(),
					...(f.new_priority ? { new_priority: f.new_priority } : {}),
				});
				this.toast.success("Escalated.");
			}

			this.cancelAction();
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : `Failed to ${mode} the request`);
		} finally {
			this.submitting.set(false);
		}
	}
}
