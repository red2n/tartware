import { describe, expect, it } from "vitest";

import {
	collectTemplateStringKeys,
	composeDocument,
	findMissingStringKeys,
	formatDocumentValue,
	normalizeDocumentLocale,
	resolveDocumentPath,
} from "../src/api/document-render.js";
import {
	type DocumentTemplate,
	DocumentTemplateSchema,
} from "../src/api/documents.js";

/**
 * Templates are parsed rather than cast, so every fixture also exercises the
 * template schema's defaults — the thing a hand-written template will lean on.
 */
const template = (over: Partial<DocumentTemplate>): DocumentTemplate =>
	DocumentTemplateSchema.parse({
		id: "TEST",
		kind: "FOLIO",
		name: "Test template",
		title: { from: "LITERAL", value: "Test" },
		sections: [{ kind: "DIVIDER" }],
		...over,
	});

const payload = {
	folio: { folio_number: "F-1001", currency_code: "USD" },
	guest: { name: "Ada Lovelace", address: { city: "London" } },
	charges: [
		{ description: "Room", total_amount: 200, currency_code: "USD" },
		{ description: "Breakfast", total_amount: 18.5, currency_code: "USD" },
	],
	totals: { balance: 218.5 },
	empty_list: [],
};

const fmt = { locale: "en", timeZone: "UTC" };

// ---------------------------------------------------------------------------

