/**
 * DEV DOC
 * Module: incident-repository.ts
 * Purpose: Incident reports raised by housekeeping and maintenance staff.
 * Ownership: housekeeping-service
 *
 * Lifted verbatim out of `services/housekeeping-service.ts`. Each function
 * takes the same input object the service function received, so the parameter
 * expressions moved unchanged.
 */

import type { IncidentStatusInput, IncidentWriteInput } from "@tartware/schemas";

import { query } from "../lib/db.js";

const INSERT_INCIDENT_SQL = `
      INSERT INTO public.incident_reports (
        tenant_id, property_id, incident_number,
        incident_title, incident_type, incident_category, severity, severity_score,
        incident_date, incident_time, incident_datetime,
        incident_location, room_number, area_name,
        incident_description, immediate_actions_taken,
        incident_status,
        guest_involved, staff_involved, injury_severity, police_notified,
        discovered_by, discovered_by_name,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        $4, $5, $6, $7, $8,
        $9::date, $10::time, ($9::date + $10::time) AT TIME ZONE 'UTC',
        $11, $12, $13,
        $14, $15,
        'reported',
        COALESCE($16, false), COALESCE($17, false), $18, COALESCE($19, false),
        $20::uuid, $21,
        $20::uuid, $20::uuid
      )
      RETURNING incident_id
    `;

const UPDATE_INCIDENT_SQL = `
      UPDATE public.incident_reports
      SET
        incident_title = COALESCE($3, incident_title),
        incident_type = COALESCE($4, incident_type),
        incident_category = COALESCE($5, incident_category),
        severity = COALESCE($6, severity),
        severity_score = COALESCE($7, severity_score),
        incident_location = COALESCE($8, incident_location),
        room_number = COALESCE($9, room_number),
        area_name = COALESCE($10, area_name),
        incident_description = COALESCE($11, incident_description),
        immediate_actions_taken = COALESCE($12, immediate_actions_taken),
        guest_involved = COALESCE($13, guest_involved),
        staff_involved = COALESCE($14, staff_involved),
        injury_severity = COALESCE($15, injury_severity),
        police_notified = COALESCE($16, police_notified),
        updated_at = NOW(),
        updated_by = $17::uuid
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const SET_INCIDENT_STATUS_SQL = `
      UPDATE public.incident_reports
      SET
        incident_status = $3::text,
        closure_notes = COALESCE($4, closure_notes),
        -- The table models closure as closed/closed_at/closed_by rather than a
        -- resolved_at timestamp, so a terminal status stamps all three. Verified
        -- against the live columns: there is no resolution_notes or resolved_at.
        closed = CASE WHEN $3::text IN ('resolved', 'closed') THEN true ELSE closed END,
        closed_at = CASE
          WHEN $3::text IN ('resolved', 'closed') THEN COALESCE(closed_at, NOW())
          ELSE closed_at
        END,
        closed_by = CASE
          WHEN $3::text IN ('resolved', 'closed') THEN COALESCE(closed_by, $5::uuid)
          ELSE closed_by
        END,
        updated_at = NOW(),
        updated_by = $5::uuid
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

/**
 * Record a new incident report.
 */
export const insertIncident = (
  tenantId: string,
  input: IncidentWriteInput,
  incidentNumber: string,
  actorId: string,
) =>
  query<{ incident_id: string }>(INSERT_INCIDENT_SQL, [
    tenantId,
    input.propertyId,
    incidentNumber,
    input.incidentTitle,
    input.incidentType,
    input.incidentCategory ?? null,
    input.severity,
    input.severityScore ?? null,
    input.incidentDate,
    input.incidentTime,
    input.incidentLocation,
    input.roomNumber ?? null,
    input.areaName ?? null,
    input.incidentDescription,
    input.immediateActionsTaken,
    input.guestInvolved ?? null,
    input.staffInvolved ?? null,
    input.injurySeverity ?? null,
    input.policeNotified ?? null,
    actorId,
    input.discoveredByName ?? null,
  ]);

/**
 * Amend an incident's details.
 */
export const updateIncident = (
  tenantId: string,
  incidentId: string,
  input: Partial<IncidentWriteInput>,
  actorId: string,
) =>
  query(UPDATE_INCIDENT_SQL, [
    tenantId,
    incidentId,
    input.incidentTitle ?? null,
    input.incidentType ?? null,
    input.incidentCategory ?? null,
    input.severity ?? null,
    input.severityScore ?? null,
    input.incidentLocation ?? null,
    input.roomNumber ?? null,
    input.areaName ?? null,
    input.incidentDescription ?? null,
    input.immediateActionsTaken ?? null,
    input.guestInvolved ?? null,
    input.staffInvolved ?? null,
    input.injurySeverity ?? null,
    input.policeNotified ?? null,
    actorId,
  ]);

/**
 * Move an incident through its status workflow.
 */
export const setIncidentStatus = (
  tenantId: string,
  incidentId: string,
  input: IncidentStatusInput,
  actorId: string,
) =>
  query(SET_INCIDENT_STATUS_SQL, [
    tenantId,
    incidentId,
    input.incidentStatus,
    input.closureNotes ?? null,
    actorId,
  ]);
