import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnDestroy, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, Router } from "@angular/router";
import type {
	SettingsCategory,
	SettingsDefinition,
	SettingsOption,
	SettingsSection,
	SettingsValue,
} from "@tartware/schemas";
import { type Subscription } from "rxjs";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";

/** Shape returned by GET /v1/settings/catalog/:code */
interface CategoryCatalog {
	data: {
		category: SettingsCategory;
		sections: SettingsSection[];
		definitions: SettingsDefinition[];
		options: SettingsOption[];
	};
	meta: { counts: { sections: number; definitions: number; options: number } };
}

/** Shape returned by GET /v1/settings/categories */
interface CategoryListResponse {
	data: SettingsCategory[];
	meta: { count: number };
}

/** Shape returned by GET /v1/settings/values */
interface ValuesResponse {
	data: SettingsValue[];
	meta: { count: number; sampleTenantId: string | null };
}

/** Tracks editing state for each definition */
interface EditState {
	editing: boolean;
	saving: boolean;
	dirty: boolean;
	editValue: unknown;
	savedMessage: string | null;
	errorMessage: string | null;
}

/** Parsed field from a JSON settings value, for structured form rendering */
interface JsonFieldGroup {
	key: string;
	label: string;
	type: "primitive" | "object" | "array-primitive" | "array-objects";
	value: unknown;
	valueType: "string" | "number" | "boolean";
	children: {
		key: string;
		label: string;
		value: unknown;
		valueType: "string" | "number" | "boolean";
	}[];
	columns: string[];
	rows: Record<string, unknown>[];
	items: unknown[];
}

@Component({
	selector: "app-settings",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		MatSlideToggleModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./settings.html",
	styleUrl: "./settings.scss",
})
export class SettingsComponent implements OnInit, OnDestroy {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly i18n = inject(I18nService);
	readonly globalSearch = inject(GlobalSearchService);
	private paramSub?: Subscription;

	readonly categories = signal<SettingsCategory[]>([]);
	readonly selectedCategory = signal<SettingsCategory | null>(null);
	readonly sections = signal<SettingsSection[]>([]);
	readonly definitions = signal<SettingsDefinition[]>([]);
	readonly options = signal<SettingsOption[]>([]);
	readonly values = signal<SettingsValue[]>([]);

	/** Per-definition edit state keyed by definition id */
	readonly editStates = signal<Record<string, EditState>>({});

	readonly loadingCategories = signal(false);
	readonly loadingCatalog = signal(false);
	readonly error = signal<string | null>(null);

	/** Definitions grouped by section_id for display */
	readonly sectionDefinitions = computed(() => {
		const defs = this.definitions();
		const sects = this.sections();
		const query = this.globalSearch.query().toLowerCase().trim();

		return sects
			.filter((s) => s.is_active)
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((section) => {
				let sectionDefs = defs
					.filter((d) => d.section_id === section.id && !d.is_deprecated)
					.sort((a, b) => a.sort_order - b.sort_order);

				if (query) {
					sectionDefs = sectionDefs.filter(
						(d) =>
							d.name.toLowerCase().includes(query) ||
							d.code.toLowerCase().includes(query) ||
							d.description?.toLowerCase().includes(query),
					);
				}

				return { section, definitions: sectionDefs };
			})
			.filter((group) => group.definitions.length > 0);
	});

	ngOnInit(): void {
		this.loadCategories();
		this.paramSub = this.route.params.subscribe((params) => {
			const code = params["categoryCode"] as string | undefined;
			if (code) {
				this.selectCategoryByCode(code);
			}
		});
	}

	ngOnDestroy(): void {
		this.paramSub?.unsubscribe();
	}

	async loadCategories(): Promise<void> {
		this.loadingCategories.set(true);
		this.error.set(null);
		try {
			const res = await this.api.get<CategoryListResponse>("/settings/categories");
			const sorted = res.data
				.filter((c) => c.is_active)
				.sort((a, b) => a.sort_order - b.sort_order);
			this.categories.set(sorted);
			// Select the category from route param (if categories loaded after param subscription fires)
			const code = this.route.snapshot.params["categoryCode"] as string | undefined;
			if (code) {
				this.selectCategoryByCode(code);
			}
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			this.loadingCategories.set(false);
		}
	}

	selectCategory(category: SettingsCategory): void {
		this.router.navigate(["/settings", category.code]);
	}

