/**
 * DEV DOC
 * Module: services/render-service.ts
 * Purpose: Validate, compose and emit — the whole render pipeline, minus HTTP.
 * Ownership: document-service
 *
 * Returns a result rather than throwing, so the route maps outcomes to status
 * codes and the pipeline itself stays testable without a server.
 */
import {
  type ComposedDocument,
  composeDocument,
  type DocumentFormat,
  type DocumentKind,
  type DocumentRenderFailure,
  FolioDocumentSchema,
} from "@tartware/schemas";
import type { ZodTypeAny } from "zod";

import { config } from "../config.js";
import { emitHtml } from "../emitters/html.js";
import { emitPdf } from "../emitters/pdf.js";
import { resolveLocale } from "../locales/index.js";
import { getTemplate } from "../templates/index.js";

/**
 * Payload schema per document kind.
 *
 * A kind with no entry is registered but not yet renderable; the folio is the
 * first, and the rest of WS-06 fills this in.
 */
const PAYLOAD_SCHEMAS: Partial<Record<DocumentKind, ZodTypeAny>> = {
  FOLIO: FolioDocumentSchema,
};

/** MIME type per output format. */
export const CONTENT_TYPES: Record<DocumentFormat, string> = {
  PDF: "application/pdf",
  HTML: "text/html; charset=utf-8",
};

type RenderSuccess = {
  ok: true;
  body: Buffer;
  contentType: string;
  meta: {
    template_id: string;
    kind: DocumentKind;
    format: DocumentFormat;
    locale: string;
    title: string;
    bytes: number;
  };
};

type RenderResult = RenderSuccess | { ok: false; failure: DocumentRenderFailure };

/** Total table rows in a composed document. */
const countTableRows = (document: ComposedDocument): number =>
  [...document.header, ...document.body, ...document.footer].reduce(
    (total, block) => (block.kind === "TABLE" ? total + block.rows.length : total),
    0,
  );

/** Compose and emit one document. */
export const renderDocument = async (input: {
  templateId: string;
  format: DocumentFormat;
  locale: string;
  payload: unknown;
}): Promise<RenderResult> => {
  const template = getTemplate(input.templateId);
  if (!template) {
    return {
      ok: false,
      failure: {
        code: "TEMPLATE_NOT_FOUND",
        message: `No template registered as "${input.templateId}"`,
      },
    };
  }

  const payloadSchema = PAYLOAD_SCHEMAS[template.kind];
  if (!payloadSchema) {
    return {
      ok: false,
      failure: {
        code: "UNSUPPORTED_KIND",
        message: `No payload schema for document kind "${template.kind}"`,
      },
    };
  }

  const parsed = payloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        code: "PAYLOAD_INVALID",
        message: `Payload is not a valid ${template.kind} document`,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  const { locale, strings } = resolveLocale(input.locale);
  const composed = composeDocument({
    template,
    payload: parsed.data,
    locale,
    strings,
    timeZone: config.render.timeZone,
  });

  const rows = countTableRows(composed);
  if (rows > config.render.maxTableRows) {
    // Refused rather than truncated: a folio missing its last 200 charges is a
    // worse outcome than no folio, because it looks complete.
    return {
      ok: false,
      failure: {
        code: "TOO_MANY_ROWS",
        message: `Document has ${rows} table rows, above the ${config.render.maxTableRows} limit`,
      },
    };
  }

  try {
    const body =
      input.format === "PDF" ? await emitPdf(composed) : Buffer.from(emitHtml(composed), "utf8");

    return {
      ok: true,
      body,
      contentType: CONTENT_TYPES[input.format],
      meta: {
        template_id: template.id,
        kind: template.kind,
        format: input.format,
        locale: composed.locale,
        title: composed.title,
        bytes: body.byteLength,
      },
    };
  } catch (error) {
    return {
      ok: false,
      failure: {
        code: "RENDER_FAILED",
        message: error instanceof Error ? error.message : "Emitter failed",
      },
    };
  }
};
