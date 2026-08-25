/**
 * DEV DOC
 * Module: maintenance-repository.ts
 * Purpose: Maintenance request lifecycle writes.
 * Ownership: housekeeping-service
 *
 * Lifted verbatim out of `services/maintenance-command-service.ts`. Each
 * function takes the same objects the command handler received, so the
 * parameter expressions moved unchanged.
 */

import type {
  CommandContext,
  OperationsMaintenanceAssignCommand,
  OperationsMaintenanceCompleteCommand,
  OperationsMaintenanceEscalateCommand,
  OperationsMaintenanceRequestCommand,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

const INSERT_MAINTENANCE_REQUEST_SQL = `INSERT INTO maintenance_requests (
       tenant_id, property_id, room_id, room_number,
       request_type, issue_category, issue_description,
       priority, reported_by, reported_at, reporter_role,
       guest_id, reservation_id, location_description,
       affects_occupancy, is_safety_issue,
       request_status, metadata,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       COALESCE($8, 'MEDIUM'), $9, COALESCE($10, NOW()), $11,
       $12, $13, $14,
       COALESCE($15, false), COALESCE($16, false),
       'OPEN', $17::jsonb,
       $18, $18
     ) RETURNING request_id`;

const MARK_REQUEST_ROOM_OUT_OF_SERVICE_SQL = `UPDATE maintenance_requests
       SET room_out_of_service = true,
           oos_from = NOW(),
           affects_occupancy = true
       WHERE request_id = $1`;

const APPLY_MAINTENANCE_ASSIGNMENT_SQL = `UPDATE maintenance_requests
     SET assigned_to = $3,
         assigned_at = NOW(),
         assigned_by = $4,
         maintenance_team = COALESCE($5, maintenance_team),
         scheduled_date = COALESCE($6::date, scheduled_date),
         scheduled_time = COALESCE($7::time, scheduled_time),
         estimated_duration_minutes = COALESCE($8, estimated_duration_minutes),
         request_status = CASE
           WHEN request_status = 'OPEN' THEN 'ASSIGNED'
           ELSE request_status
         END,
         notes = CASE
           WHEN $9::text IS NULL THEN notes
           WHEN notes IS NULL THEN $9::text
           ELSE CONCAT_WS(E'\\n', notes, $9::text)
         END,
         response_time_minutes = EXTRACT(EPOCH FROM (NOW() - reported_at))::int / 60,
         updated_at = NOW(),
         updated_by = $4
     WHERE request_id = $2
       AND tenant_id = $1
       AND is_deleted = false`;

const APPLY_MAINTENANCE_COMPLETION_SQL = `UPDATE maintenance_requests
     SET request_status = 'COMPLETED',
         work_performed = $3,
         parts_used = $4,
         actual_duration_minutes = $5,
         labor_cost = $6,
         parts_cost = $7,
         total_cost = $8,
         is_satisfactory = COALESCE($9, true),
         completion_notes = $10,
         completed_at = NOW(),
         completed_by = $11,
         work_completed_at = NOW(),
         room_out_of_service = false,
         oos_until = CASE
           WHEN room_out_of_service = true THEN NOW()
           ELSE oos_until
         END,
         resolution_time_hours = EXTRACT(EPOCH FROM (NOW() - reported_at))::int / 3600,
         updated_at = NOW(),
         updated_by = $11
     WHERE request_id = $2
       AND tenant_id = $1
       AND is_deleted = false
       AND request_status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')`;

const APPLY_MAINTENANCE_ESCALATION_SQL = `UPDATE maintenance_requests
     SET is_escalated = true,
         escalated_at = NOW(),
         escalated_to = $3,
         escalation_reason = $4,
         priority = COALESCE($5, priority),
         updated_at = NOW(),
         updated_by = $6
     WHERE request_id = $2
       AND tenant_id = $1
       AND is_deleted = false
       AND request_status NOT IN ('COMPLETED', 'CANCELLED')`;

/**
 * Raise a maintenance request.
 */
export const insertMaintenanceRequest = (
  context: CommandContext,
  command: OperationsMaintenanceRequestCommand,
  actor: string,
) =>
  query<{ request_id: string }>(INSERT_MAINTENANCE_REQUEST_SQL, [
    context.tenantId,
    command.property_id,
    command.room_id ?? null,
    command.room_number ?? null,
    command.request_type ?? "CORRECTIVE",
    command.issue_category,
    command.issue_description,
    command.priority ?? null,
    command.reported_by ?? actor,
    command.reported_at ?? null,
    command.reporter_role ?? null,
    command.guest_id ?? null,
    command.reservation_id ?? null,
    command.location_description ?? null,
    command.affects_occupancy ?? null,
    command.is_safety_issue ?? null,
    JSON.stringify(command.metadata ?? {}),
    actor,
  ]);

/**
 * Flag the request as having taken its room out of service.
 */
export const markRequestRoomOutOfService = (requestId: string) =>
  query(MARK_REQUEST_ROOM_OUT_OF_SERVICE_SQL, [requestId]);

/**
 * Assign a request to a technician or team.
 */
export const applyMaintenanceAssignment = (
  context: CommandContext,
  command: OperationsMaintenanceAssignCommand,
  actor: string,
) =>
  query(APPLY_MAINTENANCE_ASSIGNMENT_SQL, [
    context.tenantId,
    command.request_id,
    command.assigned_to,
    actor,
    command.maintenance_team ?? null,
    command.scheduled_date ?? null,
    command.scheduled_time ?? null,
    command.estimated_duration_minutes ?? null,
    command.notes ?? null,
  ]);

/**
 * Close a request with the work performed and its costs.
 */
export const applyMaintenanceCompletion = (
  context: CommandContext,
  command: OperationsMaintenanceCompleteCommand,
  actor: string,
  totalCost: number | null,
) =>
  query(APPLY_MAINTENANCE_COMPLETION_SQL, [
    context.tenantId,
    command.request_id,
    command.work_performed,
    command.parts_used ?? null,
    command.actual_duration_minutes ?? null,
    command.labor_cost ?? null,
    command.parts_cost ?? null,
    totalCost,
    command.is_satisfactory ?? null,
    command.completion_notes ?? null,
    actor,
  ]);

/**
 * Escalate a request and raise its priority.
 */
export const applyMaintenanceEscalation = (
  context: CommandContext,
  command: OperationsMaintenanceEscalateCommand,
  actor: string,
) =>
  query(APPLY_MAINTENANCE_ESCALATION_SQL, [
    context.tenantId,
    command.request_id,
    command.escalated_to,
    command.escalation_reason,
    command.new_priority ?? null,
    actor,
  ]);
