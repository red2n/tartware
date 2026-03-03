import {
	type AfterViewInit,
	Component,
	computed,
	type ElementRef,
	inject,
	NgZone,
	type OnDestroy,
	signal,
	viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { loadGooglePlaces, parsePlaceResult } from "./google-places.js";
import { COMMON_CURRENCIES, COMMON_LANGUAGES, COMMON_TIMEZONES } from "./reference-data.js";

@Component({
	selector: "app-create-property-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./create-property-dialog.html",
	styleUrl: "./create-property-dialog.scss",
})
export class CreatePropertyDialogComponent implements AfterViewInit, OnDestroy {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialogRef = inject(MatDialogRef<CreatePropertyDialogComponent>);
	private readonly zone = inject(NgZone);

	private autocomplete: google.maps.places.Autocomplete | null = null;
	private placeChangedListener: google.maps.MapsEventListener | null = null;

	readonly addressInput = viewChild<ElementRef<HTMLInputElement>>("addressInput");

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly placesAvailable = signal(false);
	touched: Record<string, boolean> = {};

	// Reference data
	readonly timezones = COMMON_TIMEZONES;
	readonly currencies = COMMON_CURRENCIES;
	readonly languages = COMMON_LANGUAGES;

	// Filters for searchable selects
	readonly tzFilter = signal("");
	readonly filteredTimezones = computed(() => {
		const term = this.tzFilter().toLowerCase();
		if (!term) return this.timezones;
		return this.timezones.filter(
			(tz) => tz.label.toLowerCase().includes(term) || tz.value.toLowerCase().includes(term),
		);
	});

	// Form fields — Identity
	propertyName = "";
	propertyCode = "";
	propertyType = "";
	starRating: number | null = null;
	totalRooms: number | null = null;

	// Form fields — Location
	addressLine1 = "";
	addressLine2 = "";
	city = "";
	state = "";
	postalCode = "";
	country = "";
	timezone = "UTC";

	// Form fields — Operations
	currency = "USD";
	defaultLanguage = "en";
	phone = "";
	email = "";
	website = "";

	get isValid(): boolean {
		return this.propertyName.trim().length > 0 && this.propertyCode.trim().length > 0;
	}

	markTouched(field: string): void {
		this.touched[field] = true;
	}

	/** Auto-generate property code from name */
	onNameChange(): void {
		if (!this.touched["propertyCode"] && this.propertyName) {
			this.propertyCode = this.propertyName
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, "")
				.slice(0, 10);
		}
	}

	ngAfterViewInit(): void {
		loadGooglePlaces()
			.then(() => this.initAutocomplete())
			.catch(() => {
				/* Google Places not available — fields remain manual */
			});
	}

	ngOnDestroy(): void {
		this.placeChangedListener?.remove();
		this.placeChangedListener = null;
		this.autocomplete = null;
	}

	private initAutocomplete(): void {
		const input = this.addressInput()?.nativeElement;
		if (!input) return;

		this.autocomplete = new google.maps.places.Autocomplete(input, {
			types: ["establishment"],
			fields: ["address_components", "formatted_phone_number", "website", "name"],
		});

		this.placeChangedListener = this.autocomplete.addListener("place_changed", () => {
			const place = this.autocomplete?.getPlace();
			if (!place?.address_components) return;

			this.zone.run(() => {
				const parsed = parsePlaceResult(place);
				this.addressLine1 = parsed.streetAddress;
				this.city = parsed.city;
				this.state = parsed.state;
				this.postalCode = parsed.postalCode;
				this.country = parsed.country;
				if (parsed.timezone) this.timezone = parsed.timezone;
				if (parsed.phone) this.phone = parsed.phone;
				if (parsed.website) this.website = parsed.website;
				this.placesAvailable.set(true);
			});
		});

		this.placesAvailable.set(true);
	}

	cancel(): void {
		this.dialogRef.close(false);
	}

	async save(): Promise<void> {
		if (!this.isValid) return;
		this.saving.set(true);
		this.error.set(null);

		const tenantId = this.auth.tenantId();
		if (!tenantId) {
			this.error.set("No tenant context available");
			this.saving.set(false);
			return;
		}

		try {
			await this.api.post("/properties", {
				tenant_id: tenantId,
				property_name: this.propertyName.trim(),
				property_code: this.propertyCode.trim().toUpperCase(),
				property_type: this.propertyType || undefined,
				star_rating: this.starRating ?? undefined,
				total_rooms: this.totalRooms ?? undefined,
				phone: this.phone || undefined,
				email: this.email || undefined,
				website: this.website || undefined,
				address: {
					line1: this.addressLine1 || undefined,
					line2: this.addressLine2 || undefined,
					city: this.city || undefined,
					state: this.state || undefined,
					postal_code: this.postalCode || undefined,
					country: this.country || undefined,
				},
				currency: this.currency || undefined,
				timezone: this.timezone || undefined,
				default_language: this.defaultLanguage || undefined,
			});
			this.dialogRef.close(true);
		} catch (err) {
			if (err instanceof ApiValidationError) {
				this.error.set(err.fieldErrors.map((e) => e.message).join(", "));
			} else {
				this.error.set(err instanceof Error ? err.message : "Failed to create property");
			}
		} finally {
			this.saving.set(false);
		}
	}
}
