import { Injectable } from "@angular/core";
import { generateUUID } from "../../shared/uuid-utils";

const API_BASE = "/v1";

export interface ApiFieldError {
	path: string;
	message: string;
	code?: string;
}

export class ApiValidationError extends Error {
	readonly fieldErrors: ApiFieldError[];
	constructor(message: string, fieldErrors: ApiFieldError[]) {
		super(message);
		this.name = "ApiValidationError";
		this.fieldErrors = fieldErrors;
	}
}

/**
 * A feature the property has not bought. Screens show this as a callout rather
 * than an error line, so the parts are carried separately instead of being
 * baked into one sentence a template would have to take apart again.
 * `message` stays the whole thing for toasts and logs.
 */
export class ModuleNotEnabledError extends Error {
	/** Registry ids the server rejected — what a request to enable is raised against. */
	readonly moduleIds: string[];
	/** Display names, as printed on the Modules screen. Empty if unrecognised. */
	readonly moduleNames: string[];
	/** Headline — what is switched off. */
	readonly title: string;
	/** Why the screen is empty. */
	readonly detail: string;
	/** How to get it switched on. */
	readonly action: string;

	constructor(parts: {
		moduleIds: string[];
		moduleNames: string[];
		title: string;
		detail: string;
		action: string;
	}) {
		super(`${parts.title}. ${parts.action}`);
		this.name = "ModuleNotEnabledError";
		this.moduleIds = parts.moduleIds;
		this.moduleNames = parts.moduleNames;
		this.title = parts.title;
		this.detail = parts.detail;
		this.action = parts.action;
	}
}

@Injectable({ providedIn: "root" })
export class ApiService {
	private buildUrl(path: string, params?: Record<string, string>): string {
		const url = new URL(`${API_BASE}${path}`, window.location.origin);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}
		}
		return url.toString();
	}

	private getHeaders(): HeadersInit {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		const token = localStorage.getItem("access_token");
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}
		return headers;
	}

	/** Write headers — same as getHeaders() plus a fresh UUID idempotency key. */
	private getWriteHeaders(): HeadersInit {
		return {
			...(this.getHeaders() as Record<string, string>),
			"Idempotency-Key": generateUUID(),
		};
	}

	async get<T>(path: string, params?: Record<string, string>): Promise<T> {
		const response = await fetch(this.buildUrl(path, params), {
			method: "GET",
			headers: this.getHeaders(),
		});
		if (!response.ok) {
			throw await this.handleError(response);
		}
		return response.json();
	}

	async post<T>(path: string, body?: unknown): Promise<T> {
		const response = await fetch(this.buildUrl(path), {
			method: "POST",
			headers: this.getWriteHeaders(),
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!response.ok) {
			throw await this.handleError(response);
		}
		return response.json();
	}

	async put<T>(path: string, body: unknown, params?: Record<string, string>): Promise<T> {
		const response = await fetch(this.buildUrl(path, params), {
			method: "PUT",
			headers: this.getWriteHeaders(),
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			throw await this.handleError(response);
		}
		return response.json();
	}

	async patch<T>(path: string, body: unknown, params?: Record<string, string>): Promise<T> {
		const response = await fetch(this.buildUrl(path, params), {
			method: "PATCH",
			headers: this.getWriteHeaders(),
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			throw await this.handleError(response);
		}
		return response.json();
	}

	async delete(path: string, body?: unknown): Promise<void> {
		const response = await fetch(this.buildUrl(path), {
			method: "DELETE",
			headers: this.getWriteHeaders(),
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!response.ok) {
			throw await this.handleError(response);
		}
	}

	/**
	 * The server rejects by module id ("analytics-bi"); staff only ever see the
	 * names printed on the Modules screen, so the ids never reach the message.
	 */
	private static readonly MODULE_LABELS: Record<string, string> = {
		core: "Core / Base",
		"finance-automation": "Finance & Automation",
		"tenant-owner-portal": "Tenant & Owner Portal",
		"facility-maintenance": "Facility & Maintenance",
		"analytics-bi": "Analytics & BI",
		"marketing-channel": "Marketing & Channel Management",
		"enterprise-api": "Enterprise & API",
	};

	/**
	 * Backend error codes surface raw in the UI otherwise — "TENANT_MODULE_NOT_ENABLED"
	 * tells a front-desk user nothing and hides the fact that an admin can fix it
	 * from the Modules screen.
	 */
	private static readonly ERROR_CODE_MESSAGES: Record<string, string> = {
		TENANT_ACCESS_DENIED: "You don't have access to this property.",
		TENANT_INACTIVE: "This property is inactive. Contact your administrator.",
	};

	private static moduleNotEnabledError(missingModules: unknown): ModuleNotEnabledError {
		// An id we have no name for would read as jargon, so it is dropped and the
		// callout falls back to the generic wording — and, having no name to show,
		// it is not offered as something to request either.
		const ids = (Array.isArray(missingModules) ? missingModules : [])
			.filter((id): id is string => typeof id === "string")
			.filter((id) => Boolean(ApiService.MODULE_LABELS[id]));
		const names = ids.map((id) => ApiService.MODULE_LABELS[id]);

		const subject =
			names.length === 0
				? null
				: names.length === 1
					? names[0]
					: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

		return new ModuleNotEnabledError({
			moduleIds: ids,
			moduleNames: names,
			title: subject
				? `${subject} ${names.length > 1 ? "aren't" : "isn't"} switched on`
				: "This feature isn't switched on",
			detail: subject
				? `This screen needs ${subject}, which your property hasn't switched on yet.`
				: "This screen needs a feature your property hasn't switched on yet.",
			action:
				"An administrator at your property can switch it on under Settings → Modules. Everything here starts working as soon as they do.",
		});
	}

	private async handleError(response: Response): Promise<Error> {
		let message = `HTTP ${response.status}`;
		try {
			const body = await response.json();
			const code = body.detail || body.message || message;
			// The server names the entitlements it rejected; naming them keeps the
			// admin from having to guess which one to switch on.
			if (code === "TENANT_MODULE_NOT_ENABLED") {
				return ApiService.moduleNotEnabledError(body.missingModules);
			}
			message = ApiService.ERROR_CODE_MESSAGES[code] ?? code;
			if (Array.isArray(body.errors) && body.errors.length > 0) {
				return new ApiValidationError(message, body.errors);
			}
		} catch {
			// ignore parse errors
		}

		if (response.status === 401) {
			window.dispatchEvent(new CustomEvent("auth:unauthorized"));
		}

		return new Error(message);
	}
}
