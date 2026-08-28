/**
 * DEV DOC
 * Module: config.ts
 * Purpose: Environment configuration for the document service.
 * Ownership: document-service
 *
 * This service holds no database pool and no Kafka client. It takes a payload
 * and gives back bytes, which is why the config below carries neither — see
 * `index.ts` for what that means for the boot-time dependency check.
 */
import {
  buildAuthConfig,
  buildLogConfig,
  buildServiceInfo,
  ensureAuthDefaults,
  initServiceIdentity,
  loadServiceConfig,
} from "@tartware/config";
import { z } from "zod";

initServiceIdentity("@tartware/document-service");
ensureAuthDefaults();

const configValues = loadServiceConfig();

/** Service-local env schema — config only, never shared. */
const documentEnvSchema = z.object({
  /**
   * Largest render payload accepted. A folio with a thousand postings is a
   * legitimate group master; a 50 MB body is not, and this service has no
   * database to check the difference against.
   */
  DOCUMENT_MAX_PAYLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024),
  /** Ceiling on rows rendered per table, so one payload cannot produce a 10,000-page PDF. */
  DOCUMENT_MAX_TABLE_ROWS: z.coerce.number().int().positive().default(5000),
  /** IANA zone every date on a document is formatted in. */
  DOCUMENT_TIME_ZONE: z.string().default("UTC"),
  /**
   * Path to a TTF used as the PDF body font.
   *
   * Unset, the emitter uses Helvetica, whose WinAnsi coverage handles Latin
   * scripts (`en`, `fr`) and nothing else. A deployment that renders documents
   * in a non-Latin script — the UI already ships `zh-TW` — points this at a
   * font covering it. Not shipped in the repository: a CJK face is ~20 MB.
   */
  DOCUMENT_BODY_FONT_PATH: z.string().optional(),
});

const documentEnv = documentEnvSchema.parse(process.env);

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  auth: buildAuthConfig(),
  render: {
    maxPayloadBytes: documentEnv.DOCUMENT_MAX_PAYLOAD_BYTES,
    maxTableRows: documentEnv.DOCUMENT_MAX_TABLE_ROWS,
    timeZone: documentEnv.DOCUMENT_TIME_ZONE,
    bodyFontPath: documentEnv.DOCUMENT_BODY_FONT_PATH,
  },
};
