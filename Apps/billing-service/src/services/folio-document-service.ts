/**
 * DEV DOC
 * Module: folio-document-service.ts
 * Purpose: Hand an assembled folio payload to the document service and return
 *          the rendered bytes.
 * Ownership: billing-service
 *
 * The caller's own bearer token is forwarded rather than a shared service
 * secret: the renderer only needs to know the request came from an
 * authenticated caller, and a token that is already scoped to this request is a
 * better thing to send than a standing credential.
 */
import type { DocumentFormat, DocumentRenderFailure, FolioDocument } from "@tartware/schemas";

import { config } from "../config.js";

/** A rendered document, or the reason it was refused. */
type FolioRenderOutcome =
  | { ok: true; body: Buffer; contentType: string; locale: string; title: string }
  | { ok: false; status: number; failure: DocumentRenderFailure };

/** Render one assembled folio through the document service. */
export const renderFolioDocument = async (input: {
  payload: FolioDocument;
  format: DocumentFormat;
  locale: string;
  templateId: string;
  authorization?: string;
}): Promise<FolioRenderOutcome> => {
  const url = `${config.documentServiceUrl}/v1/documents/render`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(input.authorization ? { authorization: input.authorization } : {}),
      },
      body: JSON.stringify({
        template_id: input.templateId,
        format: input.format,
        locale: input.locale,
        payload: input.payload,
      }),
      signal: AbortSignal.timeout(config.documentRenderTimeoutMs),
    });
  } catch (error) {
    // A renderer that is down or slow must not look like a folio that is wrong.
    return {
      ok: false,
      status: 503,
      failure: {
        code: "RENDER_FAILED",
        message:
          error instanceof Error
            ? `Document service unreachable: ${error.message}`
            : "Document service unreachable",
      },
    };
  }

  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as DocumentRenderFailure | null;
    return {
      ok: false,
      status: response.status,
      failure: failure ?? {
        code: "RENDER_FAILED",
        message: `Document service returned ${response.status}`,
      },
    };
  }

  return {
    ok: true,
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    locale: response.headers.get("x-document-locale") ?? input.locale,
    title: decodeURIComponent(response.headers.get("x-document-title") ?? ""),
  };
};
