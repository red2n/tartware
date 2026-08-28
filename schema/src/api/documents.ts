/**
 * DEV DOC
 * Module: api/documents.ts
 * Purpose: The typed vocabulary of a rendered document — what a service hands
 *          the renderer, what a template is allowed to say, and the resolved
 *          block list both output formats are emitted from.
 * Ownership: Schema package
 *
 * There is no PDF path anywhere in this repository, so folio printing, emailed
 * folios, statements, dunning letters, batch registration cards, the
 * night-audit pack and every export past GL CSV/XML all terminate at the same
 * missing piece. This module is the shape of that piece.
 *
 * Three layers, deliberately separate:
 *
 *   1. **Payloads** ({@link FolioDocumentSchema} and friends) — assembled whole
 *      by the owning service. The renderer never queries the database, so a
 *      folio PDF cannot disagree with the folio API about what it owes.
 *   2. **Templates** ({@link DocumentTemplateSchema}) — *data*, not code. A
 *      template is a list of sections whose values are payload paths, i18n keys
 *      or literals. A new folio style is a new row, not a new function, which
 *      is what makes PMS-11-02 a configuration change.
 *   3. **Blocks** ({@link DocumentBlockSchema}) — the fully-resolved,
 *      already-formatted output of {@link composeDocument}. Both the HTML and
 *      the PDF emitter consume this and nothing else, so the two cannot drift
 *      on content; they may only disagree on how it looks.
 *
 * @see api/document-render.ts for the composer itself.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// ---------------------------------------------------------------------------
// Identity: what can be rendered, and in what shape
// ---------------------------------------------------------------------------

/**
 * The document kinds this system knows how to assemble a payload for.
 *
 * A *kind* is not a *template*: `FOLIO` is the kind, `FOLIO_STANDARD` and
 * `FOLIO_SUMMARY` are two templates that both take a {@link FolioDocument}.
 */
export const DocumentKindEnum = z.enum([
	"FOLIO",
	"INVOICE",
	"REGISTRATION_CARD",
	"STATEMENT",
	"AUDIT_PACK",
]);

export type DocumentKind = z.infer<typeof DocumentKindEnum>;

/** Output formats the renderer can emit from one block list. */
export const DocumentFormatEnum = z.enum(["PDF", "HTML"]);

export type DocumentFormat = z.infer<typeof DocumentFormatEnum>;

/**
 * Horizontal alignment of a table column.
 *
 * Money columns are `RIGHT` so the decimal points line up; anything else is
 * unreadable on a folio and every hotelier will say so immediately.
 */
export const DocumentAlignEnum = z.enum(["LEFT", "CENTER", "RIGHT"]);

export type DocumentAlign = z.infer<typeof DocumentAlignEnum>;

/**
 * How a resolved payload value is turned into display text.
 *
 * `MONEY` and the date formats are locale-aware; see `formatDocumentValue`.
 */
export const DocumentValueFormatEnum = z.enum([
	"TEXT",
	"MONEY",
	"NUMBER",
	"DATE",
	"DATETIME",
	"UPPERCASE",
]);

export type DocumentValueFormat = z.infer<typeof DocumentValueFormatEnum>;

// ---------------------------------------------------------------------------
// Template value bindings
// ---------------------------------------------------------------------------

/**
 * One value in a template, resolved at compose time.
 *
 * Tagged by `from` rather than expressed as a bag of optional keys, so an
 * ill-formed template fails validation at the boundary instead of silently
 * rendering an empty cell.
 *
 * - `LITERAL` — a fixed string. Use sparingly; it is invisible to translation.
 * - `STRING` — a key looked up in the locale string table. This is how a
 *   template stays language-neutral.
 * - `PATH` — a dotted path into the payload, optionally formatted.
 */
const literalValue = z.object({
	from: z.literal("LITERAL"),
	value: z.string(),
});

const stringValue = z.object({
	from: z.literal("STRING"),
	key: z.string().min(1),
});

