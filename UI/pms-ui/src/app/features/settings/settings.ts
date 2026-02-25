import { NgClass } from "@angular/common";
import { Component, computed, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
	SettingsCategory,
	SettingsDefinition,
	SettingsOption,
	SettingsSection,
	SettingsValue,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";

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
	],
	templateUrl: "./settings.html",
	styleUrl: "./settings.scss",
})
export class SettingsComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);

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
	readonly searchQuery = signal("");

	/** Definitions grouped by section_id for display */
	readonly sectionDefinitions = computed(() => {
		const defs = this.definitions();
		const sects = this.sections();
		const query = this.searchQuery().toLowerCase().trim();

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
			if (sorted.length > 0) {
				this.selectCategory(sorted[0]);
			}
		} catch (err) {
			this.error.set(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			this.loadingCategories.set(false);
		}
	}

	async selectCategory(category: SettingsCategory): Promise<void> {
		if (this.selectedCategory()?.id === category.id) return;
		this.selectedCategory.set(category);
		this.searchQuery.set("");
		this.editStates.set({});
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

	onSearch(value: string): void {
		this.searchQuery.set(value);
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
}
