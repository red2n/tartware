/**
 * DEV DOC
 * Module: api/document-render.ts
 * Purpose: The one place a template plus a payload becomes printable blocks.
 *          Pure — no I/O, no database handle, no PDF library.
 * Ownership: Schema package
 *
 * {@link composeDocument} is to documents what `evaluateRestrictions` is to
 * bookings: the single function every caller goes through, so that the folio a
 * guest is emailed, the folio the front desk prints and the folio attached to
 * chargeback evidence are the same document rather than three near-identical
 * ones.
 *
 * It lives here rather than in the document service because the emitters are
 * not the interesting part — resolving a payload path, formatting money in a
 * locale, and deciding what a missing value prints as, are. Those are decisions
 * about domain data, and AGENTS.md puts shared utility functions on domain data
 * in `schema/`.
 *
 * @see api/documents.ts for the vocabulary this operates on.
 */

import { getCurrencyExponent } from "./currency.js";
import type {
	ComposedDocument,
	DocumentBlock,
	DocumentLeafValue,
	DocumentSection,
	DocumentTemplate,
	DocumentValue,
	DocumentValueFormat,
} from "./documents.js";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Path segments that must never be traversed.
 *
 * Templates are data, and data can come from a property's own configuration.
 * A path of `constructor.prototype.x` walking off the payload and into the
 * prototype chain would turn a template row into an object-graph read, so the
 * traversal refuses those segments outright rather than relying on the payload
 * shape to make them uninteresting.
 */
const BLOCKED_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** Marks a path as absolute — resolved against the payload root, not the current row. */
const ROOT_PREFIX = "$.";

/**
 * Walk a dotted path into a value.
 *
 * Numeric segments index arrays (`charges.0.description`). Anything that is not
 * a traversable object, or any segment that is missing, yields `undefined` —
 * the composer decides what a missing value prints as, not this function.
 */
