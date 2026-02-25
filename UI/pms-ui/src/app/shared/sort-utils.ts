import { signal } from "@angular/core";

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
	column: string;
	direction: SortDirection;
}

export function createSortState() {
	return signal<SortState>({ column: "", direction: null });
}

export function toggleSort(current: SortState, column: string): SortState {
	if (current.column !== column) {
		return { column, direction: "asc" };
	}
	if (current.direction === "asc") {
		return { column, direction: "desc" };
	}
	return { column: "", direction: null };
}

/**
 * Generic comparator for sorting arrays by a key path.
 * Supports string, number, and null/undefined values.
 */
export function sortBy<T>(list: T[], column: string, direction: SortDirection): T[] {
	if (!column || !direction) return list;

	return [...list].sort((a, b) => {
		const valA = getNestedValue(a, column);
		const valB = getNestedValue(b, column);

		if (valA == null && valB == null) return 0;
		if (valA == null) return 1;
		if (valB == null) return -1;

		let cmp = 0;
		if (typeof valA === "number" && typeof valB === "number") {
			cmp = valA - valB;
		} else {
			cmp = String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" });
		}

		return direction === "desc" ? -cmp : cmp;
	});
}

function getNestedValue(obj: unknown, path: string): unknown {
	const keys = path.split(".");
	let current: unknown = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}
