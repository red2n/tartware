import { type AuditLogParams, hashIdentifier, recordAuditLog as record } from "@tartware/config";

import { query } from "../lib/db.js";

export { hashIdentifier };

/**
 * Persists an audit log entry to the shared public.audit_logs table.
 */
export const recordAuditLog = async (params: AuditLogParams): Promise<void> => {
  await record(query, params);
};
