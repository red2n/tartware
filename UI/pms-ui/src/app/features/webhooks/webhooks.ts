import { DatePipe } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { WebhookDeliveryRow, WebhookSubscriptions } from "@tartware/schemas";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { ToastService } from "../../shared/toast/toast.service";

type WebhookSubscription = WebhookSubscriptions;

type WebhookListResponse =
	| { data?: WebhookSubscription[]; items?: WebhookSubscription[] }
	| WebhookSubscription[];

type WebhookDelivery = WebhookDeliveryRow;

type DeliveryListResponse =
	| { data?: WebhookDelivery[]; items?: WebhookDelivery[] }
	| WebhookDelivery[];

type WebhookForm = {
	webhook_name: string;
	webhook_url: string;
	event_types_csv: string;
	http_method: string;
	authentication_type: string;
	is_active: boolean;
};

const DEFAULT_FORM: WebhookForm = {
	webhook_name: "",
	webhook_url: "",
	event_types_csv: "",
	http_method: "POST",
	authentication_type: "NONE",
	is_active: true,
};

@Component({
	selector: "app-webhooks",
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
	templateUrl: "./webhooks.html",
	styleUrl: "./webhooks.scss",
})
export class WebhooksComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly toast = inject(ToastService);

	readonly subscriptions = signal<WebhookSubscription[]>([]);
	readonly loading = signal(false);
	readonly processing = signal<string | null>(null);

	readonly showCreate = signal(false);
	readonly editingId = signal<string | null>(null);
	readonly form = signal<WebhookForm>({ ...DEFAULT_FORM });

	readonly deliveriesFor = signal<string | null>(null);
	readonly deliveries = signal<WebhookDelivery[]>([]);
	readonly loadingDeliveries = signal(false);

	readonly hasSubscriptions = computed(() => this.subscriptions().length > 0);

	constructor() {
		effect(() => {
			if (this.auth.tenantId()) this.load();
		});
	}

	private tenantUrl(suffix = ""): string | null {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return null;
		return `/tenants/${tenantId}/webhooks${suffix}`;
	}

	async load(): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		this.loading.set(true);
		try {
			const res = await this.api.get<WebhookListResponse>(url);
			const list = Array.isArray(res) ? res : (res.data ?? res.items ?? []);
			this.subscriptions.set(list);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load webhooks");
		} finally {
			this.loading.set(false);
		}
	}

	openCreate(): void {
		this.editingId.set(null);
		this.form.set({ ...DEFAULT_FORM });
		this.showCreate.set(true);
	}

	openEdit(w: WebhookSubscription): void {
		this.editingId.set(w.subscription_id);
		this.form.set({
			webhook_name: w.webhook_name,
			webhook_url: w.webhook_url,
			event_types_csv: (w.event_types ?? []).join(", "),
			http_method: w.http_method ?? "POST",
			authentication_type: w.authentication_type ?? "NONE",
			is_active: w.is_active ?? true,
		});
		this.showCreate.set(true);
	}

	cancelForm(): void {
		this.showCreate.set(false);
		this.editingId.set(null);
	}

	updateForm<K extends keyof WebhookForm>(key: K, value: WebhookForm[K]): void {
		this.form.set({ ...this.form(), [key]: value });
	}

	async submitForm(): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		const f = this.form();
		if (!f.webhook_name.trim() || !f.webhook_url.trim()) {
			this.toast.error("Name and URL are required.");
			return;
		}
		const eventTypes = f.event_types_csv
			.split(",")
			.map((e) => e.trim())
			.filter(Boolean);
		if (eventTypes.length === 0) {
			this.toast.error("At least one event type is required.");
			return;
		}
		const payload: Record<string, unknown> = {
			webhook_name: f.webhook_name.trim(),
			webhook_url: f.webhook_url.trim(),
			event_types: eventTypes,
			http_method: f.http_method,
			authentication_type: f.authentication_type,
			is_active: f.is_active,
		};
		const editingId = this.editingId();
		this.processing.set(editingId ?? "create");
		try {
			if (editingId) {
				await this.api.put(`${url}/${editingId}`, payload);
				this.toast.success("Webhook update dispatched.");
			} else {
				await this.api.post(url, payload);
				this.toast.success("Webhook create dispatched.");
			}
			this.showCreate.set(false);
			this.editingId.set(null);
			setTimeout(() => this.load(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to save webhook");
		} finally {
			this.processing.set(null);
		}
	}

	async deleteWebhook(w: WebhookSubscription): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		if (!confirm(`Delete webhook "${w.webhook_name}"?`)) return;
		this.processing.set(w.subscription_id);
		try {
			await this.api.delete(`${url}/${w.subscription_id}`);
			this.toast.success("Webhook delete dispatched.");
			setTimeout(() => this.load(), 1200);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to delete webhook");
		} finally {
			this.processing.set(null);
		}
	}

	async rotateSecret(w: WebhookSubscription): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		if (!confirm(`Rotate signing secret for "${w.webhook_name}"?`)) return;
		this.processing.set(`rotate-${w.subscription_id}`);
		try {
			await this.api.post(`${url}/${w.subscription_id}/rotate-secret`, {});
			this.toast.success("Secret rotation dispatched.");
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to rotate secret");
		} finally {
			this.processing.set(null);
		}
	}

	async sendTest(w: WebhookSubscription): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		this.processing.set(`test-${w.subscription_id}`);
		try {
			await this.api.post(`${url}/${w.subscription_id}/test`, {});
			this.toast.success("Test event sent.");
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to send test event");
		} finally {
			this.processing.set(null);
		}
	}

	async replayFailures(w: WebhookSubscription): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		if (!confirm(`Replay failed deliveries for "${w.webhook_name}"?`)) return;
		this.processing.set(`replay-${w.subscription_id}`);
		try {
			await this.api.post(`${url}/${w.subscription_id}/replay`, {});
			this.toast.success("Replay dispatched.");
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to replay deliveries");
		} finally {
			this.processing.set(null);
		}
	}

	async showDeliveries(w: WebhookSubscription): Promise<void> {
		const url = this.tenantUrl();
		if (!url) return;
		this.deliveriesFor.set(w.subscription_id);
		this.deliveries.set([]);
		this.loadingDeliveries.set(true);
		try {
			const res = await this.api.get<DeliveryListResponse>(
				`${url}/${w.subscription_id}/deliveries`,
			);
			const list = Array.isArray(res) ? res : (res.data ?? res.items ?? []);
			this.deliveries.set(list);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to load deliveries");
		} finally {
			this.loadingDeliveries.set(false);
		}
	}

	closeDeliveries(): void {
		this.deliveriesFor.set(null);
		this.deliveries.set([]);
	}
}