const pathValue = z.object({
	from: z.literal("PATH"),
	/**
	 * Dotted path into the payload — `folio.folio_number`, `charges.0.total_amount`.
	 * Inside a `TABLE` section the path is relative to the current row.
	 */
	path: z.string().min(1),
	format: DocumentValueFormatEnum.default("TEXT"),
	/**
	 * Where to find the ISO-4217 code when `format` is `MONEY`. Kept as a
	 * path rather than a fixed code so one template renders a folio in
	 * whatever currency the folio is actually denominated in.
	 */
	currency_path: z.string().min(1).optional(),
	/** Shown when the path resolves to null/undefined/empty. Defaults to "". */
	fallback: z.string().optional(),
});

/**
 * A value that resolves on its own, with no sub-values.
 *
 * Exists so `JOIN` can take a list of them without the schema becoming
 * recursive — nothing needs a join inside a join, and a flat union validates
 * and narrows far better than a `z.lazy` one would.
 */
export const DocumentLeafValueSchema = z.discriminatedUnion("from", [
	literalValue,
	stringValue,
	pathValue,
]);

export type DocumentLeafValue = z.infer<typeof DocumentLeafValueSchema>;

export const DocumentValueSchema = z.discriminatedUnion("from", [
	literalValue,
	stringValue,
	pathValue,
	z.object({
		from: z.literal("JOIN"),
		/**
		 * Parts to concatenate, in order.
		 *
		 * This is how an address becomes one line without the assembling service
		 * deciding what an address looks like. Empty parts drop out with their
		 * separator, so a folio for a guest with no `line2` does not print
		 * "12 High Street, , London".
		 */
		parts: z.array(DocumentLeafValueSchema).min(1),
		separator: z.string().default(", "),
	}),
]);

export type DocumentValue = z.infer<typeof DocumentValueSchema>;

// ---------------------------------------------------------------------------
// Template sections — the data a template is made of
// ---------------------------------------------------------------------------

/** One label/value pair in a `KEY_VALUES` section. */
export const DocumentFieldSchema = z.object({
	label: DocumentValueSchema,
	value: DocumentValueSchema,
	/** Drop the row entirely when the value resolves empty, rather than printing a blank. */
	omit_when_empty: z.boolean().default(false),
});

export type DocumentField = z.infer<typeof DocumentFieldSchema>;

/** One column of a `TABLE` section. */
export const DocumentColumnSchema = z.object({
	header: DocumentValueSchema,
	cell: DocumentValueSchema,
	align: DocumentAlignEnum.default("LEFT"),
	/** Relative width. Columns are laid out in proportion to the sum of these. */
	weight: z.number().positive().default(1),
});

export type DocumentColumn = z.infer<typeof DocumentColumnSchema>;

/** One line of a `TOTALS` section. */
export const DocumentTotalSchema = z.object({
	label: DocumentValueSchema,
	value: DocumentValueSchema,
	/** Emphasised totals are the ones a guest looks for — the balance due. */
	emphasis: z.boolean().default(false),
});

export type DocumentTotal = z.infer<typeof DocumentTotalSchema>;

/**
 * A section of a template.
 *
 * Deliberately a small, closed set. Every additional section kind has to be
 * implemented by both emitters, so the bar for adding one is that no
 * combination of the existing kinds expresses it.
 */
