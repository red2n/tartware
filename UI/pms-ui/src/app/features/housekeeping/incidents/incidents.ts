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
 * A guest or property incident — the liability record. Slips, injuries,
 * altercations, damage, theft allegations.
 *
 * Distinct from `operations.maintenance.*`, which covers property faults, and
 * from the police report in `features/compliance`, which is what gets filed with
 * a force *about* an incident. See ui-gaps/06-incidents.md.
 */
type Incident = {
	incident_id: string;
	property_id: string;
	incident_number: string;
	incident_title: string;
	incident_type: string;
	incident_type_display: string;
	incident_category: string | null;
	severity: string;
	severity_display: string;
	severity_score: number | null;
	incident_datetime: string;
	incident_date: string;
	incident_time: string;
	incident_location: string;
	room_number: string | null;
	area_name: string | null;
	guest_involved: boolean;
	staff_involved: boolean;
	injuries_sustained: boolean;
	injury_severity: string | null;
	medical_attention_required: boolean;
	property_damage: boolean;
	estimated_damage_cost: number | null;
	incident_status: string;
	incident_status_display: string;
	investigation_required: boolean;
	investigation_completed: boolean;
	police_notified: boolean;
	police_report_number: string | null;
	created_at: string;
};

/** What `GET /v1/incidents/:id` adds over the list shape — the narrative. */
type IncidentDetail = Incident & {
	incident_description: string;
	immediate_actions_taken: string | null;
	discovered_by_name: string | null;
	guest_name: string | null;
	injury_details: string | null;
	damage_description: string | null;
	investigation_findings: string | null;
	corrective_actions: string | null;
	follow_up_required: boolean | null;
	follow_up_actions: string | null;
	closed_at: string | null;
	closure_notes: string | null;
};

const INCIDENT_TYPES = [
	"accident",
	"injury",
	"illness",
	"theft",
	"damage",
	"fire",
	"security_breach",
	"guest_complaint",
	"staff_misconduct",
	"food_poisoning",
	"slip_fall",
	"equipment_failure",
	"medical_emergency",
	"death",
	"violence",
	"harassment",
	"property_damage",
	"natural_disaster",
	"other",
] as const;

const SEVERITIES = ["minor", "moderate", "serious", "critical", "catastrophic"] as const;

const STATUSES = [
	"reported",
	"under_investigation",
	"investigated",
	"resolved",
	"closed",
	"pending",
	"escalated",
	"legal_action",
] as const;

const INJURY_SEVERITIES = ["none", "minor", "moderate", "serious", "critical", "fatal"] as const;

/** Statuses that mean the matter is still live. */
const OPEN_STATUSES = new Set([
	"reported",
	"under_investigation",
	"pending",
	"escalated",
	"legal_action",
]);

/**
 * Severities where an unresolved record is a live liability exposure, not just an
 * open ticket. These are what the banner counts.
 */
const SAFETY_SEVERITIES = new Set(["serious", "critical", "catastrophic"]);

