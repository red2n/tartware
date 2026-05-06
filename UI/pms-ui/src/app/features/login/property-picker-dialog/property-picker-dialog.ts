import { Component, inject } from "@angular/core";
import type { Property } from "@tartware/schemas";
import { DynamicDialogConfig, DynamicDialogModule, DynamicDialogRef } from "primeng/dynamicdialog";
import { IconComponent } from "../../../shared/components/icon/icon";

type PropertyItem = Pick<Property, "id" | "property_name" | "property_code">;

export interface PropertyPickerData {
	properties: PropertyItem[];
	tenantName?: string;
}

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
@Component({
	selector: "app-property-picker-dialog",
	standalone: true,
	imports: [DynamicDialogModule, IconComponent, TranslatePipe],
	templateUrl: "./property-picker-dialog.html",
})
export class PropertyPickerDialogComponent {
	private readonly dialogRef = inject(DynamicDialogRef);
	readonly data: PropertyPickerData = inject(DynamicDialogConfig).data;

	select(property: PropertyItem): void {
		this.dialogRef.close(property.id);
	}
}