export const resolveDocumentPath = (
	source: unknown,
	path: string,
): unknown => {
	const segments = path.split(".");
	let current: unknown = source;

	for (const segment of segments) {
		if (segment.length === 0 || BLOCKED_SEGMENTS.has(segment)) return undefined;
		if (current === null || current === undefined) return undefined;

		if (Array.isArray(current)) {
			const index = Number(segment);
			if (!Number.isInteger(index) || index < 0) return undefined;
			current = current[index];
			continue;
		}

		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}

	return current;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** The locale every document falls back to when none can be resolved. */
const DEFAULT_LOCALE = "en";

/**
 * Canonicalise a BCP-47 tag, falling back to {@link DEFAULT_LOCALE}.
 *
 * `Intl` throws a `RangeError` on a malformed tag, and `en_US` — an underscore
 * where the separator should be a hyphen — is the mistake clients actually
 * make. Normalising once here means a bad tag costs the caller their preferred
 * language, not their document.
 */
export const normalizeDocumentLocale = (
	locale: string | null | undefined,
): string => {
	if (!locale) return DEFAULT_LOCALE;
	try {
		const [canonical] = Intl.getCanonicalLocales(locale.trim());
		return canonical ?? DEFAULT_LOCALE;
	} catch {
		return DEFAULT_LOCALE;
	}
};

/** Coerce to a finite number, tolerating the strings PostgreSQL returns for NUMERIC. */
const toFiniteNumber = (raw: unknown): number | null => {
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	if (typeof raw === "string" && raw.trim() !== "") {
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

/** Coerce to a Date, accepting an ISO string, an epoch millisecond count, or a Date. */
const toDate = (raw: unknown): Date | null => {
	if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
	if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw);
	if (typeof raw === "string" && raw.trim() !== "") {
		const parsed = new Date(raw);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	return null;
};

/**
 * Format a resolved value for display.
 *
 * Dates are formatted in `timeZone` — **not** the host's zone. A folio night of
 * `2026-09-10` parses to UTC midnight, and formatting that in anything west of
 * Greenwich prints the 9th. Getting this wrong misstates which night a guest
 * was charged for, which is the kind of error that reaches a chargeback.
 *
 * Unknown or unformattable input returns the empty string rather than throwing,
 * so one bad field cannot cost a guest their folio.
 */
export const formatDocumentValue = (
	raw: unknown,
	format: DocumentValueFormat,
	options: { locale: string; currency?: string; timeZone: string },
): string => {
	if (raw === null || raw === undefined) return "";

	switch (format) {
		case "MONEY": {
			const amount = toFiniteNumber(raw);
			if (amount === null) return "";
			const currency = options.currency?.trim().toUpperCase();
			const digits = getCurrencyExponent(currency);
			if (currency && /^[A-Z]{3}$/.test(currency)) {
				try {
					return new Intl.NumberFormat(options.locale, {
						style: "currency",
						currency,
						minimumFractionDigits: digits,
						maximumFractionDigits: digits,
					}).format(amount);
				} catch {
					// Intl refused the locale/currency pair. Well-formed but unknown
					// codes it accepts and prints verbatim ("ZZZ 10.00"), so reaching
					// here means the locale is unusable — print the bare amount.
				}
			}
			return amount.toFixed(digits);
		}

		case "NUMBER": {
			const value = toFiniteNumber(raw);
			if (value === null) return "";
			try {
				return new Intl.NumberFormat(options.locale).format(value);
			} catch {
				return String(value);
			}
		}

		case "DATE": {
			const date = toDate(raw);
			if (date === null) return "";
			try {
				return new Intl.DateTimeFormat(options.locale, {
					dateStyle: "medium",
					timeZone: options.timeZone,
				}).format(date);
			} catch {
				return date.toISOString().slice(0, 10);
			}
		}

		case "DATETIME": {
			const date = toDate(raw);
			if (date === null) return "";
			try {
				return new Intl.DateTimeFormat(options.locale, {
					dateStyle: "medium",
					timeStyle: "short",
					timeZone: options.timeZone,
				}).format(date);
			} catch {
				return date.toISOString();
			}
		}

		case "UPPERCASE":
			return String(raw).toLocaleUpperCase(options.locale);

		default:
			return String(raw);
	}
};

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/** What {@link composeDocument} needs to turn a template into blocks. */
export type DocumentComposeInput = {
	template: DocumentTemplate;
	payload: unknown;
	/** BCP-47 tag. Only affects formatting; string lookup is driven by `strings`. */
	locale?: string;
	/** Locale string table for `STRING` bindings. A missing key renders as the key. */
	strings?: Record<string, string>;
	/** IANA zone used for every date and time in the document. Defaults to UTC. */
	timeZone?: string;
};

/** Internal resolution scope: the payload root, plus the current table row if any. */
type ResolveScope = {
	root: unknown;
	row?: unknown;
	locale: string;
	strings: Record<string, string>;
	timeZone: string;
};

/**
 * Resolve a path against the right scope.
 *
 * Inside a table, a bare path is relative to the row — that is what makes a
 * column definition readable. A `$.`-prefixed path escapes to the payload root,
 * which a money column needs so it can name the folio's currency without every
 * row having to carry a copy of it.
 */
const resolveScoped = (path: string, scope: ResolveScope): unknown => {
	if (path.startsWith(ROOT_PREFIX)) {
		return resolveDocumentPath(scope.root, path.slice(ROOT_PREFIX.length));
	}
	if (scope.row !== undefined) return resolveDocumentPath(scope.row, path);
	return resolveDocumentPath(scope.root, path);
};

/** Resolve a value that has no sub-values. */
const resolveLeafValue = (
	value: DocumentLeafValue,
	scope: ResolveScope,
): string => {
	switch (value.from) {
		case "LITERAL":
			return value.value;

		case "STRING":
			return scope.strings[value.key] ?? value.key;

		case "PATH": {
			const raw = resolveScoped(value.path, scope);
			const currency = value.currency_path
				? resolveScoped(value.currency_path, scope)
				: undefined;
			const formatted = formatDocumentValue(raw, value.format, {
				locale: scope.locale,
				currency: typeof currency === "string" ? currency : undefined,
				timeZone: scope.timeZone,
			});
			return formatted === "" ? (value.fallback ?? "") : formatted;
		}

		default:
			return "";
	}
};

/** Resolve one template value to its display string. */
const resolveValue = (value: DocumentValue, scope: ResolveScope): string => {
	if (value.from === "JOIN") {
		// Empty parts drop out with their separator, so a missing address line
		// does not leave a dangling comma on a guest's folio.
		return value.parts
			.map((part) => resolveLeafValue(part, scope))
			.filter((part) => part !== "")
			.join(value.separator);
	}
	return resolveLeafValue(value, scope);
};

/** Compose one section into zero or one blocks. */
const composeSection = (
	section: DocumentSection,
	scope: ResolveScope,
): DocumentBlock | null => {
	switch (section.kind) {
		case "HEADING": {
			const text = resolveValue(section.text, scope);
			// A heading with nothing in it is a gap in the payload, not a design.
			return text === "" ? null : { kind: "HEADING", level: section.level, text };
		}

		case "TEXT": {
			const text = resolveValue(section.text, scope);
			// Blank lines are what SPACER is for; an empty TEXT is an absent value.
			return text === "" ? null : { kind: "TEXT", text, style: section.style };
		}

		case "KEY_VALUES": {
			const rows = section.rows
				.map((field) => ({
					label: resolveValue(field.label, scope),
					value: resolveValue(field.value, scope),
					omit: field.omit_when_empty,
				}))
				.filter((row) => !(row.omit && row.value === ""))
				.map(({ label, value }) => ({ label, value }));

			// A block whose every row dropped out is furniture with nothing in it.
			if (rows.length === 0) return null;

			return {
				kind: "KEY_VALUES",
				...(section.title ? { title: resolveValue(section.title, scope) } : {}),
				columns: section.columns,
				rows,
			};
		}

		case "TABLE": {
			const source = resolveDocumentPath(scope.root, section.rows_path);
			const sourceRows = Array.isArray(source) ? source : [];
			const rows = sourceRows.map((row) =>
				section.columns.map((column) =>
					resolveValue(column.cell, { ...scope, row }),
				),
			);

			// An empty table with no empty text is a section the payload did not
			// earn — a folio with no tax lines should not print "Tax summary" over
			// nothing. Supplying `empty_text` is how a template opts back in.
			if (rows.length === 0 && !section.empty_text) return null;

			return {
				kind: "TABLE",
				...(section.title ? { title: resolveValue(section.title, scope) } : {}),
				columns: section.columns.map((column) => ({
					label: resolveValue(column.header, scope),
					align: column.align,
					weight: column.weight,
				})),
				rows,
				...(section.empty_text
					? { empty_text: resolveValue(section.empty_text, scope) }
					: {}),
			};
		}

		case "TOTALS":
			return {
				kind: "TOTALS",
				rows: section.rows.map((total) => ({
					label: resolveValue(total.label, scope),
					value: resolveValue(total.value, scope),
					emphasis: total.emphasis,
				})),
			};

		case "DIVIDER":
			return { kind: "DIVIDER" };

		case "SPACER":
			return { kind: "SPACER", size: section.size };

		case "SIGNATURE":
			return { kind: "SIGNATURE", label: resolveValue(section.label, scope) };

		default:
			return null;
	}
};

/**
 * Turn a template and a payload into a fully-resolved document.
 *
 * Never throws. A template that names a field the payload does not carry prints
 * that field's fallback — a folio missing a company address is still a valid
 * folio, and refusing to render one because of it would be a worse failure than
 * the gap it reports.
 */
export const composeDocument = (
	input: DocumentComposeInput,
): ComposedDocument => {
	const scope: ResolveScope = {
		root: input.payload,
		locale: normalizeDocumentLocale(input.locale),
		strings: input.strings ?? {},
		timeZone: input.timeZone ?? "UTC",
	};

	const compose = (sections: DocumentSection[]): DocumentBlock[] =>
		sections
			.map((section) => composeSection(section, scope))
			.filter((block): block is DocumentBlock => block !== null);

	return {
		template_id: input.template.id,
		kind: input.template.kind,
		locale: scope.locale,
		title: resolveValue(input.template.title, scope),
		header: compose(input.template.header),
		body: compose(input.template.sections),
		footer: compose(input.template.footer),
	};
};

// ---------------------------------------------------------------------------
// Template introspection
// ---------------------------------------------------------------------------

/** Collect every `STRING` key a value references, joins included. */
const collectValueKeys = (value: DocumentValue, into: Set<string>): void => {
	if (value.from === "STRING") {
		into.add(value.key);
		return;
	}
	if (value.from === "JOIN") {
		for (const part of value.parts) {
			if (part.from === "STRING") into.add(part.key);
		}
	}
};

/** Collect every `STRING` key a section references. */
const collectSectionKeys = (
	section: DocumentSection,
	into: Set<string>,
): void => {
	switch (section.kind) {
		case "HEADING":
		case "TEXT":
			collectValueKeys(section.text, into);
			return;

		case "SIGNATURE":
			collectValueKeys(section.label, into);
			return;

		case "KEY_VALUES":
			if (section.title) collectValueKeys(section.title, into);
			for (const row of section.rows) {
				collectValueKeys(row.label, into);
				collectValueKeys(row.value, into);
			}
			return;

		case "TABLE":
			if (section.title) collectValueKeys(section.title, into);
			if (section.empty_text) collectValueKeys(section.empty_text, into);
			for (const column of section.columns) {
				collectValueKeys(column.header, into);
				collectValueKeys(column.cell, into);
			}
			return;

		case "TOTALS":
			for (const row of section.rows) {
				collectValueKeys(row.label, into);
				collectValueKeys(row.value, into);
			}
			return;

		default:
	}
};

/**
 * Every locale string key a template needs, sorted.
 *
 * Used to check a locale bundle covers a template *before* someone renders a
 * folio in French and gets raw keys where the labels should be.
 */
export const collectTemplateStringKeys = (
	template: DocumentTemplate,
): string[] => {
	const keys = new Set<string>();
	collectValueKeys(template.title, keys);
	for (const section of [
		...template.header,
		...template.sections,
		...template.footer,
	]) {
		collectSectionKeys(section, keys);
	}
	return [...keys].sort();
};

/** Keys a template needs that the given string table does not supply. */
export const findMissingStringKeys = (
	template: DocumentTemplate,
	strings: Record<string, string>,
): string[] =>
	collectTemplateStringKeys(template).filter((key) => !(key in strings));
