import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { IconComponent } from "../../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../../shared/toast/toast.service";

/**
 * Row shape of GET /v1/compliance/breach-incidents. The list already carries
 * `notification_deadline` and the two notified flags, so the 72-hour clock is the
 * server's, not something this screen recomputes from `discovered_at`.
 */
type BreachIncident = {
	incident_id: string;
	property_id: string | null;
	incident_title: string;
	severity: string;
	breach_type: string;
	status: string;
	discovered_at: string;
	notification_deadline: string | null;
	authority_notified: boolean | null;
	subjects_notified: boolean | null;
	subjects_affected_count: number | null;
	assigned_to: string | null;
	created_at: string;
	updated_at: string | null;
};

/** Detail adds the narrative fields the list omits. */
type BreachIncidentDetail = BreachIncident & {
	incident_description?: string;
	occurred_at?: string | null;
	data_categories_affected?: string[] | null;
	systems_affected?: string[] | null;
	authority_reference?: string | null;
	notification_notes?: string | null;
};

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const BREACH_TYPES = [
	"unauthorized_access",
	"data_loss",
	"data_theft",
	"system_compromise",
	"phishing",
	"insider_threat",
	"ransomware",
	"accidental_disclosure",
	"other",
] as const;

const STATUSES = [
	"reported",
	"investigating",
	"contained",
	"notifying",
	"remediated",
	"closed",
	"escalated",
] as const;

const HOUR_MS = 60 * 60 * 1000;