export const DocumentSectionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("HEADING"),
		level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
		text: DocumentValueSchema,
	}),
	z.object({
		kind: z.literal("TEXT"),
		text: DocumentValueSchema,
		style: z.enum(["NORMAL", "MUTED", "STRONG"]).default("NORMAL"),
	}),
	z.object({
		kind: z.literal("KEY_VALUES"),
		title: DocumentValueSchema.optional(),
		columns: z.union([z.literal(1), z.literal(2)]).default(1),
		rows: z.array(DocumentFieldSchema).min(1),
	}),
	z.object({
		kind: z.literal("TABLE"),
		title: DocumentValueSchema.optional(),
		/** Path to the array this table iterates. A missing or empty array renders `empty_text`. */
		rows_path: z.string().min(1),
		columns: z.array(DocumentColumnSchema).min(1),
		empty_text: DocumentValueSchema.optional(),
	}),
	z.object({
		kind: z.literal("TOTALS"),
		rows: z.array(DocumentTotalSchema).min(1),
	}),
	z.object({ kind: z.literal("DIVIDER") }),
	z.object({
		kind: z.literal("SPACER"),
		size: z.enum(["SMALL", "MEDIUM", "LARGE"]).default("MEDIUM"),
	}),
	z.object({
		kind: z.literal("SIGNATURE"),
		label: DocumentValueSchema,
	}),
]);

export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

/**
 * A whole template: identity, the payload kind it expects, and its sections.
 *
 * `id` is free-form rather than an enum because templates are data — a property
 * may publish its own folio style without a schema change. The built-in set
 * lives in `document-service/src/templates/`.
 */
export const DocumentTemplateSchema = z.object({
	id: z.string().min(1),
	kind: DocumentKindEnum,
	/** Human name for the template picker; not rendered. */
	name: z.string().min(1),
	/** Document title — PDF metadata and the HTML `<title>`. Usually an i18n key. */
	title: DocumentValueSchema,
	/**
	 * Document furniture rendered once above the body — the letterhead.
	 * Page numbering is the emitter's job, not the template's.
	 */
	header: z.array(DocumentSectionSchema).default([]),
	sections: z.array(DocumentSectionSchema).min(1),
	footer: z.array(DocumentSectionSchema).default([]),
});

export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;

// ---------------------------------------------------------------------------
// Blocks — the resolved output both emitters read
// ---------------------------------------------------------------------------

/**
 * A composed document block: every value already resolved to a display string
 * in the requested locale and currency.
 *
 * This is the contract between {@link composeDocument} and the emitters. An
 * emitter that needs to look at the payload to decide what to print is a bug —
 * that is exactly the drift this layer exists to prevent.
 */
export const DocumentBlockSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("HEADING"),
		level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
		text: z.string(),
	}),
	z.object({
		kind: z.literal("TEXT"),
		text: z.string(),
		style: z.enum(["NORMAL", "MUTED", "STRONG"]),
	}),
	z.object({
		kind: z.literal("KEY_VALUES"),
		title: z.string().optional(),
		columns: z.union([z.literal(1), z.literal(2)]),
		rows: z.array(z.object({ label: z.string(), value: z.string() })),
	}),
	z.object({
		kind: z.literal("TABLE"),
		title: z.string().optional(),
		columns: z.array(
			z.object({
				label: z.string(),
				align: DocumentAlignEnum,
				weight: z.number().positive(),
			}),
		),
		/** Row-major cells, already aligned to `columns` by index. */
		rows: z.array(z.array(z.string())),
		empty_text: z.string().optional(),
	}),
	z.object({
		kind: z.literal("TOTALS"),
		rows: z.array(
			z.object({
				label: z.string(),
				value: z.string(),
				emphasis: z.boolean(),
			}),
		),
	}),
	z.object({ kind: z.literal("DIVIDER") }),
	z.object({
		kind: z.literal("SPACER"),
		size: z.enum(["SMALL", "MEDIUM", "LARGE"]),
	}),
	z.object({ kind: z.literal("SIGNATURE"), label: z.string() }),
]);

export type DocumentBlock = z.infer<typeof DocumentBlockSchema>;

/** A composed document: page furniture plus body, all resolved. */
export const ComposedDocumentSchema = z.object({
	template_id: z.string(),
	kind: DocumentKindEnum,
	locale: z.string(),
	/** Document title — used for the PDF metadata and the HTML `<title>`. */
	title: z.string(),
	header: z.array(DocumentBlockSchema),
	body: z.array(DocumentBlockSchema),
	footer: z.array(DocumentBlockSchema),
});

