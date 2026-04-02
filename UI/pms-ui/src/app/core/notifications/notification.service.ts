import { computed, Injectable, inject, type OnDestroy, signal } from "@angular/core";
import type {
	NotificationItem,
	NotificationListResponse,
	UnreadCountPayload,
} from "@tartware/schemas";
import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";

/** Category → Material icon mapping */
const CATEGORY_ICONS: Record<string, string> = {
	reservation: "book_online",
	checkin: "login",
	checkout: "logout",
	payment: "payments",
	housekeeping: "cleaning_services",
	maintenance: "build",
	rate: "trending_up",
	guest: "person",
	system: "settings",
	info: "info",
	alert: "warning",
};

@Injectable({ providedIn: "root" })
export class NotificationService implements OnDestroy {
	private readonly auth = inject(AuthService);
	private readonly api = inject(ApiService);

	private eventSource: EventSource | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private readonly MAX_RECONNECT_DELAY = 30_000;

	/** All loaded notifications */
	private readonly _notifications = signal<NotificationItem[]>([]);
	readonly notifications = this._notifications.asReadonly();

	/** Unread count (updated via SSE + REST) */
	private readonly _unreadCount = signal(0);
	readonly unreadCount = this._unreadCount.asReadonly();

	/** Whether the notification panel is open */
	private readonly _panelOpen = signal(false);
	readonly panelOpen = this._panelOpen.asReadonly();

	/** Loading state */
	private readonly _loading = signal(false);
	readonly loading = this._loading.asReadonly();

	/** Whether SSE is connected */
	private readonly _connected = signal(false);
	readonly connected = this._connected.asReadonly();

	/** Unread notifications only */
	readonly unreadNotifications = computed(() => this._notifications().filter((n) => !n.is_read));

	/** Get the Material icon for a notification category */
	static categoryIcon(category: string): string {
		return CATEGORY_ICONS[category] ?? "notifications";
	}

	/** Connect to the SSE stream and load initial notifications */
	connect(): void {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loadNotifications();
		this.connectSSE(tenantId);
	}

	/** Disconnect from SSE */
	disconnect(): void {
		this.closeSSE();
		this._notifications.set([]);
		this._unreadCount.set(0);
		this._connected.set(false);
	}

	/** Toggle the notification panel */
	togglePanel(): void {
		this._panelOpen.update((v) => !v);
		if (this._panelOpen()) {
			this.loadNotifications();
		}
	}

	/** Close the panel */
	closePanel(): void {
		this._panelOpen.set(false);
	}

	/** Mark specific notifications as read */
	async markAsRead(notificationIds: string[]): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || notificationIds.length === 0) return;

		try {
			await this.api.put(`/tenants/${tenantId}/in-app-notifications/read`, {
				notification_ids: notificationIds,
			});

			// Optimistically update local state
			this._notifications.update((list) =>
				list.map((n) =>
					notificationIds.includes(n.notification_id)
						? { ...n, is_read: true, read_at: new Date().toISOString() }
						: n,
				),
			);
			this._unreadCount.update((c) => Math.max(0, c - notificationIds.length));
		} catch {
			// Silently fail — SSE will sync the count
		}
	}

	/** Mark all notifications as read */
	async markAllAsRead(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			await this.api.put(`/tenants/${tenantId}/in-app-notifications/read-all`, {});

			this._notifications.update((list) =>
				list.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
			);
			this._unreadCount.set(0);
		} catch {
			// Silently fail
		}
	}

	/** Load notifications from REST API */
	async loadNotifications(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this._loading.set(true);
		try {
			const response = await this.api.get<NotificationListResponse>(
				`/tenants/${tenantId}/in-app-notifications`,
				{ limit: "50" },
			);
			this._notifications.set(response.data);
			this._unreadCount.set(response.meta.unread);
		} catch {
			// Silently fail
		} finally {
			this._loading.set(false);
		}
	}

	/** Connect to the SSE stream for real-time updates */
	private connectSSE(tenantId: string): void {
		this.closeSSE();

		const token = localStorage.getItem("access_token");
		if (!token) return;

		// EventSource doesn't support custom headers, so we pass the token as a query param
		// The gateway/service should accept this as an alternative to the Authorization header
		const url = `/v1/tenants/${tenantId}/in-app-notifications/stream?token=${encodeURIComponent(token)}`;

		this.eventSource = new EventSource(url);

		this.eventSource.onopen = () => {
			this._connected.set(true);
			this.reconnectAttempts = 0;
		};

		this.eventSource.addEventListener("notification", (event) => {
			try {
				const notification = JSON.parse(event.data) as NotificationItem;
				// Prepend new notification to the list
				this._notifications.update((list) => [notification, ...list]);
				this._unreadCount.update((c) => c + 1);
			} catch {
				// Invalid data, ignore
			}
		});

		this.eventSource.addEventListener("unread_count", (event) => {
			try {
				const { unread } = JSON.parse(event.data) as UnreadCountPayload;
				this._unreadCount.set(unread);
			} catch {
				// Invalid data, ignore
			}
		});

		this.eventSource.onerror = () => {
			this._connected.set(false);
			this.closeSSE();
			this.scheduleReconnect(tenantId);
		};
	}

	/** Schedule a reconnection with exponential backoff */
	private scheduleReconnect(tenantId: string): void {
		if (this.reconnectTimer) return;

		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.MAX_RECONNECT_DELAY);
		this.reconnectAttempts++;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (this.auth.isAuthenticated()) {
				this.connectSSE(tenantId);
			}
		}, delay);
	}

	/** Close the SSE connection */
	private closeSSE(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	ngOnDestroy(): void {
		this.disconnect();
	}
}
