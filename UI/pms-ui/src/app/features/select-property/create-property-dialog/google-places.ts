import { environment } from "../../../../environments/environment";



let loadPromise: Promise<void> | null = null;

function isGooglePlacesLoaded(): boolean {
	return typeof google !== "undefined" && !!google.maps?.places;
}

/**
 * Lazy-loads the Google Maps JavaScript API with the Places library.
 * Returns immediately if already loaded. Safe to call multiple times.
 */
export function loadGooglePlaces(): Promise<void> {
	if (isGooglePlacesLoaded()) return Promise.resolve();
	if (loadPromise) return loadPromise;

	const key = environment.googleMapsApiKey;
	if (!key) {
		return Promise.reject(new Error("Google Maps API key is not configured"));
	}

	loadPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => {
			loadPromise = null;
			reject(new Error("Failed to load Google Maps script"));
		};
		document.head.appendChild(script);
	});

	return loadPromise;
}

/** IANA timezone offsets for common country codes (fallback when Places API doesn't provide timezone). */
const COUNTRY_TIMEZONES: Record<string, string> = {
	US: "America/New_York",
	GB: "Europe/London",
	FR: "Europe/Paris",
	DE: "Europe/Berlin",
	JP: "Asia/Tokyo",
	AU: "Australia/Sydney",
	IN: "Asia/Kolkata",
	CN: "Asia/Shanghai",
	BR: "America/Sao_Paulo",
	MX: "America/Mexico_City",
	AE: "Asia/Dubai",
	SG: "Asia/Singapore",
	TH: "Asia/Bangkok",
	MY: "Asia/Kuala_Lumpur",
	ID: "Asia/Jakarta",
	PH: "Asia/Manila",
	KR: "Asia/Seoul",
	IT: "Europe/Rome",
	ES: "Europe/Madrid",
	PT: "Europe/Lisbon",
	NL: "Europe/Amsterdam",
	CH: "Europe/Zurich",
	AT: "Europe/Vienna",
	SE: "Europe/Stockholm",
	NO: "Europe/Oslo",
	DK: "Europe/Copenhagen",
	FI: "Europe/Helsinki",
	IE: "Europe/Dublin",
	NZ: "Pacific/Auckland",
	ZA: "Africa/Johannesburg",
	EG: "Africa/Cairo",
	TR: "Europe/Istanbul",
	GR: "Europe/Athens",
	SA: "Asia/Riyadh",
	CA: "America/Toronto",
};

export interface ParsedPlace {
	streetAddress: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	timezone: string;
	phone: string;
	website: string;
}

/**
 * Extracts structured address fields from a Google Places result.
 */
export function parsePlaceResult(place: google.maps.places.PlaceResult): ParsedPlace {
	const components = place.address_components ?? [];
	const get = (type: string): string =>
		components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes(type))?.long_name ?? "";
	const getShort = (type: string): string =>
		components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes(type))?.short_name ?? "";

	const streetNumber = get("street_number");
	const route = get("route");
	const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

	const country = getShort("country");
	const timezone = COUNTRY_TIMEZONES[country] ?? "";

	return {
		streetAddress,
		city: get("locality") || get("sublocality_level_1") || get("administrative_area_level_2"),
		state: getShort("administrative_area_level_1"),
		postalCode: get("postal_code"),
		country,
		timezone,
		phone: place.formatted_phone_number ?? "",
		website: place.website ?? "",
	};
}