	private selectCategoryByCode(code: string): void {
		const cat = this.categories().find((c) => c.code === code);
		if (!cat || this.selectedCategory()?.code === code) return;
		this.selectedCategory.set(cat);
		this.globalSearch.clear();
		this.editStates.set({});
		this.loadCatalog(cat);
	}

	private async loadCatalog(category: SettingsCategory): Promise<void> {
		this.loadingCatalog.set(true);
		this.error.set(null);
		try {
			const res = await this.api.get<CategoryCatalog>(`/settings/catalog/${category.code}`);
			this.sections.set(res.data.sections);
			this.definitions.set(res.data.definitions);
			this.options.set(res.data.options);
			await this.loadValues();
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to load category");
		} finally {
			this.loadingCatalog.set(false);
		}
	}

	private async loadValues(): Promise<void> {
		try {
			const res = await this.api.get<ValuesResponse>("/settings/values");
			this.values.set(res.data);
		} catch {
			this.values.set([]);
		}
	}

	// ── Value access ──

	getValueRecord(defId: string): SettingsValue | undefined {
		return this.values().find((v) => v.setting_id === defId);
	}

	getDisplayValue(def: SettingsDefinition): unknown {
		const record = this.getValueRecord(def.id);
		if (record) return record.value;
		return def.default_value ?? null;
	}

	formatDisplayValue(def: SettingsDefinition): string {
		const val = this.getDisplayValue(def);
		if (val === null || val === undefined) return "Not configured";
		if (typeof val === "boolean") return val ? "Enabled" : "Disabled";
		if (typeof val === "object") {
			try {
				return JSON.stringify(val, null, 2);
			} catch {
				return String(val);
			}
		}
		return String(val);
	}

	isJsonValue(def: SettingsDefinition): boolean {
		return def.control_type === "JSON_EDITOR" || def.data_type === "JSON";
	}

	isBooleanValue(def: SettingsDefinition): boolean {
		return def.control_type === "TOGGLE" || def.data_type === "BOOLEAN";
	}

	isNumberValue(def: SettingsDefinition): boolean {
		return (
			def.control_type === "NUMBER_INPUT" ||
			def.control_type === "SLIDER" ||
			def.data_type === "INTEGER" ||
			def.data_type === "DECIMAL" ||
			def.data_type === "PERCENTAGE" ||
			def.data_type === "CURRENCY"
		);
	}

	isSelectValue(def: SettingsDefinition): boolean {
		return (
			def.control_type === "SELECT" ||
			def.control_type === "RADIO_GROUP" ||
			def.data_type === "ENUM"
		);
	}

	isMultiSelectValue(def: SettingsDefinition): boolean {
		return def.control_type === "MULTI_SELECT" || def.data_type === "MULTI_ENUM";
	}

	/** Returns true when the given option value is currently selected in the MULTI_SELECT editor */
	isMultiSelectChecked(defId: string, optionValue: string): boolean {
		const arr = this.getEditState(defId).editValue;
		return Array.isArray(arr) && (arr as string[]).includes(optionValue);
	}

