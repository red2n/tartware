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
 * A report of a crime to the police — theft, assault, vandalism — with the agency,
 * the responding officer and the force's own case number.
 *
 * Not to be confused with statutory *guest registration* reporting (Form C, TM30
 * and the like). That is a different obligation and the system has no table for it;
 * see ui-gaps/02-police-reports.md.
 */
type PoliceReport = {
	report_id: string;
	property_id: string;
	report_number: string;
	police_case_number?: string;
	incident_id?: string;
	incident_date: string;
	incident_time?: string;
	reported_date: string;
	incident_type?: string;
	incident_description: string;
	incident_location?: string;
	room_number?: string;
	agency_name: string;
	responding_officer_name?: string;
	report_status: string;
	report_status_display?: string;
	suspect_count?: number;
	victim_count?: number;
	guest_involved?: boolean;
};

const INCIDENT_TYPES = [
	"theft",
	"assault",
	"vandalism",
	"trespassing",
	"fraud",
	"suspicious_activity",
	"missing_person",
	"death",
	"drug_related",
	"domestic_disturbance",
	"noise_complaint",
	"vehicle_incident",
	"other",
] as const;

const REPORT_STATUSES = [
	"filed",
	"under_investigation",
	"closed",
	"charges_filed",
	"no_action",
	"referred",
	"pending",
] as const;

/** Statuses that mean the matter is still live with the force. */
const OPEN_STATUSES = new Set(["filed", "pending", "under_investigation", "referred"]);