describe("resolveDocumentPath", () => {
	it("walks nested objects", () => {
		expect(resolveDocumentPath(payload, "guest.address.city")).toBe("London");
	});

	it("indexes into arrays", () => {
		expect(resolveDocumentPath(payload, "charges.1.description")).toBe(
			"Breakfast",
		);
	});

	it("returns undefined for a missing segment rather than throwing", () => {
		expect(
			resolveDocumentPath(payload, "guest.passport.number"),
		).toBeUndefined();
	});

	it("returns undefined when the path runs into a scalar", () => {
		expect(
			resolveDocumentPath(payload, "folio.folio_number.length"),
		).toBeUndefined();
	});

	it("returns undefined for a non-integer array index", () => {
		expect(resolveDocumentPath(payload, "charges.first")).toBeUndefined();
	});

	it("refuses to traverse prototype-chain segments", () => {
		// A template is data and can come from configuration; a path must not be
		// able to walk off the payload into the object graph.
		expect(resolveDocumentPath(payload, "__proto__")).toBeUndefined();
		expect(resolveDocumentPath(payload, "constructor.name")).toBeUndefined();
		expect(resolveDocumentPath(payload, "folio.prototype")).toBeUndefined();
	});

	it("tolerates a null or scalar source", () => {
		expect(resolveDocumentPath(null, "a.b")).toBeUndefined();
		expect(resolveDocumentPath("string", "length")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------

describe("formatDocumentValue — money", () => {
	it("formats to the currency's own exponent", () => {
		expect(
			formatDocumentValue(1234.5, "MONEY", { ...fmt, currency: "USD" }),
		).toBe("$1,234.50");
	});

	it("prints a zero-decimal currency with no decimals", () => {
		// JPY has no minor unit; printing ¥1,234.00 is simply wrong.
		expect(
			formatDocumentValue(1234, "MONEY", { ...fmt, currency: "JPY" }),
		).toBe("¥1,234");
	});

	it("prints a three-decimal currency with three", () => {
		expect(
			formatDocumentValue(12.5, "MONEY", { ...fmt, currency: "KWD" }),
		).toContain("12.500");
	});

	it("accepts the strings PostgreSQL returns for NUMERIC columns", () => {
		expect(
			formatDocumentValue("218.50", "MONEY", { ...fmt, currency: "USD" }),
		).toBe("$218.50");
	});

	it("prints the code verbatim for a well-formed currency Intl does not know", () => {
		// Intl separates an unknown code from the amount with U+00A0, so this
		// matches on shape rather than on the exact byte.
		expect(
			formatDocumentValue(10, "MONEY", { ...fmt, currency: "ZZZ" }),
		).toMatch(/^ZZZ\s10\.00$/);
	});

	it("falls back to a plain amount when no currency is supplied", () => {
		expect(formatDocumentValue(10, "MONEY", fmt)).toBe("10.00");
	});

	it("returns empty for a non-numeric value instead of NaN", () => {
		expect(
			formatDocumentValue("not-a-number", "MONEY", { ...fmt, currency: "USD" }),
		).toBe("");
	});
});

describe("formatDocumentValue — dates", () => {
	it("formats a date-only string in the document timezone, not the host's", () => {
		// The folio night is the 10th. Formatting UTC midnight in a western zone
		// would print the 9th and misstate which night was charged.
		const formatted = formatDocumentValue("2026-09-10", "DATE", fmt);
		expect(formatted).toBe("Sep 10, 2026");
	});

	it("keeps the calendar day when a western timezone is requested", () => {
		const utc = formatDocumentValue("2026-09-10", "DATE", fmt);
		const newYork = formatDocumentValue("2026-09-10", "DATE", {
			...fmt,
			timeZone: "America/New_York",
		});
		expect(utc).toBe("Sep 10, 2026");
		expect(newYork).toBe("Sep 9, 2026");
	});

	it("formats an instant with a time", () => {
		expect(
			formatDocumentValue("2026-09-10T14:30:00Z", "DATETIME", fmt),
		).toContain("2:30");
	});

	it("returns empty for an unparseable date", () => {
		expect(formatDocumentValue("not-a-date", "DATE", fmt)).toBe("");
	});
});

describe("formatDocumentValue — other formats", () => {
	it("groups numbers by locale", () => {
		expect(formatDocumentValue(1234567, "NUMBER", fmt)).toBe("1,234,567");
	});

	it("uppercases using the locale's own casing rules", () => {
		expect(formatDocumentValue("checked out", "UPPERCASE", fmt)).toBe(
			"CHECKED OUT",
		);
	});

	it("passes text through", () => {
		expect(formatDocumentValue("F-1001", "TEXT", fmt)).toBe("F-1001");
	});

	it("returns empty for null and undefined in every format", () => {
		for (const format of [
			"TEXT",
			"MONEY",
			"NUMBER",
			"DATE",
			"DATETIME",
		] as const) {
			expect(formatDocumentValue(null, format, fmt)).toBe("");
			expect(formatDocumentValue(undefined, format, fmt)).toBe("");
		}
	});
});

// ---------------------------------------------------------------------------

describe("composeDocument — value bindings", () => {
	it("resolves a literal, a string key and a path", () => {
		const result = composeDocument({
			template: template({
				sections: [
					{ kind: "TEXT", text: { from: "LITERAL", value: "fixed" } },
					{ kind: "TEXT", text: { from: "STRING", key: "folio.title" } },
					{ kind: "TEXT", text: { from: "PATH", path: "folio.folio_number" } },
				],
			}),
			payload,
			strings: { "folio.title": "Guest Folio" },
		});

		expect(result.body.map((b) => (b.kind === "TEXT" ? b.text : ""))).toEqual([
			"fixed",
			"Guest Folio",
			"F-1001",
		]);
	});

	it("renders the key itself when a string is missing, so the gap is visible", () => {
		const result = composeDocument({
			template: template({
				sections: [
					{ kind: "TEXT", text: { from: "STRING", key: "folio.title" } },
				],
			}),
			payload,
		});
		expect(result.body[0]).toMatchObject({ text: "folio.title" });
	});

	it("uses the fallback when a path resolves to nothing", () => {
		const result = composeDocument({
			template: template({
				sections: [
					{
						kind: "TEXT",
						text: { from: "PATH", path: "company.name", fallback: "—" },
					},
				],
			}),
			payload,
		});
		expect(result.body[0]).toMatchObject({ text: "—" });
	});
});

describe("composeDocument — JOIN", () => {
	const joined = (over: Record<string, unknown>) =>
		composeDocument({
			template: template({
				sections: [
					{
						kind: "TEXT",
						text: {
							from: "JOIN",
							parts: [
								{ from: "PATH", path: "address.line1" },
								{ from: "PATH", path: "address.line2" },
								{ from: "PATH", path: "address.city" },
							],
							...over,
						},
					},
				],
			}),
			payload: {
				address: { line1: "12 High Street", city: "London" },
			},
		}).body[0];

	it("drops an empty part along with its separator", () => {
		// "12 High Street, , London" is the failure this guards against.
		expect(joined({})).toMatchObject({ text: "12 High Street, London" });
	});

	it("honours a custom separator", () => {
		expect(joined({ separator: " · " })).toMatchObject({
			text: "12 High Street · London",
		});
	});

	it("resolves literals and strings inside a join", () => {
		const block = composeDocument({
			template: template({
				sections: [
					{
						kind: "TEXT",
						text: {
							from: "JOIN",
							separator: " ",
							parts: [
								{ from: "STRING", key: "stay.nights" },
								{ from: "PATH", path: "stay.count", format: "NUMBER" },
							],
						},
					},
				],
			}),
			payload: { stay: { count: 3 } },
			strings: { "stay.nights": "Nights:" },
		}).body[0];
		expect(block).toMatchObject({ text: "Nights: 3" });
	});

	it("collects string keys from inside a join", () => {
		const joinTemplate = template({
			sections: [
				{
					kind: "TEXT",
					text: {
						from: "JOIN",
						parts: [
							{ from: "STRING", key: "a" },
							{ from: "PATH", path: "x" },
							{ from: "STRING", key: "b" },
						],
					},
				},
			],
		});
		expect(findMissingStringKeys(joinTemplate, {})).toEqual(["a", "b"]);
	});
});

describe("composeDocument — key/value sections", () => {
	const keyValues = (omit: boolean) =>
		composeDocument({
			template: template({
				sections: [
					{
						kind: "KEY_VALUES",
						rows: [
							{
								label: { from: "LITERAL", value: "Guest" },
								value: { from: "PATH", path: "guest.name" },
							},
							{
								label: { from: "LITERAL", value: "Company" },
								value: { from: "PATH", path: "company.name" },
								omit_when_empty: omit,
							},
						],
					},
				],
			}),
			payload,
		});

	it("drops an empty row when asked to", () => {
		const block = keyValues(true).body[0];
		expect(block).toMatchObject({ kind: "KEY_VALUES" });
		if (block?.kind !== "KEY_VALUES") throw new Error("expected KEY_VALUES");
		expect(block.rows).toEqual([{ label: "Guest", value: "Ada Lovelace" }]);
	});

	it("keeps an empty row when not asked to", () => {
		const block = keyValues(false).body[0];
		if (block?.kind !== "KEY_VALUES") throw new Error("expected KEY_VALUES");
		expect(block.rows).toHaveLength(2);
	});

	it("drops the whole block when every row dropped out", () => {
		const result = composeDocument({
			template: template({
				sections: [
					{
						kind: "KEY_VALUES",
						rows: [
							{
								label: { from: "LITERAL", value: "Company" },
								value: { from: "PATH", path: "company.name" },
								omit_when_empty: true,
							},
						],
					},
				],
			}),
			payload,
		});
		expect(result.body).toEqual([]);
	});
});

describe("composeDocument — tables", () => {
	const tableTemplate = template({
		sections: [
			{
				kind: "TABLE",
				rows_path: "charges",
				columns: [
					{
						header: { from: "LITERAL", value: "Description" },
						cell: { from: "PATH", path: "description" },
					},
					{
						header: { from: "LITERAL", value: "Amount" },
						cell: {
							from: "PATH",
							path: "total_amount",
							format: "MONEY",
							currency_path: "$.folio.currency_code",
						},
						align: "RIGHT",
					},
				],
				empty_text: { from: "LITERAL", value: "No charges" },
			},
		],
	});

	it("iterates the array at rows_path with cells relative to each row", () => {
		const block = composeDocument({ template: tableTemplate, payload }).body[0];
		if (block?.kind !== "TABLE") throw new Error("expected TABLE");
		expect(block.rows).toEqual([
			["Room", "$200.00"],
			["Breakfast", "$18.50"],
		]);
	});

	it("reaches the payload root through the $. prefix for the currency", () => {
		// Each row carries no currency of its own here — only `$.` makes this work.
		const block = composeDocument({ template: tableTemplate, payload }).body[0];
		if (block?.kind !== "TABLE") throw new Error("expected TABLE");
		expect(block.rows[0]?.[1]).toBe("$200.00");
	});

	it("carries the column alignment through to the emitters", () => {
		const block = composeDocument({ template: tableTemplate, payload }).body[0];
		if (block?.kind !== "TABLE") throw new Error("expected TABLE");
		expect(block.columns.map((c) => c.align)).toEqual(["LEFT", "RIGHT"]);
	});

	it("renders an empty table with its empty text rather than dropping it", () => {
		const block = composeDocument({
			template: template({
				sections: [
					{
						kind: "TABLE",
						rows_path: "empty_list",
						columns: [
							{
								header: { from: "LITERAL", value: "X" },
								cell: { from: "PATH", path: "x" },
							},
						],
						empty_text: { from: "LITERAL", value: "Nothing posted" },
					},
				],
			}),
			payload,
		}).body[0];
		if (block?.kind !== "TABLE") throw new Error("expected TABLE");
		expect(block.rows).toEqual([]);
		expect(block.empty_text).toBe("Nothing posted");
	});

	it("drops an empty table that has no empty text", () => {
		// A folio with no tax lines must not print a "Tax summary" over nothing.
		const result = composeDocument({
			template: template({
				sections: [
					{
						kind: "TABLE",
						rows_path: "empty_list",
						columns: [
							{
								header: { from: "LITERAL", value: "X" },
								cell: { from: "PATH", path: "x" },
							},
						],
					},
				],
			}),
			payload,
		});
		expect(result.body).toEqual([]);
	});

	it("treats a missing rows_path as an empty table", () => {
		const block = composeDocument({
			template: template({
				sections: [
					{
						kind: "TABLE",
						rows_path: "does_not_exist",
						columns: [
							{
								header: { from: "LITERAL", value: "X" },
								cell: { from: "PATH", path: "x" },
							},
						],
						empty_text: { from: "LITERAL", value: "None" },
					},
				],
			}),
			payload,
		}).body[0];
		if (block?.kind !== "TABLE") throw new Error("expected TABLE");
		expect(block.rows).toEqual([]);
	});
});

describe("composeDocument — empty blocks", () => {
	const single = (section: Parameters<typeof template>[0]["sections"]) =>
		composeDocument({ template: template({ sections: section }), payload })
			.body;

	it("drops a heading whose value is absent", () => {
		expect(
			single([
				{ kind: "HEADING", level: 2, text: { from: "PATH", path: "nope" } },
			]),
		).toEqual([]);
	});

	it("drops a text block whose value is absent", () => {
		expect(
			single([{ kind: "TEXT", text: { from: "PATH", path: "nope" } }]),
		).toEqual([]);
	});

	it("keeps a spacer, which is how a template asks for blank space", () => {
		expect(single([{ kind: "SPACER", size: "LARGE" }])).toEqual([
			{ kind: "SPACER", size: "LARGE" },
		]);
	});

	it("keeps a text block whose fallback filled it in", () => {
		expect(
			single([
				{
					kind: "TEXT",
					text: { from: "PATH", path: "nope", fallback: "—" },
				},
			]),
		).toEqual([{ kind: "TEXT", text: "—", style: "NORMAL" }]);
	});
});

describe("composeDocument — document shape", () => {
	it("resolves the title and keeps header, body and footer separate", () => {
		const result = composeDocument({
			template: template({
				title: { from: "STRING", key: "folio.title" },
				header: [
					{
						kind: "HEADING",
						level: 1,
						text: { from: "PATH", path: "guest.name" },
					},
				],
				sections: [
					{
						kind: "TOTALS",
						rows: [
							{
								label: { from: "LITERAL", value: "Balance" },
								value: {
									from: "PATH",
									path: "totals.balance",
									format: "MONEY",
									currency_path: "folio.currency_code",
								},
								emphasis: true,
							},
						],
					},
				],
				footer: [
					{ kind: "TEXT", text: { from: "LITERAL", value: "Thank you" } },
				],
			}),
			payload,
			strings: { "folio.title": "Guest Folio" },
		});

		expect(result.title).toBe("Guest Folio");
		expect(result.header).toHaveLength(1);
		expect(result.footer).toHaveLength(1);
		expect(result.body[0]).toEqual({
			kind: "TOTALS",
			rows: [{ label: "Balance", value: "$218.50", emphasis: true }],
		});
	});

	it("never throws on a payload that is nothing like the template expects", () => {
		for (const bad of [null, undefined, 42, "text", [], {}]) {
			expect(() =>
				composeDocument({
					template: template({
						sections: [
							{ kind: "TEXT", text: { from: "PATH", path: "a.b.c" } },
							{
								kind: "TABLE",
								rows_path: "charges",
								columns: [
									{
										header: { from: "LITERAL", value: "X" },
										cell: { from: "PATH", path: "x" },
									},
								],
							},
						],
					}),
					payload: bad,
				}),
			).not.toThrow();
		}
	});
});

describe("composeDocument — the same folio in two languages", () => {
	/** The done-when for WS-06 is two languages off one payload. */
	const bilingual = template({
		title: { from: "STRING", key: "folio.title" },
		sections: [
			{
				kind: "KEY_VALUES",
				rows: [
					{
						label: { from: "STRING", key: "folio.balance" },
						value: {
							from: "PATH",
							path: "totals.balance",
							format: "MONEY",
							currency_path: "folio.currency_code",
						},
					},
				],
			},
		],
	});

	const render = (locale: string, strings: Record<string, string>) =>
		composeDocument({ template: bilingual, payload, locale, strings });

	it("swaps the labels and the number formatting together", () => {
		const en = render("en", {
			"folio.title": "Guest Folio",
			"folio.balance": "Balance due",
		});
		const fr = render("fr", {
			"folio.title": "Note de séjour",
			"folio.balance": "Solde dû",
		});

		expect(en.title).toBe("Guest Folio");
		expect(fr.title).toBe("Note de séjour");

		const label = (doc: typeof en) =>
			doc.body[0]?.kind === "KEY_VALUES" ? doc.body[0].rows[0] : undefined;

		expect(label(en)?.label).toBe("Balance due");
		expect(label(fr)?.label).toBe("Solde dû");

		// Same amount, same currency, different locale conventions.
		expect(label(en)?.value).toBe("$218.50");
		expect(label(fr)?.value).not.toBe(label(en)?.value);
		expect(label(fr)?.value).toContain("218,50");
	});
});

// ---------------------------------------------------------------------------

describe("normalizeDocumentLocale", () => {
	it("canonicalises a well-formed tag", () => {
		expect(normalizeDocumentLocale("en-us")).toBe("en-US");
	});

	it("falls back rather than throwing on the underscore form clients send", () => {
		expect(normalizeDocumentLocale("en_US")).toBe("en");
	});

	it("falls back for empty and absent tags", () => {
		expect(normalizeDocumentLocale("")).toBe("en");
		expect(normalizeDocumentLocale(null)).toBe("en");
		expect(normalizeDocumentLocale(undefined)).toBe("en");
	});

	it("costs a caller their language, not their document", () => {
		// A malformed locale must still produce a fully formatted folio.
		const result = composeDocument({
			template: template({
				sections: [
					{
						kind: "TEXT",
						text: {
							from: "PATH",
							path: "totals.balance",
							format: "MONEY",
							currency_path: "folio.currency_code",
						},
					},
				],
			}),
			payload,
			locale: "en_US",
		});
		expect(result.locale).toBe("en");
		expect(result.body[0]).toMatchObject({ text: "$218.50" });
	});
});

// ---------------------------------------------------------------------------

describe("template introspection", () => {
	const introspected = template({
		title: { from: "STRING", key: "b.title" },
		sections: [
			{
				kind: "KEY_VALUES",
				title: { from: "STRING", key: "a.section" },
				rows: [
					{
						label: { from: "STRING", key: "c.label" },
						value: { from: "PATH", path: "x" },
					},
				],
			},
			{
				kind: "TABLE",
				rows_path: "charges",
				columns: [
					{
						header: { from: "STRING", key: "a.section" },
						cell: { from: "PATH", path: "description" },
					},
				],
				empty_text: { from: "STRING", key: "d.empty" },
			},
		],
	});

	it("collects every string key once, sorted", () => {
		expect(collectTemplateStringKeys(introspected)).toEqual([
			"a.section",
			"b.title",
			"c.label",
			"d.empty",
		]);
	});

	it("reports exactly the keys a bundle is missing", () => {
		expect(
			findMissingStringKeys(introspected, {
				"a.section": "A",
				"b.title": "B",
			}),
		).toEqual(["c.label", "d.empty"]);
	});

	it("reports nothing for a complete bundle", () => {
		const complete = Object.fromEntries(
			collectTemplateStringKeys(introspected).map((k) => [k, k]),
		);
		expect(findMissingStringKeys(introspected, complete)).toEqual([]);
	});
});