export type ComposedDocument = z.infer<typeof ComposedDocumentSchema>;

// ---------------------------------------------------------------------------
// Payload building blocks shared across document kinds
// ---------------------------------------------------------------------------

/** A postal address as it prints. Every part optional — real data is patchy. */
export const DocumentAddressSchema = z.object({
	line1: z.string().optional(),
	line2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	postal_code: z.string().optional(),
	country: z.string().optional(),
});

export type DocumentAddress = z.infer<typeof DocumentAddressSchema>;

/** A named party on a document — the guest, or the company being billed. */
export const DocumentPartySchema = z.object({
	name: z.string(),
	address: DocumentAddressSchema.optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	/** The party's own tax number, where one was captured. */
	tax_id: z.string().optional(),
});

export type DocumentParty = z.infer<typeof DocumentPartySchema>;

/**
 * A tax registration line — "VAT Reg. No. GB123456789".
 *
 * Most EU jurisdictions require the issuer's registration number on a document
 * that functions as an invoice, which is PMS-15-17. It is a list because a
 * property can hold more than one (VAT plus a municipal tourist-tax number is
 * the common case).
 */
export const DocumentTaxRegistrationSchema = z.object({
	label: z.string(),
	value: z.string(),
});

export type DocumentTaxRegistration = z.infer<
	typeof DocumentTaxRegistrationSchema
>;

/** The issuing property, as it appears at the top of every document. */
export const DocumentPropertySchema = z.object({
	property_id: uuid,
	name: z.string(),
	/** Registered legal entity, where it differs from the trading name. */
	legal_name: z.string().optional(),
	address: DocumentAddressSchema.optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	website: z.string().optional(),
	tax_registrations: z.array(DocumentTaxRegistrationSchema).default([]),
});

export type DocumentProperty = z.infer<typeof DocumentPropertySchema>;

// ---------------------------------------------------------------------------
// Folio payload — the first document, and the one that proves the design
// ---------------------------------------------------------------------------

/** One charge line on a folio. Mirrors a `charge_postings` row as it prints. */
export const FolioDocumentChargeSchema = z.object({
	posting_id: uuid,
	posting_date: z.string(),
	charge_code: z.string(),
	description: z.string(),
	quantity: z.number().optional(),
	unit_price: z.number().optional(),
	subtotal: z.number().optional(),
	tax_amount: z.number().optional(),
	total_amount: z.number(),
	/** Room this line belongs to on a multi-room booking (WS-01). */
	room_number: z.string().optional(),
});

export type FolioDocumentCharge = z.infer<typeof FolioDocumentChargeSchema>;

/** One payment or credit applied to the folio. */
export const FolioDocumentPaymentSchema = z.object({
	payment_id: uuid,
	payment_date: z.string(),
	method: z.string(),
	reference: z.string().optional(),
	amount: z.number(),
});

export type FolioDocumentPayment = z.infer<typeof FolioDocumentPaymentSchema>;

/** A tax summary line — one row per tax code applied across the folio. */
export const FolioDocumentTaxSchema = z.object({
	code: z.string(),
	label: z.string(),
	/** Percentage as stored, e.g. 20 for 20%. */
	rate: z.number().optional(),
	taxable_amount: z.number().optional(),
	amount: z.number(),
});

export type FolioDocumentTax = z.infer<typeof FolioDocumentTaxSchema>;

/** The stay a folio belongs to, where it belongs to one. */
export const FolioDocumentStaySchema = z.object({
	reservation_id: uuid.optional(),
	confirmation_number: z.string().optional(),
	room_number: z.string().optional(),
	room_type: z.string().optional(),
	arrival_date: z.string().optional(),
	departure_date: z.string().optional(),
	nights: z.number().int().optional(),
	adults: z.number().int().optional(),
	children: z.number().int().optional(),
	rate_plan: z.string().optional(),
});

export type FolioDocumentStay = z.infer<typeof FolioDocumentStaySchema>;

