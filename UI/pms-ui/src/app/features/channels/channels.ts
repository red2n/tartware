import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { SubmitOnEnterDirective } from "../../shared/forms/submit-on-enter.directive";
import { ToastService } from "../../shared/toast/toast.service";

/**
 * A live OTA or channel-manager connection: whether it is up, when it last
 * synced, and what broke.
 *
 * The reads and the four `integration.*` commands behind the actions here were
 * both built long before this screen — the commands simply had no REST wrapper
 * and nothing dispatched them, so a stale mapping or a failed push had no
 * operator-facing recovery. See ui-gaps/14-channel-distribution.md.
 */
type OtaConnection = {
	ota_connection_id: string;
	property_id?: string;
	property_name?: string;
	channel_code: string;
	channel_name: string;
	channel_type?: string;
	connection_status: string;
	connection_status_display: string;
	is_active: boolean;
	is_two_way_sync: boolean;
	last_sync_at?: string;
	last_sync_status?: string;
	last_sync_status_display?: string;
	last_error_message?: string;
	sync_frequency_minutes?: number;
	rooms_mapped?: number;
	rates_mapped?: number;
	pending_reservations?: number;
};

/**
 * The actual OTA connection record — credentials, endpoint, sync settings.
 *
 * Distinct from OtaConnection above, which is a projection of `channel_mappings`
 * despite the endpoint name. `integration.ota.content_sync` takes an
 * `ota_config_id` from *this* table, so content sync has to pick from here.
 */
type OtaConfiguration = {
	ota_config_id: string;
	property_id: string;
	ota_name: string;
	ota_code: string;
	has_credentials: boolean;
	is_active: boolean;
	sync_enabled: boolean;
};

type OtaSyncLog = {
	sync_log_id: string;
	sync_type: string;
	sync_direction: string;
	sync_status: string;
	sync_status_display: string;
	started_at: string;
	completed_at?: string;
	duration_ms?: number;
	records_processed?: number;
	records_created?: number;
	records_updated?: number;
	records_failed?: number;
	error_message?: string;
	triggered_by?: string;
};

const CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED", "PENDING", "ERROR", "SUSPENDED"] as const;

const CONTENT_TYPES = ["ALL", "PHOTOS", "DESCRIPTIONS", "AMENITIES", "POLICIES", "ROOM_TYPES"];

/** Sync outcomes that need someone to look at them. */
const FAILED_SYNC_STATUSES = new Set(["ERROR", "PARTIAL"]);