@Component({
	selector: "app-police-reports",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./police-reports.html",
	styleUrl: "./police-reports.scss",
})
export class PoliceReportsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	// Tenant lives on auth; the active property lives on the tenant context.
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly incidentTypes = INCIDENT_TYPES;
	readonly reportStatuses = REPORT_STATUSES;

	readonly reports = signal<PoliceReport[]>([]);
	readonly loading = signal(false);
	readonly statusFilter = signal("");
	readonly typeFilter = signal("");

	readonly filing = signal(false);
	readonly submitting = signal(false);
	readonly editing = signal<PoliceReport | null>(null);
	readonly form = signal({
		incident_date: "",
		incident_time: "",
		incident_type: "theft" as string,
		incident_description: "",
		incident_location: "",
		room_number: "",
		agency_name: "",
		agency_jurisdiction: "",
		agency_contact_number: "",
		responding_officer_name: "",
		responding_officer_badge: "",
		guest_involved: false,
		staff_involved: false,
		property_stolen: false,
		total_loss_value: null as number | null,
		injuries_reported: false,
	});

	readonly statusTarget = signal<PoliceReport | null>(null);
	readonly statusForm = signal({
		report_status: "under_investigation" as string,
		police_case_number: "",
		lead_investigator_name: "",
		follow_up_required: false,
		follow_up_date: "",
	});

	/** A report the police have not given a case number for cannot be traced back to them. */
	readonly awaitingCaseNumber = computed(() =>
		this.reports().filter(
			(report) => OPEN_STATUSES.has(report.report_status) && !report.police_case_number,
		),
	);

	readonly canSubmitForm = computed(() => {
		const f = this.form();
		return (
			f.incident_date.trim().length > 0 &&
			f.incident_description.trim().length > 0 &&
			f.agency_name.trim().length > 0
		);
	});

	readonly canSubmitStatus = computed(() => this.statusForm().report_status.trim().length > 0);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	labelFor(value: string | undefined): string {
		if (!value) return "—";
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	statusClass(status: string): string {
		switch (status) {
			case "charges_filed":
				return "badge badge-accent badge-sm";
			case "closed":
			case "no_action":
				return "badge badge-muted badge-sm";
			case "under_investigation":
			case "referred":
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
			if (status) params["report_status"] = status;
			const type = this.typeFilter().trim();
			if (type) params["incident_type"] = type;

			const res = await this.api.get<{ data: PoliceReport[] } | PoliceReport[]>(
				"/police-reports",
				params,
			);
			this.reports.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load police reports");
		} finally {
			this.loading.set(false);
		}
	}

	openFile(): void {
		this.editing.set(null);
		this.form.set({
			// Most reports are filed the same day as the incident.
			incident_date: new Date().toISOString().slice(0, 10),
			incident_time: "",
			incident_type: "theft",
			incident_description: "",
			incident_location: "",
			room_number: "",
			agency_name: "",
			agency_jurisdiction: "",
			agency_contact_number: "",
			responding_officer_name: "",
			responding_officer_badge: "",
			guest_involved: false,
			staff_involved: false,
			property_stolen: false,
			total_loss_value: null,
			injuries_reported: false,
		});
		this.filing.set(true);
	}

	openEdit(report: PoliceReport): void {
		this.editing.set(report);
		this.form.set({
			incident_date: report.incident_date.slice(0, 10),
			incident_time: report.incident_time ?? "",
			incident_type: report.incident_type ?? "other",
			incident_description: report.incident_description,
			incident_location: report.incident_location ?? "",
			room_number: report.room_number ?? "",
			agency_name: report.agency_name,
			agency_jurisdiction: "",
			agency_contact_number: "",
			responding_officer_name: report.responding_officer_name ?? "",
			responding_officer_badge: "",
			guest_involved: report.guest_involved ?? false,
			staff_involved: false,
			property_stolen: false,
			total_loss_value: null,
			injuries_reported: false,
		});
		this.filing.set(true);
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
			this.toast.error("Select a property before filing a report.");
			return;
		}

		const f = this.form();
		const body: Record<string, unknown> = {
			tenant_id: tenantId,
			incident_date: f.incident_date,
			incident_description: f.incident_description.trim(),
			agency_name: f.agency_name.trim(),
			incident_type: f.incident_type,
			guest_involved: f.guest_involved,
			staff_involved: f.staff_involved,
			property_stolen: f.property_stolen,
			injuries_reported: f.injuries_reported,
			...(f.incident_time ? { incident_time: f.incident_time } : {}),
			...(f.incident_location.trim() ? { incident_location: f.incident_location.trim() } : {}),
			...(f.room_number.trim() ? { room_number: f.room_number.trim() } : {}),
			...(f.agency_jurisdiction.trim()
				? { agency_jurisdiction: f.agency_jurisdiction.trim() }
				: {}),
			...(f.agency_contact_number.trim()
				? { agency_contact_number: f.agency_contact_number.trim() }
				: {}),
			...(f.responding_officer_name.trim()
				? { responding_officer_name: f.responding_officer_name.trim() }
				: {}),
			...(f.responding_officer_badge.trim()
				? { responding_officer_badge: f.responding_officer_badge.trim() }
				: {}),
			...(f.total_loss_value != null ? { total_loss_value: f.total_loss_value } : {}),
		};

		this.submitting.set(true);
		try {
			if (existing) {
				await this.api.put(`/police-reports/${existing.report_id}`, body);
				this.toast.success("Report corrected.");
			} else {
				await this.api.post("/police-reports", { ...body, property_id: propertyId });
				this.toast.success("Police report filed.");
			}
			this.filing.set(false);
			this.editing.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save police report");
		} finally {
			this.submitting.set(false);
		}
	}

	openStatus(report: PoliceReport): void {
		this.statusForm.set({
			report_status:
				report.report_status === "filed" ? "under_investigation" : report.report_status,
			police_case_number: report.police_case_number ?? "",
			lead_investigator_name: "",
			follow_up_required: false,
			follow_up_date: "",
		});
		this.statusTarget.set(report);
	}

	cancelStatus(): void {
		this.statusTarget.set(null);
	}

	async submitStatus(): Promise<void> {
		const report = this.statusTarget();
		const tenantId = this.auth.tenantId();
		if (!report || !tenantId || !this.canSubmitStatus() || this.submitting()) return;
		const f = this.statusForm();
		this.submitting.set(true);
		try {
			await this.api.post(`/police-reports/${report.report_id}/status`, {
				tenant_id: tenantId,
				report_status: f.report_status,
				...(f.police_case_number.trim() ? { police_case_number: f.police_case_number.trim() } : {}),
				...(f.lead_investigator_name.trim()
					? { lead_investigator_name: f.lead_investigator_name.trim() }
					: {}),
				follow_up_required: f.follow_up_required,
				...(f.follow_up_date ? { follow_up_date: f.follow_up_date } : {}),
			});
			this.toast.success("Report status updated.");
			this.statusTarget.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update status");
		} finally {
			this.submitting.set(false);
		}
	}
}
