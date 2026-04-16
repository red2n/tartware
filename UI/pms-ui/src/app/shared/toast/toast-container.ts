import { Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { ToastService } from "./toast.service";

@Component({
	selector: "app-toast-container",
	standalone: true,
	imports: [MatIconModule, TranslatePipe],
	templateUrl: "./toast-container.html",
	styleUrl: "./toast-container.scss",
})
export class ToastContainerComponent {
	readonly toast = inject(ToastService);
}