	/** Toggles an option value into or out of the MULTI_SELECT editor array */
	onMultiSelectToggle(defId: string, optionValue: string, checked: boolean): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const current = Array.isArray(state.editValue) ? [...(state.editValue as string[])] : [];
			if (checked) {
				if (!current.includes(optionValue)) current.push(optionValue);
			} else {
				const idx = current.indexOf(optionValue);
				if (idx !== -1) current.splice(idx, 1);
			}
			return { ...s, [defId]: { ...state, editValue: current, dirty: true } };
		});
	}

	isArrayDisplayValue(def: SettingsDefinition): boolean {
		return Array.isArray(this.getDisplayValue(def));
	}

	asArray(value: unknown): unknown[] {
		return Array.isArray(value) ? value : [];
	}

	isDateValue(def: SettingsDefinition): boolean {
		return def.control_type === "DATE_PICKER" || def.data_type === "DATE";
	}

	isTextAreaValue(def: SettingsDefinition): boolean {
		return def.control_type === "TEXT_AREA" || def.data_type === "TEXT";
	}

	getOptions(defId: string): SettingsOption[] {
		return this.options().filter((o) => o.setting_id === defId && o.is_active);
	}

	// ── JSON form helpers ──

	/** Parse a JSON object value into renderable field groups */
	parseJsonFields(value: unknown): JsonFieldGroup[] {
		if (
			value === null ||
			value === undefined ||
			typeof value !== "object" ||
			Array.isArray(value)
		) {
			return [];
		}
		const obj = value as Record<string, unknown>;
		const base: Pick<JsonFieldGroup, "children" | "columns" | "rows" | "items"> = {
			children: [],
			columns: [],
			rows: [],
			items: [],
		};
		const groups: JsonFieldGroup[] = [];

		for (const [key, v] of Object.entries(obj)) {
			const label = this.humanizeKey(key);
			if (typeof v === "boolean") {
				groups.push({
					...base,
					key,
					label,
					type: "primitive",
					value: v,
					valueType: "boolean",
				});
			} else if (typeof v === "number") {
				groups.push({
					...base,
					key,
					label,
					type: "primitive",
					value: v,
					valueType: "number",
				});
			} else if (Array.isArray(v)) {
				if (v.length > 0 && typeof v[0] === "object" && v[0] !== null && !Array.isArray(v[0])) {
					const colSet = new Set<string>();
					for (const item of v) {
						if (typeof item === "object" && item !== null) {
							for (const k of Object.keys(item as Record<string, unknown>)) colSet.add(k);
						}
					}
					groups.push({
						...base,
						key,
						label,
						type: "array-objects",
						value: v,
						valueType: "string",
						columns: [...colSet],
						rows: v as Record<string, unknown>[],
					});
				} else {
					groups.push({
						...base,
						key,
						label,
						type: "array-primitive",
						value: v,
						valueType: "string",
						items: v,
					});
				}
			} else if (typeof v === "object" && v !== null) {
				const children: JsonFieldGroup["children"] = [];
				for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
					const vt: "string" | "number" | "boolean" =
						typeof cv === "boolean" ? "boolean" : typeof cv === "number" ? "number" : "string";
					children.push({
						key: ck,
						label: this.humanizeKey(ck),
						value: cv,
						valueType: vt,
					});
				}
				groups.push({
					...base,
					key,
					label,
					type: "object",
					value: v,
					valueType: "string",
					children,
				});
			} else {
				groups.push({
					...base,
					key,
					label,
					type: "primitive",
					value: v ?? "",
					valueType: "string",
				});
			}
		}
		return groups;
	}

	/** Convert camelCase or SCREAMING_CASE key to human-readable label */
	humanizeKey(key: string): string {
		if (key === key.toUpperCase() && key.includes("_")) {
			return key
				.split("_")
				.map((w) => w.charAt(0) + w.slice(1).toLowerCase())
				.join(" ");
		}
		return key
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
			.replace(/^./, (c) => c.toUpperCase());
	}

	/** Format a table cell or child value for display */
	formatCellValue(value: unknown): string {
		if (value === null || value === undefined) return "—";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (Array.isArray(value)) {
			return value
				.map((item) => {
					if (typeof item === "object" && item !== null) {
						return Object.values(item as Record<string, unknown>)
							.filter((v) => v !== null && v !== undefined)
							.map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
							.join(" · ");
					}
					return String(item);
				})
				.join("; ");
		}
		if (typeof value === "object") {
			const entries = Object.entries(value as Record<string, unknown>);
			return entries
				.map(
					([k, v]) =>
						`${this.humanizeKey(k)}: ${Array.isArray(v) ? v.join(", ") : String(v ?? "—")}`,
				)
				.join("; ");
		}
		return String(value);
	}

	/** Determine the input type for a table cell value */
	getCellType(value: unknown): "boolean" | "number" | "array" | "string" {
		if (typeof value === "boolean") return "boolean";
		if (typeof value === "number") return "number";
		if (Array.isArray(value)) return "array";
		return "string";
	}

	/** Join an array value to comma-separated string for display */
	joinArray(value: unknown): string {
		return Array.isArray(value) ? value.join(", ") : "";
	}

	/** Edit a primitive or nested-object field within a JSON setting value */
	onJsonFieldEdit(defId: string, key: string, subKey: string | null, value: unknown): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const obj = structuredClone(state.editValue) as Record<string, unknown>;
			if (subKey !== null) {
				(obj[key] as Record<string, unknown>)[subKey] = value;
			} else {
				obj[key] = value;
			}
			return { ...s, [defId]: { ...state, editValue: obj, dirty: true } };
		});
	}

	/** Edit a cell within an array-of-objects table */
	onArrayCellEdit(
		defId: string,
		key: string,
		rowIndex: number,
		colKey: string,
		value: unknown,
	): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const obj = structuredClone(state.editValue) as Record<string, unknown>;
			(obj[key] as Record<string, unknown>[])[rowIndex][colKey] = value;
			return { ...s, [defId]: { ...state, editValue: obj, dirty: true } };
		});
	}

	/** Edit an array cell that contains a sub-array (comma-separated text) */
	onArrayCellArrayEdit(
		defId: string,
		key: string,
		rowIndex: number,
		colKey: string,
		text: string,
	): void {
		const arr = text
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);
		this.onArrayCellEdit(defId, key, rowIndex, colKey, arr);
	}

	/** Add a new row to an array-of-objects field */
	addArrayRow(defId: string, key: string): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const obj = structuredClone(state.editValue) as Record<string, unknown>;
			const arr = (obj[key] as Record<string, unknown>[]) ?? [];
			const template: Record<string, unknown> = {};
			if (arr.length > 0) {
				for (const [k, v] of Object.entries(arr[0])) {
					if (typeof v === "boolean") template[k] = false;
					else if (typeof v === "number") template[k] = 0;
					else if (Array.isArray(v)) template[k] = [];
					else template[k] = "";
				}
			}
			arr.push(template);
			obj[key] = arr;
			return { ...s, [defId]: { ...state, editValue: obj, dirty: true } };
		});
	}

	/** Remove a row from an array-of-objects field */
	removeArrayRow(defId: string, key: string, rowIndex: number): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const obj = structuredClone(state.editValue) as Record<string, unknown>;
			(obj[key] as Record<string, unknown>[]).splice(rowIndex, 1);
			return { ...s, [defId]: { ...state, editValue: obj, dirty: true } };
		});
	}

	/** Edit a primitive-array field from comma-separated text */
	onArrayPrimitiveEdit(defId: string, key: string, text: string): void {
		this.editStates.update((s) => {
			const state = this.getEditState(defId);
			const obj = structuredClone(state.editValue) as Record<string, unknown>;
			obj[key] = text
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0);
			return { ...s, [defId]: { ...state, editValue: obj, dirty: true } };
		});
	}

	// ── Edit state ──

	getEditState(defId: string): EditState {
		return (
			this.editStates()[defId] ?? {
				editing: false,
				saving: false,
				dirty: false,
				editValue: null,
				savedMessage: null,
				errorMessage: null,
			}
		);
	}

	startEdit(def: SettingsDefinition): void {
		if (def.is_readonly) return;
		const currentValue = this.getDisplayValue(def);
		let editValue: unknown;
		if (this.isJsonValue(def) && typeof currentValue === "object" && currentValue !== null) {
			editValue = structuredClone(currentValue);
		} else if (this.isMultiSelectValue(def)) {
			// Normalize stored value to a string array for the checkbox group
			if (Array.isArray(currentValue)) {
				editValue = [...currentValue];
			} else if (typeof currentValue === "string" && currentValue.trim().startsWith("[")) {
				try {
					const parsed = JSON.parse(currentValue);
					editValue = Array.isArray(parsed) ? parsed : [];
				} catch {
					editValue = [];
				}
			} else {
				editValue = [];
			}
		} else {
			editValue = currentValue;
		}
		this.editStates.update((s) => ({
			...s,
			[def.id]: {
				editing: true,
				saving: false,
				dirty: false,
				editValue,
				savedMessage: null,
				errorMessage: null,
			},
		}));
	}

	cancelEdit(defId: string): void {
		this.editStates.update((s) => ({
			...s,
			[defId]: {
				...this.getEditState(defId),
				editing: false,
				dirty: false,
				errorMessage: null,
			},
		}));
	}

	onEditValueChange(defId: string, value: unknown): void {
		this.editStates.update((s) => ({
			...s,
			[defId]: { ...this.getEditState(defId), editValue: value, dirty: true },
		}));
	}

	onToggleChange(def: SettingsDefinition, checked: boolean): void {
		this.editStates.update((s) => ({
			...s,
			[def.id]: {
				editing: true,
				saving: false,
				dirty: true,
				editValue: checked,
				savedMessage: null,
				errorMessage: null,
			},
		}));
		this.saveValue(def);
	}

	async saveValue(def: SettingsDefinition): Promise<void> {
		const state = this.getEditState(def.id);
		let parsedValue: unknown = state.editValue;

		if (this.isJsonValue(def) && typeof parsedValue === "string") {
			try {
				parsedValue = JSON.parse(parsedValue);
			} catch {
				this.editStates.update((s) => ({
					...s,
					[def.id]: { ...state, errorMessage: "Invalid JSON" },
				}));
				return;
			}
		}

		if (this.isNumberValue(def) && typeof parsedValue === "string") {
			parsedValue = Number(parsedValue);
			if (Number.isNaN(parsedValue)) {
				this.editStates.update((s) => ({
					...s,
					[def.id]: { ...state, errorMessage: "Invalid number" },
				}));
				return;
			}
		}

		this.editStates.update((s) => ({
			...s,
			[def.id]: { ...state, saving: true, errorMessage: null },
		}));

		const existing = this.getValueRecord(def.id);
		try {
			if (existing) {
				const updated = await this.api.patch<{ data: SettingsValue }>(
					`/settings/values/${existing.id}`,
					{ value: parsedValue },
				);
				this.values.update((vals) => vals.map((v) => (v.id === existing.id ? updated.data : v)));
			} else {
				const created = await this.api.post<{ data: SettingsValue }>("/settings/values", {
					setting_id: def.id,
					scope_level: def.default_scope,
					value: parsedValue,
				});
				this.values.update((vals) => [...vals, created.data]);
			}

			this.editStates.update((s) => ({
				...s,
				[def.id]: {
					editing: false,
					saving: false,
					dirty: false,
					editValue: null,
					savedMessage: "Saved",
					errorMessage: null,
				},
			}));

			setTimeout(() => {
				this.editStates.update((s) => ({
					...s,
					[def.id]: { ...this.getEditState(def.id), savedMessage: null },
				}));
			}, 3000);
		} catch (err) {
			this.editStates.update((s) => ({
				...s,
				[def.id]: {
					...this.getEditState(def.id),
					saving: false,
					errorMessage: err instanceof Error ? err.message : "Failed to save",
				},
			}));
		}
	}

	// ── Display helpers ──

	categoryIcon(cat: SettingsCategory): string {
		return cat.icon ?? "settings";
	}

	controlTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			TOGGLE: "Toggle",
			TEXT_INPUT: "Text",
			TEXT_AREA: "Text Area",
			NUMBER_INPUT: "Number",
			SELECT: "Select",
			MULTI_SELECT: "Multi Select",
			RADIO_GROUP: "Radio",
			SLIDER: "Slider",
			DATE_PICKER: "Date",
			TIME_PICKER: "Time",
			DATETIME_PICKER: "Date & Time",
			JSON_EDITOR: "Configuration",
			TAGS: "Tags",
			FILE_UPLOAD: "File Upload",
		};
		return labels[type] ?? type;
	}

	sensitivityClass(sensitivity: string): string {
		switch (sensitivity) {
			case "CONFIDENTIAL":
				return "badge-danger";
			case "SENSITIVE":
				return "badge-warning";
			case "INTERNAL":
				return "badge-muted";
			case "PUBLIC":
				return "badge-success";
			default:
				return "badge-muted";
		}
	}

	scopeLabel(scopes: string[]): string {
		if (!scopes?.length) return "—";
		return scopes.map((s) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")).join(", ");
	}

	// ── Industry-standard tooltips ──────────────────────────────────────────

	/** PMS-industry tooltip text keyed by setting code. */
	private static readonly TOOLTIPS: Record<string, string> = {
		// Admin & Users
		"admin.max_staff_users":
			"Caps the number of active staff logins. Increase when onboarding seasonal staff. Opera PMS and Mews both enforce user-count licensing.",
		"admin.require_email_verification":
			"Forces new users to verify email before first login, preventing typosquatted accounts. Aligns with HTNG identity-verification best practice.",
		"admin.auto_deactivate_days":
			"Automatically deactivates users after N days of inactivity. Reduces attack surface per PCI-DSS 8.1.4 (remove inactive accounts within 90 days).",
		"admin.default_role":
			"Role auto-assigned to new users. Best practice: use the least-privileged role (Front Desk) and escalate only when needed.",
		"admin.allow_multi_role":
			"Allows one user to hold multiple roles (e.g., Front Desk + Night Auditor). Common in small properties where staff multitask.",
		"admin.password_min_length":
			"Minimum characters for staff passwords. NIST 800-63B recommends at least 8; PCI-DSS requires 7+.",
		"admin.password_requires_upper":
			"Requires at least one uppercase letter. Part of complexity rules recommended by most PMS security frameworks.",
		"admin.password_requires_number":
			"Requires at least one digit. Standard practice alongside uppercase requirement per PCI-DSS.",
		"admin.password_expiry_days":
			"Forces password reset every N days. Set to 0 for no expiry (NIST 800-63B now recommends no forced rotation unless compromised).",
		"admin.session_idle_timeout_mins":
			"Logs out idle sessions after N minutes. PCI-DSS requires 15 min for payment terminals. 30 min is standard for PMS workstations.",
		"admin.max_concurrent_sessions":
			"Limits simultaneous logins per user. Prevents credential sharing. Set 0 for unlimited (not recommended).",

		// Property & Tenant
		"property.timezone":
			"IANA timezone for all date/time calculations. Critical for night audit roll-over, check-in/out times, and rate calendar display.",
		"property.check_in_time":
			"Standard time rooms become available. Industry norm: 14:00–16:00. Displayed on booking confirmations and the guest app.",
		"property.check_out_time":
			"Deadline for guest departure. Industry norm: 10:00–12:00. Used for late-checkout fee calculations and housekeeping scheduling.",
		"property.star_rating":
			"Official hotel classification (1–5 stars). Influences OTA listing grade, guest expectations, and rack-rate positioning.",
		"property.base_currency":
			"ISO 4217 code for all financial transactions. Changing mid-operation requires full revenue re-reconciliation — set correctly at go-live.",
		"property.locale":
			"BCP 47 locale tag controlling number grouping (1,000 vs 1.000), date display, and currency symbol placement.",
		"property.logo_url":
			"HTTPS URL to property logo. Used on registration cards, folios, emails, and the guest portal header.",
		"property.brand_color":
			"Primary HEX colour (#RRGGBB) applied to guest-facing communications, PDF folios, and the PMS sidebar accent.",

		// Rooms & Inventory
		"rooms.default_status_on_checkout":
			"Housekeeping status assigned when a guest checks out. DIRTY triggers automatic HK task creation. INSPECTED skips cleaning.",
		"rooms.allow_same_day_reassign":
			"Allows front desk to reassign a room on arrival day. Needed when upgrades or maintenance changes occur after initial assignment.",
		"rooms.hk_priority_order":
			"Determines housekeeping queue sort. DUE_OUT_FIRST prioritises departing guests for fastest turnaround — industry best practice.",
		"rooms.dnd_max_days":
			"Maximum consecutive Do-Not-Disturb days before supervisors are alerted. Health & safety codes typically require access within 48–72 hours.",
		"rooms.stayover_clean_interval":
			"How often stayover rooms are scheduled for cleaning. Daily (1) is luxury standard; every 2–3 days reduces costs for economy properties.",
		"rooms.ooo_requires_approval":
			"Requires manager approval to mark a room Out-Of-Order. Prevents inventory loss from unapproved maintenance holds.",

		// Rates & Pricing
		"rates.default_rounding":
			"Rounding rule for nightly rate calculations. ROUND_HALF_UP is the accounting standard; ROUND_DOWN favours the guest.",
		"rates.max_discount_percent":
			"Maximum discount agents can apply without manager override. Prevents unauthorised deep discounting. Opera uses 'Max Allowable Discount'.",
		"rates.show_rack_rate":
			"Displays the rack (published) rate crossed out next to the offer rate. Common anchoring technique in revenue management.",
		"rates.deposit_required":
			"Enables deposit collection at booking. Standard for prepaid, non-refundable, and group reservations.",
		"rates.deposit_percent":
			"Percentage of total booking collected as deposit. Industry range: 10–50%. Groups often require 25–50%.",
		"rates.non_refundable_cutoff_days":
			"Days before arrival after which deposits cannot be refunded. Critical for revenue protection on non-refundable rates.",
		"rates.tax_inclusive":
			"Whether published rates already include taxes. Common in Europe (VAT-inclusive); North America typically shows tax-exclusive rates.",
		"rates.city_tax_per_night":
			"Fixed per-night city/tourist tax in base currency. Many jurisdictions require this as a separate line item on the folio.",

		// Approvals
		"approvals.rate_override_threshold":
			"Discount percentage above which a manager approval is required. Prevents revenue leakage from unapproved rate overrides.",
		"approvals.complimentary_requires":
			"Role that must approve complimentary (free) nights. Best practice: require GM or Revenue Manager approval.",
		"approvals.refund_threshold":
			"Refund amounts exceeding this value (base currency) require manager sign-off. Protects against fraudulent refunds.",
		"approvals.writeoff_requires":
			"Role required to approve balance write-offs. Should be GM or higher to prevent hidden revenue loss.",
		"approvals.late_checkout_threshold":
			"Late checkout fees above this amount need manager approval. Ensures premium late-checkouts are properly authorised.",
		"approvals.early_checkin_allow":
			"When enabled, front desk can offer early check-in without seeking approval. Disable for properties with tight housekeeping schedules.",

		// Integrations
		"integrations.ota_sync_interval_mins":
			"Minutes between OTA inventory pushes. Lower values reduce overbooking risk but increase API costs. 15–60 min is standard.",
		"integrations.ota_min_los":
			"Minimum length-of-stay restriction pushed to OTA channels. Helps protect direct bookings for short stays.",
		"integrations.channel_rate_offset":
			"Percentage markup/markdown on rates sent to channel manager. Positive = markup, negative = discount vs direct rate.",
		"integrations.stop_sell_threshold":
			"When available rooms drop to this count, OTA bookings are automatically blocked. Reserves last rooms for direct/walk-in sales.",
		"integrations.pos_auto_post":
			"Automatically posts POS charges (restaurant, spa, minibar) to the guest folio. Standard in full-service hotels.",
		"integrations.keycard_system":
			"Electronic lock system in use. Determines the keycard encoding method for guest room access.",

		// Booking & Guests
		"booking.max_advance_days":
			"Maximum days in advance guests can book. 365 is standard; increase for group/event properties that book 2+ years ahead.",
		"booking.min_advance_hours":
			"Minimum hours of lead time for online bookings. Prevents last-second bookings that housekeeping can't prepare for.",
		"booking.cutoff_time":
			"Daily cutoff for same-day bookings. After this time, guests must book for the next day. Aligns with night-audit roll-over.",
		"booking.require_phone":
			"Makes phone number mandatory in the booking process. Required for SMS confirmations and call-ahead properties.",
		"booking.auto_enroll_loyalty":
			"Automatically enrols new guests in the loyalty programme on first booking. Increases membership with zero friction.",
		"booking.free_cancel_hours":
			"Hours before arrival within which cancellation is free. Industry norm: 24–72 hours. Shorter windows improve revenue protection.",
		"booking.no_show_charge_percent":
			"Percentage of booking total charged for no-show. 100% (full first night) is industry standard. Some properties use 50%.",

		// Operations (HK & Maintenance)
		"ops.hk_shift_start":
			"Time housekeeping shift begins and the cleaning queue activates. Standard: 08:00. Aligns with checkout time + buffer.",
		"ops.inspections_required":
			"When enabled, cleaned rooms must pass supervisor inspection before status changes to CLEAN. Required by luxury brands (Forbes 5-Star).",
		"ops.turndown_enabled":
			"Enables evening turndown service scheduling. Standard in 4-5 star properties. Auto-creates PM HK tasks for occupied rooms.",
		"ops.maintenance_default_priority":
			"Default priority for new maintenance work orders. NORMAL is standard; adjust to HIGH for properties with stricter SLAs.",
		"ops.maintenance_sla_hours":
			"Target resolution time for normal-priority maintenance. Industry norm: 4h for guest-impacting, 24h for non-critical items.",
		"ops.auto_task_on_checkout":
			"Automatically creates a housekeeping task when a guest checks out. Essential for same-day turnover and rooms management.",

		// Night Audit & Reporting
		"audit.night_audit_time":
			"Local time for nightly audit roll-over. Industry standard: 23:00–02:00. Must be after last possible check-in and before first morning check-out.",
		"audit.auto_run_enabled":
			"Runs night audit automatically at the scheduled time. Reduces manual steps. Disable if your property requires pre-audit checks.",
		"audit.block_checkin_during_audit":
			"Prevents new check-ins while night audit is processing. Avoids posting errors from transactions crossing the date boundary.",
		"audit.daily_report_recipients":
			"Comma-separated email addresses that receive the morning operations report. Include GM, Revenue Manager, and Front Office Manager.",
		"audit.report_format":
			"Default file format for automated report delivery. PDF is standard for management; Excel for finance and revenue teams.",
		"audit.reservation_archive_years":
			"Years before completed reservations are archived. Legal requirements vary: 7 years (tax), 3 years (credit card disputes).",
		"audit.pii_deletion_months":
			"Months after last stay before guest Personally Identifiable Information is anonymised. GDPR requires data minimisation.",

		// Notifications
		"comms.email_provider":
			"Transactional email service for booking confirmations, folios, and alerts. SMTP for self-hosted; SendGrid/SES for cloud delivery.",
		"comms.email_from_name":
			"Sender display name on outbound emails. Should be the property name (e.g., 'Grand Hotel Tartware') for brand recognition.",
		"comms.email_reply_to":
			"Reply-to address for guest emails. Use a monitored inbox (reservations@hotel.com), not noreply. Improves guest communication.",
		"comms.sms_enabled":
			"Enables SMS notifications for booking confirmations, check-in alerts, and service requests. Requires an active SMS provider.",
		"comms.sms_provider":
			"Third-party SMS gateway. Twilio is the most common. Choose based on coverage in your property's guest origin markets.",
		"comms.low_occupancy_alert_pct":
			"Triggers a staff alert when occupancy falls below this percentage. Enables proactive revenue management and promotional actions.",
		"comms.maintenance_escalation_hours":
			"Hours before an unresolved work order is escalated to the supervisor. Shorter values for guest-impacting maintenance.",

		// Security
		"security.mfa_required":
			"Enforces two-factor authentication for all staff. Strongly recommended per PCI-DSS and GDPR. Required for POS-integrated terminals.",
		"security.mfa_method":
			"Preferred MFA delivery method. TOTP (authenticator app) is most secure. SMS is convenient but vulnerable to SIM-swapping.",
		"security.max_login_attempts":
			"Account locks after this many consecutive failed logins. PCI-DSS requires lockout after 6 attempts max.",
		"security.mask_pii_in_logs":
			"Redacts guest PII (email, phone, payment card) from all application logs. Required for PCI-DSS and GDPR compliance.",
		"security.gdpr_consent_required":
			"Captures explicit marketing consent during booking. Required for EU properties under GDPR Article 7. Non-EU properties may opt out.",
		"security.backup_frequency":
			"How often full database snapshots are taken. Daily is standard; hourly for high-transaction properties. RPO should match business needs.",
		"security.backup_retention_days":
			"Days backup snapshots are retained before automatic deletion. 30 days minimum; extend for regulatory or audit requirements.",

		// UI & Localization
		"ui.date_format":
			"Date display format across all screens. MM/DD/YYYY (US), DD/MM/YYYY (EU/UK), YYYY-MM-DD (ISO 8601 / Asia). Match your property's locale.",
		"ui.time_format":
			"12-hour (AM/PM) or 24-hour clock. US properties typically use 12h; European and Asian properties use 24h.",
		"ui.week_starts_on":
			"First day of week in calendars and date pickers. Sunday (Americas) or Monday (Europe, Asia). Affects rate calendar grid alignment.",
		"ui.default_language":
			"Default UI language for staff who haven't set a personal preference. Does not affect guest-facing communications.",
		"ui.guest_language":
			"Language used in guest-facing emails, registration cards, and receipts. Should match the primary guest demographic.",
		"ui.reservation_custom_fields":
			"JSON schema defining extra fields on the reservation form. Use for property-specific data like loyalty tier, group code, or special requests.",
		"ui.guest_custom_fields":
			"JSON schema defining extra fields on the guest profile. Use for country-specific requirements like tax ID, passport number, or visa information.",

		// Advanced
		"advanced.enable_dynamic_pricing":
			"Enables AI-driven rate adjustment based on demand, competitor rates, and historical data. Requires the Revenue Management module.",
		"advanced.enable_mobile_checkin":
			"Allows guests to complete check-in via the mobile app or web portal before arrival. Reduces front-desk queue at peak times.",
		"advanced.enable_revenue_forecast":
			"Shows AI-generated revenue projections on the dashboard. Based on booking pace, seasonality, and historical performance.",
		"advanced.db_pool_size":
			"Maximum database connections per service instance. Increase for high-transaction properties; default 10 handles ~500 concurrent users.",
		"advanced.api_rate_limit_rpm":
			"API requests per minute per tenant before throttling. Protects against runaway integrations. 1000 RPM suits most properties.",
		"advanced.cache_ttl_seconds":
			"Default Redis cache TTL for read-heavy endpoints. Lower values = fresher data; higher values = less DB load. 300s is a good balance.",
	};

	/** Returns the localised industry tooltip for a setting code. Falls back to the DB description. */
	getTooltip(def: SettingsDefinition): string {
		const tooltip = SettingsComponent.TOOLTIPS[def.code];
		if (tooltip) return this.i18n.t(tooltip);
		return def.description ?? "";
	}

	/** Returns true if the setting has a tooltip */
	hasTooltip(def: SettingsDefinition): boolean {
		return !!(SettingsComponent.TOOLTIPS[def.code] || def.description);
	}
}