@Component({
	selector: "app-incidents",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./incidents.html",
})
export class IncidentsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly incidentTypes = INCIDENT_TYPES;
	readonly severities = SEVERITIES;
	readonly statuses = STATUSES;
	readonly injurySeverities = INJURY_SEVERITIES;

	readonly incidents = signal<Incident[]>([]);
	readonly loading = signal(false);
	readonly severityFilter = signal("");
	readonly typeFilter = signal("");
	readonly statusFilter = signal("");
	readonly dateFromFilter = signal("");
	readonly openOnly = signal(false);

	readonly filing = signal(false);
	readonly submitting = signal(false);
	readonly editing = signal<Incident | null>(null);
	readonly form = signal({
		incident_title: "",
		incident_type: "accident" as string,
		severity: "minor" as string,
		incident_date: "",
		incident_time: "",
		incident_location: "",
		room_number: "",
		area_name: "",
		incident_description: "",
		immediate_actions_taken: "",
		incident_category: "",
		guest_involved: false,
		staff_involved: false,
		injury_severity: "none" as string,
		police_notified: false,
		severity_score: null as number | null,
		discovered_by_name: "",
	});

	/** Detail is a separate fetch — the list shape carries no narrative. */
	readonly detail = signal<IncidentDetail | null>(null);
	readonly detailLoading = signal(false);

	readonly statusTarget = signal<Incident | null>(null);
	readonly statusForm = signal({
		incident_status: "under_investigation" as string,
		closure_notes: "",
	});

	readonly openSafetyIncidents = computed(() =>
		this.incidents().filter(
			(i) => OPEN_STATUSES.has(i.incident_status) && SAFETY_SEVERITIES.has(i.severity),
		),
	);

	readonly visibleIncidents = computed(() =>
		this.openOnly()
			? this.incidents().filter((i) => OPEN_STATUSES.has(i.incident_status))
			: this.incidents(),
	);

	readonly canSubmitForm = computed(() => {
		const f = this.form();
		return (
			f.incident_title.trim().length > 0 &&
			f.incident_date.trim().length > 0 &&
			f.incident_time.trim().length > 0 &&
			f.incident_location.trim().length > 0 &&
			f.incident_description.trim().length > 0 &&
			f.immediate_actions_taken.trim().length > 0
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

	severityClass(severity: string): string {
		switch (severity) {
			case "catastrophic":
			case "critical":
				return "badge badge-attention badge-sm";
			case "serious":
				return "badge badge-warning badge-sm";
			case "moderate":
				return "badge badge-accent badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	statusClass(status: string): string {
		switch (status) {
			case "closed":
			case "resolved":
				return "badge badge-muted badge-sm";
			case "escalated":
			case "legal_action":
				return "badge badge-attention badge-sm";
			case "under_investigation":
			case "pending":
				return "badge badge-warning badge-sm";
			default:
				return "badge badge-accent badge-sm";
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
			const severity = this.severityFilter().trim();
			if (severity) params["severity"] = severity;
			const type = this.typeFilter().trim();
			if (type) params["incident_type"] = type;
			const status = this.statusFilter().trim();
			if (status) params["status"] = status;
			const dateFrom = this.dateFromFilter().trim();
			if (dateFrom) params["date_from"] = dateFrom;

			const res = await this.api.get<{ data: Incident[] } | Incident[]>("/incidents", params);
			this.incidents.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load incidents");
		} finally {
			this.loading.set(false);
		}
	}

	async openDetail(incident: Incident): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.detail.set(null);
		this.detailLoading.set(true);
		try {
			const res = await this.api.get<IncidentDetail>(`/incidents/${incident.incident_id}`, {
				tenant_id: tenantId,
			});
			this.detail.set(res);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load incident");
		} finally {
			this.detailLoading.set(false);
		}
	}

	closeDetail(): void {
		this.detail.set(null);
	}

	openFile(): void {
		this.editing.set(null);
		const now = new Date();
		this.form.set({
			incident_title: "",
			incident_type: "accident",
			severity: "minor",
			incident_date: now.toISOString().slice(0, 10),
			incident_time: now.toTimeString().slice(0, 5),
			incident_location: "",
			room_number: "",
			area_name: "",
			incident_description: "",
			immediate_actions_taken: "",
			incident_category: "",
			guest_involved: false,
			staff_involved: false,
			injury_severity: "none",
			police_notified: false,
			severity_score: null,
			discovered_by_name: "",
		});
		this.filing.set(true);
	}

	/**
	 * Amending pre-fills from the detail fetch, because the narrative fields being
	 * edited are not in the list row. Without this the form would blank them and
	 * the PUT would overwrite the description with an empty string.
	 */
	async openEdit(incident: Incident): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.submitting.set(true);
		try {
			const full = await this.api.get<IncidentDetail>(`/incidents/${incident.incident_id}`, {
				tenant_id: tenantId,
			});
			this.editing.set(incident);
			this.form.set({
				incident_title: full.incident_title,
				incident_type: full.incident_type,
				severity: full.severity,
				incident_date: full.incident_date.slice(0, 10),
				incident_time: full.incident_time.slice(0, 5),
				incident_location: full.incident_location,
				room_number: full.room_number ?? "",
				area_name: full.area_name ?? "",
				incident_description: full.incident_description,
				immediate_actions_taken: full.immediate_actions_taken ?? "",
				incident_category: full.incident_category ?? "",
				guest_involved: full.guest_involved,
				staff_involved: full.staff_involved,
				injury_severity: full.injury_severity ?? "none",
				police_notified: full.police_notified,
				severity_score: full.severity_score,
				discovered_by_name: full.discovered_by_name ?? "",
			});
			this.filing.set(true);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load incident for editing");
		} finally {
			this.submitting.set(false);
		}
	}

	cancelForm(): void {
		this.filing.set(false);
		this.editing.set(null);
	}

	async submitForm(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !this.canSubmitForm() || this.submitting()) return;

		const existing = this.editing();
		if (!existing && !propertyId) {
			this.toast.error("Select a property before filing an incident.");
			return;
		}

		const f = this.form();
		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			property_id: existing ? existing.property_id : propertyId,
			incident_title: f.incident_title.trim(),
			incident_type: f.incident_type,
			severity: f.severity,
			incident_date: f.incident_date,
			incident_time: f.incident_time,
			incident_location: f.incident_location.trim(),
			incident_description: f.incident_description.trim(),
			immediate_actions_taken: f.immediate_actions_taken.trim(),
			guest_involved: f.guest_involved,
			staff_involved: f.staff_involved,
			injury_severity: f.injury_severity,
			police_notified: f.police_notified,
			...(f.incident_category.trim() ? { incident_category: f.incident_category.trim() } : {}),
			...(f.room_number.trim() ? { room_number: f.room_number.trim() } : {}),
			...(f.area_name.trim() ? { area_name: f.area_name.trim() } : {}),
			...(f.severity_score != null ? { severity_score: f.severity_score } : {}),
			...(f.discovered_by_name.trim() ? { discovered_by_name: f.discovered_by_name.trim() } : {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/incidents/${existing.incident_id}`, body);
				this.toast.success("Incident amended.");
			} else {
				await this.api.post("/incidents", body);
				this.toast.success("Incident filed.");
			}
			this.filing.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save incident");
		} finally {
			this.submitting.set(false);
		}
	}

	openStatus(incident: Incident): void {
		this.statusForm.set({
			incident_status:
				incident.incident_status === "reported" ? "under_investigation" : incident.incident_status,
			closure_notes: "",
		});
		this.statusTarget.set(incident);
	}

	cancelStatus(): void {
		this.statusTarget.set(null);
	}

	async submitStatus(): Promise<void> {
		const incident = this.statusTarget();
		const tenantId = this.auth.tenantId();
		if (!incident || !tenantId || this.submitting()) return;
		const f = this.statusForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/incidents/${incident.incident_id}/status`, {
				tenant_id: tenantId,
				incident_status: f.incident_status,
				...(f.closure_notes.trim() ? { closure_notes: f.closure_notes.trim() } : {}),
			});
			this.toast.success("Incident status updated.");
			this.statusTarget.set(null);
			if (this.detail()?.incident_id === incident.incident_id) await this.openDetail(incident);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update status");
		} finally {
			this.submitting.set(false);
		}
	}
}