@Component({
	selector: "app-channels",
	standalone: true,
	imports: [DatePipe, FormsModule, IconComponent, PageHeaderComponent, SubmitOnEnterDirective],
	templateUrl: "./channels.html",
})
export class ChannelsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	readonly connectionStatuses = CONNECTION_STATUSES;
	readonly contentTypes = CONTENT_TYPES;

	readonly connections = signal<OtaConnection[]>([]);
	readonly configurations = signal<OtaConfiguration[]>([]);
	readonly loading = signal(false);
	readonly statusFilter = signal("");
	readonly submitting = signal(false);

	readonly historyFor = signal<OtaConnection | null>(null);
	readonly history = signal<OtaSyncLog[]>([]);
	readonly historyLoading = signal(false);
	readonly failedOnly = signal(false);

	/** Which command form is open, if any — they share one panel. */
	readonly action = signal<"rate-push" | "content-sync" | "webhook-retry" | null>(null);
	readonly actionTarget = signal<OtaConnection | null>(null);
	readonly ratePushForm = signal({ rate_plan_id: "", effective_from: "", effective_to: "" });
	readonly contentSyncForm = signal({ ota_config_id: "", content_types: "ALL" });
	readonly webhookRetryForm = signal({ subscription_id: "", event_id: "", reason: "" });

	/** A connection in ERROR, or one whose last sync failed, is the working queue. */
	readonly unhealthy = computed(() =>
		this.connections().filter(
			(c) =>
				c.connection_status === "ERROR" ||
				(c.last_sync_status != null && FAILED_SYNC_STATUSES.has(c.last_sync_status)),
		),
	);

	/**
	 * A connection with no mapped rooms or rates cannot sell, whatever its status
	 * says. Stale and missing mappings are the most common cause of channel
	 * failures, so they are surfaced before they produce a booking error.
	 */
	readonly unmapped = computed(() =>
		this.connections().filter((c) => c.is_active && (!c.rooms_mapped || !c.rates_mapped)),
	);

	readonly visibleHistory = computed(() =>
		this.failedOnly()
			? this.history().filter((h) => FAILED_SYNC_STATUSES.has(h.sync_status))
			: this.history(),
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

	statusClass(status: string | undefined): string {
		switch (status) {
			case "CONNECTED":
			case "SYNCED":
				return "badge badge-accent badge-sm";
			case "ERROR":
				return "badge badge-attention badge-sm";
			case "PENDING":
			case "SYNCING":
			case "PARTIAL":
				return "badge badge-warning badge-sm";
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
			if (status) params["connection_status"] = status;

			const [res, configRes] = await Promise.all([
				this.api.get<{ data: OtaConnection[] } | OtaConnection[]>("/ota-connections", params),
				this.api.get<{ data: OtaConfiguration[] } | OtaConfiguration[]>(
					"/ota-configurations",
					params,
				),
			]);
			this.connections.set(Array.isArray(res) ? res : (res?.data ?? []));
			this.configurations.set(Array.isArray(configRes) ? configRes : (configRes?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load channel connections");
		} finally {
			this.loading.set(false);
		}
	}

	async openHistory(connection: OtaConnection): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.historyFor.set(connection);
		this.history.set([]);
		this.historyLoading.set(true);
		try {
			const res = await this.api.get<{ data: OtaSyncLog[] } | OtaSyncLog[]>(
				`/ota-connections/${connection.ota_connection_id}/sync-history`,
				{ tenant_id: tenantId, limit: "100" },
			);
			this.history.set(Array.isArray(res) ? res : (res?.data ?? []));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load sync history");
		} finally {
			this.historyLoading.set(false);
		}
	}

	closeHistory(): void {
		this.historyFor.set(null);
		this.history.set([]);
	}

	openAction(kind: "rate-push" | "content-sync", connection: OtaConnection): void {
		this.actionTarget.set(connection);
		this.ratePushForm.set({ rate_plan_id: "", effective_from: "", effective_to: "" });
		// Match on channel code, not on the connection id: the ids come from
		// different tables, and passing a channel_mappings id as an ota_config_id
		// would target nothing.
		const match = this.configurations().find(
			(c) => c.ota_code.toUpperCase() === connection.channel_code.toUpperCase(),
		);
		this.contentSyncForm.set({ ota_config_id: match?.ota_config_id ?? "", content_types: "ALL" });
		this.action.set(kind);
	}

	/**
	 * Webhook retry is keyed on a subscription, not a channel connection — a failed
	 * delivery is not necessarily attributable to one — so it opens without a target.
	 */
	openWebhookRetry(): void {
		this.actionTarget.set(null);
		this.webhookRetryForm.set({ subscription_id: "", event_id: "", reason: "" });
		this.action.set("webhook-retry");
	}

	cancelAction(): void {
		this.action.set(null);
		this.actionTarget.set(null);
	}

	/**
	 * Commands are dispatched through the gateway's REST wrappers, which answer
	 * 202 — the work happens on the bus, so the screen reports acceptance and the
	 * operator refreshes to see the result rather than being shown a fake success.
	 */
	private async dispatch(path: string, body: Record<string, unknown>, done: string): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || this.submitting()) return;
		this.submitting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/channels/${path}`, body);
			this.toast.success(done);
			this.cancelAction();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Command was not accepted");
		} finally {
			this.submitting.set(false);
		}
	}

	async syncNow(connection: OtaConnection): Promise<void> {
		const propertyId = connection.property_id ?? this.ctx.propertyId();
		if (!propertyId) {
			this.toast.error("Select a property before triggering a sync.");
			return;
		}
		await this.dispatch(
			"sync",
			{ property_id: propertyId, ota_code: connection.channel_code },
			`Sync requested for ${connection.channel_name}.`,
		);
	}

	async submitRatePush(): Promise<void> {
		const connection = this.actionTarget();
		const propertyId = connection?.property_id ?? this.ctx.propertyId();
		if (!connection || !propertyId) return;
		const f = this.ratePushForm();
		await this.dispatch(
			"rate-push",
			{
				property_id: propertyId,
				ota_code: connection.channel_code,
				...(f.rate_plan_id.trim() ? { rate_plan_id: f.rate_plan_id.trim() } : {}),
				...(f.effective_from ? { effective_from: f.effective_from } : {}),
				...(f.effective_to ? { effective_to: f.effective_to } : {}),
			},
			`Rate push queued for ${connection.channel_name}.`,
		);
	}

	async submitContentSync(): Promise<void> {
		const connection = this.actionTarget();
		const propertyId = connection?.property_id ?? this.ctx.propertyId();
		if (!connection || !propertyId) return;
		const f = this.contentSyncForm();
		if (!f.ota_config_id) {
			this.toast.error(
				`No OTA configuration found for ${connection.channel_code}. Content sync needs one.`,
			);
			return;
		}
		await this.dispatch(
			"content-sync",
			{
				property_id: propertyId,
				ota_config_id: f.ota_config_id,
				content_types: [f.content_types],
			},
			`Content sync queued for ${connection.channel_name}.`,
		);
	}

	async submitWebhookRetry(): Promise<void> {
		const f = this.webhookRetryForm();
		if (!f.subscription_id.trim()) return;
		await this.dispatch(
			"webhook-retry",
			{
				subscription_id: f.subscription_id.trim(),
				...(f.event_id.trim() ? { event_id: f.event_id.trim() } : {}),
				...(f.reason.trim() ? { reason: f.reason.trim() } : {}),
			},
			"Webhook retry queued.",
		);
	}
}
