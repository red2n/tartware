import { Component, computed, inject } from "@angular/core";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../components/icon/icon";
import { ToastService } from "./toast.service";

@Component({
	selector: "app-toast-container",
	standalone: true,
	imports: [IconComponent, TranslatePipe],
	templateUrl: "./toast-container.html",
	styleUrl: "./toast-container.scss",
})
export class ToastContainerComponent {
	readonly toast = inject(ToastService);

	/** Successes announce politely — they can wait for a pause in speech. */
	readonly politeToasts = computed(() => this.toast.toasts().filter((t) => t.type === "success"));

	/** Failures interrupt: a 4s auto-dismiss can outrun a polite queue. */
	readonly errorToasts = computed(() => this.toast.toasts().filter((t) => t.type === "error"));
}