@Component({
	selector: "app-breach-incidents",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./breach-incidents.html",
	styleUrl: "./breach-incidents.scss",
})
export class BreachIncidentsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	readonly severities = SEVERITIES;
	readonly breachTypes = BREACH_TYPES;
	readonly statuses = STATUSES;

	readonly incidents = signal<BreachIncident[]>([]);
	readonly loading = signal(false);
	readonly severityFilter = signal("");
	readonly statusFilter = signal("");
	readonly unnotifiedOnly = signal(false);

	readonly selected = signal<BreachIncidentDetail | null>(null);
	readonly loadingDetail = signal(false);

	readonly reporting = signal(false);
	readonly submitting = signal(false);
	readonly reportForm = signal({
		incident_title: "",
		incident_description: "",
		severity: "high" as string,
		breach_type: "unauthorized_access" as string,
		discovered_at: "",
		occurred_at: "",
		data_categories_affected: "",
		systems_affected: "",
		subjects_affected_count: null as number | null,
	});

	readonly notifying = signal<BreachIncident | null>(null);
	readonly notifyForm = signal({
		authority_reference: "",
		notify_subjects: false,
		notification_notes: "",
	});

	/**
	 * GDPR Art. 33 gives 72 hours from becoming aware of a breach to notify the
	 * supervisory authority. An incident past its deadline with no authority
	 * notification recorded is the one state this screen exists to make impossible
	 * to miss, so it sorts to the top and is counted in the header.
	 */
	readonly overdue = computed(() =>
		this.incidents().filter((incident) => this.isOverdue(incident)),
	);

	readonly visible = computed(() => {
		const rows = this.unnotifiedOnly()
			? this.incidents().filter((incident) => !incident.authority_notified)
			: this.incidents();

		// Overdue first, then nearest deadline, then newest discovery.
		return [...rows].sort((a, b) => {
			const overdueDelta = Number(this.isOverdue(b)) - Number(this.isOverdue(a));
			if (overdueDelta !== 0) return overdueDelta;
			const deadlineA = a.notification_deadline ? Date.parse(a.notification_deadline) : Infinity;
			const deadlineB = b.notification_deadline ? Date.parse(b.notification_deadline) : Infinity;
			if (deadlineA !== deadlineB) return deadlineA - deadlineB;
			return Date.parse(b.discovered_at) - Date.parse(a.discovered_at);
		});
	});

	readonly canSubmitReport = computed(() => {
		const f = this.reportForm();
		return (
			f.incident_title.trim().length > 0 &&
			f.incident_description.trim().length > 0 &&
			f.discovered_at.trim().length > 0
		);
	});

	/** An authority reference is the proof the filing happened; do not accept a blank one. */
	readonly canSubmitNotify = computed(
		() => this.notifyForm().authority_reference.trim().length > 0,
	);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	isOverdue(incident: BreachIncident): boolean {
		if (incident.authority_notified) return false;
		if (!incident.notification_deadline) return false;
		return Date.parse(incident.notification_deadline) < Date.now();
	}

	/** Hours left against the deadline; negative once it has passed. */
	hoursRemaining(incident: BreachIncident): number | null {
		if (!incident.notification_deadline) return null;
		return Math.round((Date.parse(incident.notification_deadline) - Date.now()) / HOUR_MS);
	}

	deadlineLabel(incident: BreachIncident): string {
		if (incident.authority_notified) return "Notified";
		const hours = this.hoursRemaining(incident);
		if (hours === null) return "No deadline recorded";
		if (hours < 0) return `Overdue by ${Math.abs(hours)}h`;
		return `${hours}h remaining`;
	}

	/** Map onto the shared badge palette rather than inventing severity colours. */
	severityClass(severity: string): string {
		switch (severity.toLowerCase()) {
			case "critical":
				return "badge badge-danger badge-sm";
			case "high":
				return "badge badge-attention badge-sm";
			case "medium":
				return "badge badge-warning badge-sm";
			default:
				return "badge badge-muted badge-sm";
		}
	}

	labelFor(value: string): string {
		return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	async load(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const severity = this.severityFilter().trim();
			if (severity) params["severity"] = severity;
			const status = this.statusFilter().trim();
			if (status) params["status"] = status;

			const res = await this.api.get<{ data: BreachIncident[] } | BreachIncident[]>(
				"/compliance/breach-incidents",
				params,
			);
			this.incidents.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load breach incidents");
		} finally {
			this.loading.set(false);
		}
	}

	async openDetail(incident: BreachIncident): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		// Show what the list already knows while the narrative loads.
		this.selected.set(incident);
		this.loadingDetail.set(true);
		try {
			const res = await this.api.get<{ data?: BreachIncidentDetail } | BreachIncidentDetail>(
				`/compliance/breach-incidents/${incident.incident_id}`,
				{ tenant_id: tenantId },
			);
			const detail =
				(res as { data?: BreachIncidentDetail })?.data ?? (res as BreachIncidentDetail);
			if (detail?.incident_id) this.selected.set(detail);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load incident detail");
		} finally {
			this.loadingDetail.set(false);
		}
	}

	closeDetail(): void {
		this.selected.set(null);
	}

	openReport(): void {
		// Default the discovery moment to now — the 72-hour clock starts here, and a
		// blank field invites a wrong backdated value.
		this.reportForm.set({
			incident_title: "",
			incident_description: "",
			severity: "high",
			breach_type: "unauthorized_access",
			discovered_at: this.toLocalInput(new Date()),
			occurred_at: "",
			data_categories_affected: "",
			systems_affected: "",
			subjects_affected_count: null,
		});
		this.reporting.set(true);
	}

	cancelReport(): void {
		this.reporting.set(false);
	}

	async submitReport(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmitReport() || this.submitting()) return;
		const f = this.reportForm();
		this.submitting.set(true);
		try {
			await this.api.post("/compliance/breach-incidents", {
				tenant_id: tenantId,
				incident_title: f.incident_title.trim(),
				incident_description: f.incident_description.trim(),
				severity: f.severity,
				breach_type: f.breach_type,
				discovered_at: new Date(f.discovered_at).toISOString(),
				...(f.occurred_at ? { occurred_at: new Date(f.occurred_at).toISOString() } : {}),
				...(this.splitList(f.data_categories_affected).length
					? { data_categories_affected: this.splitList(f.data_categories_affected) }
					: {}),
				...(this.splitList(f.systems_affected).length
					? { systems_affected: this.splitList(f.systems_affected) }
					: {}),
				...(f.subjects_affected_count != null
					? { subjects_affected_count: f.subjects_affected_count }
					: {}),
			});
			this.toast.success("Breach incident recorded. The 72-hour notification clock has started.");
			this.reporting.set(false);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record breach incident");
		} finally {
			this.submitting.set(false);
		}
	}

	openNotify(incident: BreachIncident): void {
		this.notifyForm.set({
			authority_reference: "",
			notify_subjects: false,
			notification_notes: "",
		});
		this.notifying.set(incident);
	}

	cancelNotify(): void {
		this.notifying.set(null);
	}

	async submitNotify(): Promise<void> {
		const incident = this.notifying();
		const tenantId = this.auth.tenantId();
		if (!incident || !tenantId || !this.canSubmitNotify() || this.submitting()) return;
		const f = this.notifyForm();
		this.submitting.set(true);
		try {
			await this.api.put(`/compliance/breach-incidents/${incident.incident_id}/notify`, {
				tenant_id: tenantId,
				authority_reference: f.authority_reference.trim(),
				notify_subjects: f.notify_subjects,
				...(f.notification_notes.trim() ? { notification_notes: f.notification_notes.trim() } : {}),
			});
			this.toast.success("Regulator notification recorded.");
			this.notifying.set(null);
			this.selected.set(null);
			await this.load();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to record notification");
		} finally {
			this.submitting.set(false);
		}
	}

	private splitList(value: string): string[] {
		return value
			.split(",")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
	}

	/** `datetime-local` wants local wall-clock, not the ISO/UTC string. */
	private toLocalInput(date: Date): string {
		const offset = date.getTimezoneOffset() * 60 * 1000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 16);
	}
}
