import type {
  ModuleAccessRequest,
  ModuleId,
  ModuleRequestStatus,
  TenantModulesResponse,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { MODULE_DEFINITIONS } from "../modules/module-registry.js";
import {
  CREATE_MODULE_REQUEST_SQL,
  GET_MODULE_REQUEST_BY_ID_SQL,
  LIST_MODULE_REQUESTS_SQL,
  LIST_MY_MODULE_REQUESTS_SQL,
  REVIEW_MODULE_REQUEST_SQL,
} from "../sql/module-request-queries.js";
import { getTenantModules, updateTenantModules } from "./tenant-module-service.js";

/** Raised when the request is already decided, or was never this tenant's. */
export class ModuleRequestNotPendingError extends Error {
  constructor() {
    super("This request has already been reviewed.");
    this.name = "ModuleRequestNotPendingError";
  }
}

/** Raised when the module is already switched on, so there is nothing to ask for. */
export class ModuleAlreadyEnabledError extends Error {
  constructor(moduleId: string) {
    super(`${MODULE_DEFINITIONS[moduleId as ModuleId]?.name ?? moduleId} is already switched on.`);
    this.name = "ModuleAlreadyEnabledError";
  }
}

type ModuleRequestRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  module_id: string;
  requested_by: string;
  requested_by_name: string | null;
  requested_screen: string | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | string | null;
  review_notes: string | null;
  created_at: Date | string;
};

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

const toModuleAccessRequest = (row: ModuleRequestRow): ModuleAccessRequest => ({
  id: row.id,
  tenantId: row.tenant_id,
  propertyId: row.property_id,
  moduleId: row.module_id as ModuleId,
  // Falls back to the raw id only if the registry ever drops a module that
  // still has history — better a slug than a blank cell in the review panel.
  moduleName: MODULE_DEFINITIONS[row.module_id as ModuleId]?.name ?? row.module_id,
  requestedBy: row.requested_by,
  requestedByName: row.requested_by_name ?? "Unknown user",
  requestedScreen: row.requested_screen,
  reason: row.reason,
  status: row.status as ModuleRequestStatus,
  reviewedBy: row.reviewed_by,
  reviewedByName: row.reviewed_by_name,
  reviewedAt: toIso(row.reviewed_at),
  reviewNotes: row.review_notes,
  createdAt: toIso(row.created_at) as string,
});

const fetchRequest = async (
  requestId: string,
  tenantId: string,
): Promise<ModuleAccessRequest | null> => {
  const { rows } = await query<ModuleRequestRow>(GET_MODULE_REQUEST_BY_ID_SQL, [
    requestId,
    tenantId,
  ]);
  return rows[0] ? toModuleAccessRequest(rows[0]) : null;
};

/**
 * Raise (or join) a request to have a module switched on. Anyone with a
 * membership can call this — being blocked by the module is the whole point,
 * so requiring the module's own permission would be circular.
 */
export const createModuleRequest = async (input: {
  tenantId: string;
  userId: string;
  moduleId: ModuleId;
  propertyId?: string;
  requestedScreen?: string;
  reason?: string;
}): Promise<ModuleAccessRequest> => {
  const enabled = await getTenantModules(input.tenantId);
  if (enabled.modules.includes(input.moduleId)) {
    throw new ModuleAlreadyEnabledError(input.moduleId);
  }

  const { rows } = await query<{ id: string }>(CREATE_MODULE_REQUEST_SQL, [
    input.tenantId,
    input.propertyId ?? null,
    input.moduleId,
    input.userId,
    input.requestedScreen ?? null,
    input.reason ?? null,
  ]);

  const created = rows[0] ? await fetchRequest(rows[0].id, input.tenantId) : null;
  if (!created) {
    throw new Error("Failed to record the module request.");
  }
  return created;
};

/** The admin queue: pending first, then the decided history. */
export const listModuleRequests = async (
  tenantId: string,
  status?: ModuleRequestStatus,
  limit = 100,
): Promise<ModuleAccessRequest[]> => {
  const { rows } = await query<ModuleRequestRow>(LIST_MODULE_REQUESTS_SQL, [
    tenantId,
    status ?? null,
    limit,
  ]);
  return rows.map(toModuleAccessRequest);
};

/** What the caller has asked for, so a non-admin can see where their ask stands. */
export const listMyModuleRequests = async (
  tenantId: string,
  userId: string,
): Promise<ModuleAccessRequest[]> => {
  const { rows } = await query<ModuleRequestRow>(LIST_MY_MODULE_REQUESTS_SQL, [tenantId, userId]);
  return rows.map(toModuleAccessRequest);
};

/**
 * Record a decision. Approving also switches the module on — that is the point
 * of the request, and leaving the admin a second manual step is how a queue
 * ends up full of approved-but-still-broken screens.
 */
export const reviewModuleRequest = async (input: {
  tenantId: string;
  requestId: string;
  reviewerId: string;
  decision: Extract<ModuleRequestStatus, "approved" | "rejected">;
  notes?: string;
}): Promise<{ request: ModuleAccessRequest; modules: TenantModulesResponse | null }> => {
  const { rows } = await query<{ id: string; module_id: string }>(REVIEW_MODULE_REQUEST_SQL, [
    input.requestId,
    input.tenantId,
    input.decision,
    input.reviewerId,
    input.notes ?? null,
  ]);

  // No row matched: either it is not this tenant's request, or another admin
  // decided it first. Both mean the caller should re-read the queue.
  const decided = rows[0];
  if (!decided) {
    throw new ModuleRequestNotPendingError();
  }

  let modules: TenantModulesResponse | null = null;
  if (input.decision === "approved") {
    const current = await getTenantModules(input.tenantId);
    modules = await updateTenantModules(input.tenantId, [
      ...current.modules,
      decided.module_id as ModuleId,
    ]);
  }

  const request = await fetchRequest(input.requestId, input.tenantId);
  if (!request) {
    throw new Error("Failed to read back the reviewed request.");
  }
  return { request, modules };
};
