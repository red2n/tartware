import { Injectable, signal } from "@angular/core";

export interface Toast {
	id: number;
	type: "success" | "error";
	message: string;
}

@Injectable({ providedIn: "root" })
export class ToastService {
	private nextId = 0;
	readonly toasts = signal<Toast[]>([]);

	/** Default auto-dismiss duration in ms. */
	private readonly AUTO_DISMISS_MS = 4000;

	success(message: string): void {
		this.add("success", message);
	}

	error(message: string): void {
		this.add("error", message);
	}

	dismiss(id: number): void {
		this.toasts.update((list) => list.filter((t) => t.id !== id));
	}

	private add(type: Toast["type"], message: string): void {
		const id = this.nextId++;
		this.toasts.update((list) => [...list, { id, type, message }]);
		setTimeout(() => this.dismiss(id), this.AUTO_DISMISS_MS);
	}
}
