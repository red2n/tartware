import { Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import {
	GUEST_TITLES,
	LOYALTY_TIERS,
	NATIONALITIES,
	VIP_STATUSES,
} from "../../../shared/guest-constants";

@Component({
	selector: "app-guest-form-fields",
	standalone: true,
	imports: [FormsModule, MatIconModule],
	templateUrl: "./guest-form-fields.html",
})
export class GuestFormFieldsComponent {
	readonly idPrefix = input.required<string>();
	readonly saving = input.required<boolean>();
	readonly fieldErrors = input.required<Record<string, string>>();
	readonly touched = input.required<Record<string, boolean>>();

	readonly firstName = input.required<string>();
	readonly lastName = input.required<string>();
	readonly email = input.required<string>();
	readonly title = input.required<string>();
	readonly phone = input.required<string>();
	readonly nationality = input.required<string>();
	readonly gender = input.required<string>();
	readonly dateOfBirth = input.required<string>();
	readonly companyName = input.required<string>();
	readonly vipStatus = input.required<string>();
	readonly loyaltyTier = input.required<string>();

	readonly emailError = input.required<string | null>();
	readonly phoneError = input.required<string | null>();

	readonly firstNameChange = output<string>();
	readonly lastNameChange = output<string>();
	readonly emailChange = output<string>();
	readonly titleChange = output<string>();
	readonly phoneChange = output<string>();
	readonly nationalityChange = output<string>();
	readonly genderChange = output<string>();
	readonly dateOfBirthChange = output<string>();
	readonly companyNameChange = output<string>();
	readonly vipStatusChange = output<string>();
	readonly loyaltyTierChange = output<string>();

	readonly markTouched = output<string>();

	readonly titles = GUEST_TITLES;
	readonly vipStatuses = VIP_STATUSES;
	readonly loyaltyTiers = LOYALTY_TIERS;
	readonly nationalities = NATIONALITIES;

	hasFieldError(field: string): boolean {
		return !!this.fieldErrors()[field];
	}

	getFieldError(field: string): string {
		return this.fieldErrors()[field] ?? "";
	}
}