/**
 * Everything needed to print a folio, assembled by `billing-service` and handed
 * over whole.
 *
 * Amounts are plain numbers in `currency_code`, already rounded by the caller —
 * the renderer formats, it does not do arithmetic. Anything it computed itself
 * would be a second opinion on the balance, and a folio with two opinions about
 * the balance is worse than no folio.
 */
export const FolioDocumentSchema = z.object({
	kind: z.literal("FOLIO"),
	property: DocumentPropertySchema,
	guest: DocumentPartySchema,
	company: DocumentPartySchema.optional(),
	folio: z.object({
		folio_id: uuid,
		folio_number: z.string(),
		folio_type: z.string(),
		folio_status: z.string(),
		currency_code: z.string(),
		opened_at: z.string(),
		closed_at: z.string().optional(),
		reference_number: z.string().optional(),
	}),
	stay: FolioDocumentStaySchema.optional(),
	charges: z.array(FolioDocumentChargeSchema).default([]),
	payments: z.array(FolioDocumentPaymentSchema).default([]),
	taxes: z.array(FolioDocumentTaxSchema).default([]),
	totals: z.object({
		total_charges: z.number(),
		total_payments: z.number(),
		total_credits: z.number(),
		balance: z.number(),
	}),
	/** ISO instant the document was assembled; printed in the footer. */
	generated_at: z.string(),
});

export type FolioDocument = z.infer<typeof FolioDocumentSchema>;

// ---------------------------------------------------------------------------
// The render request
// ---------------------------------------------------------------------------

/**
 * What a caller posts to the document service.
 *
 * `payload` is validated against the schema for `kind` by the service, not
 * here — keeping it `unknown` at this layer is what lets one request type serve
 * every document kind without a discriminated union that has to grow with each.
 */
export const DocumentRenderRequestSchema = z.object({
	template_id: z.string().min(1),
	format: DocumentFormatEnum.default("PDF"),
	/** BCP-47 tag. Falls back to `en` when no string table is registered for it. */
	locale: z.string().min(2).default("en"),
	payload: z.unknown(),
});

export type DocumentRenderRequest = z.infer<typeof DocumentRenderRequestSchema>;

/** Metadata returned alongside a rendered document. */
export const DocumentRenderMetaSchema = z.object({
	template_id: z.string(),
	kind: DocumentKindEnum,
	format: DocumentFormatEnum,
	locale: z.string(),
	title: z.string(),
	/** Size of the rendered body in bytes. */
	bytes: z.number().int().nonnegative(),
});

export type DocumentRenderMeta = z.infer<typeof DocumentRenderMetaSchema>;

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/**
 * Why a render was refused.
 *
 * Machine-readable for the same reason the restriction refusals are: a caller
 * needs to tell "this template does not exist" (a deployment problem) from
 * "this folio has 40,000 postings" (a data problem) without parsing prose.
 */
export const DocumentRenderErrorCodeEnum = z.enum([
	/** No template registered under the requested id. */
	"TEMPLATE_NOT_FOUND",
	/** The template's document kind has no payload schema yet. */
	"UNSUPPORTED_KIND",
	/** Payload did not validate against the schema for the template's kind. */
	"PAYLOAD_INVALID",
	/** Composed document exceeded the configured row ceiling. */
	"TOO_MANY_ROWS",
	/** The emitter itself failed. */
	"RENDER_FAILED",
]);

export type DocumentRenderErrorCode = z.infer<
	typeof DocumentRenderErrorCodeEnum
>;

/** A refused render, with enough detail to act on. */
export const DocumentRenderFailureSchema = z.object({
	code: DocumentRenderErrorCodeEnum,
	message: z.string(),
	/** Field-level detail for `PAYLOAD_INVALID`; the offending path and reason. */
	issues: z
		.array(z.object({ path: z.string(), message: z.string() }))
		.optional(),
});

export type DocumentRenderFailure = z.infer<typeof DocumentRenderFailureSchema>;
