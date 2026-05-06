import { Component, inject } from "@angular/core";
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
}
