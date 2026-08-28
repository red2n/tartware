/**
 * DEV DOC
 * Module: routes/documents.ts
 * Purpose: The render endpoint and template discovery.
 * Ownership: document-service
 *
 * `POST /v1/documents/render` returns the document itself — PDF bytes or an
 * HTML page — not a JSON envelope around a base64 blob. A folio is a file, and
 * every caller (a browser tab, an email attachment, a print job) wants it as
 * one. Render metadata travels in `X-Document-*` response headers so a caller
 * that needs it does not have to parse the body.
 */
import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type DocumentRenderErrorCode,
  DocumentRenderFailureSchema,
  DocumentRenderRequestSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import type { z } from "zod";

import { recordRender } from "../lib/metrics.js";
import { supportedLocales } from "../locales/index.js";
import { renderDocument } from "../services/render-service.js";
import { listTemplates } from "../templates/index.js";

const DOCUMENTS_TAG = "Documents";

/** HTTP status for each refusal reason. */
const STATUS_BY_CODE: Record<DocumentRenderErrorCode, number> = {
  TEMPLATE_NOT_FOUND: 404,
  UNSUPPORTED_KIND: 501,
  PAYLOAD_INVALID: 422,
  TOO_MANY_ROWS: 413,
  RENDER_FAILED: 500,
};

/**
 * Percent-encode a value for an HTTP header.
 *
 * Header values are Latin-1 at best, and a document title is guest-influenced
 * free text — "Note de séjour" is fine, a CJK title is not, and a newline in
 * one would be header injection. Encoding sidesteps all three.
 */
const headerSafe = (value: string): string => encodeURIComponent(value).slice(0, 300);

export const registerDocumentRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/documents/templates",
    {
      schema: buildRouteSchema({
        tag: DOCUMENTS_TAG,
        summary: "List renderable templates and supported locales",
      }),
    },
    async () => ({
      data: listTemplates().map((template) => ({
        id: template.id,
        kind: template.kind,
        name: template.name,
      })),
      locales: supportedLocales(),
    }),
  );

  app.post<{ Body: z.infer<typeof DocumentRenderRequestSchema> }>(
    "/v1/documents/render",
    {
      schema: buildRouteSchema({
        tag: DOCUMENTS_TAG,
        summary: "Render a document to PDF or HTML",
        description:
          "Takes a template id and a payload assembled by the owning service. " +
          "The renderer never queries the database — everything it prints is in the request.",
        body: schemaFromZod(DocumentRenderRequestSchema, "DocumentRenderRequest"),
        response: {
          200: { type: "string", format: "binary" },
          422: schemaFromZod(DocumentRenderFailureSchema, "DocumentRenderFailure"),
        },
      }),
    },
    async (request, reply) => {
      const parsedRequest = DocumentRenderRequestSchema.safeParse(request.body);
      if (!parsedRequest.success) {
        return reply.code(400).send({
          code: "PAYLOAD_INVALID",
          message: "Render request is malformed",
          issues: parsedRequest.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { template_id, format, locale, payload } = parsedRequest.data;
      const startedAt = process.hrtime.bigint();
      const result = await renderDocument({
        templateId: template_id,
        format,
        locale,
        payload,
      });
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

      if (!result.ok) {
        recordRender({
          template: template_id,
          format,
          outcome: "failure",
          durationSeconds,
        });
        request.log.warn(
          { template_id, format, code: result.failure.code },
          "Document render refused",
        );
        return reply.code(STATUS_BY_CODE[result.failure.code]).send(result.failure);
      }

      recordRender({
        template: template_id,
        format,
        outcome: "success",
        durationSeconds,
        bytes: result.meta.bytes,
      });

      const extension = result.meta.format === "PDF" ? "pdf" : "html";
      const filename = `${result.meta.template_id.toLowerCase()}.${extension}`;

      return reply
        .code(200)
        .header("content-type", result.contentType)
        .header("content-length", String(result.meta.bytes))
        .header("content-disposition", `inline; filename="${filename}"`)
        .header("x-document-template", result.meta.template_id)
        .header("x-document-kind", result.meta.kind)
        .header("x-document-locale", result.meta.locale)
        .header("x-document-title", headerSafe(result.meta.title))
        .send(result.body);
    },
  );
};
