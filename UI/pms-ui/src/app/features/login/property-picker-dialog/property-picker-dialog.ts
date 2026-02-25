import { Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";

import type { Property } from "@tartware/schemas";

type PropertyItem = Pick<Property, "id" | "property_name" | "property_code">;

export interface PropertyPickerData {
	properties: PropertyItem[];
	tenantName?: string;
}

@Component({
	selector: "app-property-picker-dialog",
	standalone: true,
	imports: [MatButtonModule, MatDialogModule, MatIconModule],
	templateUrl: "./property-picker-dialog.html",
})
export class PropertyPickerDialogComponent {
	private readonly dialogRef = inject(MatDialogRef<PropertyPickerDialogComponent>);
	readonly data: PropertyPickerData = inject(MAT_DIALOG_DATA);

	select(property: PropertyItem): void {
		this.dialogRef.close(property.id);
	}
}
