import {
  type AuditLogParams,
  type FlowApprovalParams,
  hashIdentifier,
  recordAuditLog as record,
  recordFlowApproval as recordApproval,
  redactPayload,
} from "@tartware/config";

import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";

export { hashIdentifier, redactPayload };

/**
 * Persists an audit log entry to the shared public.audit_logs table.
 */
export const recordAuditLog = async (params: AuditLogParams): Promise<void> => {
  await record(query, params);
};

/**
 * Records a gate bypass (a `force`-style override of a blocking precondition)
 * to the shared public.flow_approvals table.
 *
 * Failure to log is warned, never thrown — the operator already forced the
 * operation and a logging fault must not undo it.
 */
export const recordFlowApproval = async (params: FlowApprovalParams): Promise<void> => {
  await recordApproval(query, params, (error) => {
    reservationsLogger.warn({ error, gate: params.gateName }, "Failed to record flow approval");
  });
};
