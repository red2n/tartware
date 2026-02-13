/**
 * Compliance Routes
 * Purpose: REST endpoints for data breach incident management
 *          and data retention policy administration.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  getBreachIncidentById,
  listBreachIncidents,
  notifyBreach,
  reportBreach,
} from "../services/compliance-service.js";

export function registerComplianceRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/compliance/breach-incidents - List incidents
  // ---------------------------------------------------
  fastify.get(
    "/v1/compliance/breach-incidents",
    {
      schema: {
        summary: "List data breach incidents",
        tags: ["Compliance"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: [
                "reported",
                "investigating",
                "contained",
                "notifying",
                "remediated",
                "closed",
                "escalated",
              ],
            },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          tenant_id: string;
          property_id?: string;
          status?: string;
          severity?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, status, severity, limit, offset } = request.query;
      const incidents = await listBreachIncidents({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        severity,
        limit,
        offset,
      });
      return reply.send({
        data: incidents,
        meta: { count: incidents.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/compliance/breach-incidents/:incidentId
  // ---------------------------------------------------
  fastify.get(
    "/v1/compliance/breach-incidents/:incidentId",
    {
      schema: {
        summary: "Get breach incident by ID",
        tags: ["Compliance"],
        params: {
          type: "object",
          required: ["incidentId"],
          properties: {
            incidentId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { incidentId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const incident = await getBreachIncidentById(
        request.query.tenant_id,
        request.params.incidentId,
      );
      if (!incident) {
        return reply.status(404).send({ error: "Breach incident not found" });
      }
      return reply.send({ data: incident });
    },
  );

  // ---------------------------------------------------
  // POST /v1/compliance/breach-incidents - Report breach
  // ---------------------------------------------------
  fastify.post(
    "/v1/compliance/breach-incidents",
    {
      schema: {
        summary: "Report a data breach incident",
        tags: ["Compliance"],
        body: {
          type: "object",
          required: [
            "tenant_id",
            "incident_title",
            "incident_description",
            "severity",
            "breach_type",
            "discovered_at",
          ],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            incident_title: { type: "string", minLength: 1, maxLength: 300 },
            incident_description: { type: "string", minLength: 1 },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            breach_type: {
              type: "string",
              enum: [
                "unauthorized_access",
                "data_loss",
                "data_theft",
                "system_compromise",
                "phishing",
                "insider_threat",
                "ransomware",
                "accidental_disclosure",
                "other",
              ],
            },
            discovered_at: { type: "string", format: "date-time" },
            occurred_at: { type: "string", format: "date-time" },
            data_categories_affected: {
              type: "array",
              items: { type: "string" },
            },
            systems_affected: {
              type: "array",
              items: { type: "string" },
            },
            subjects_affected_count: { type: "integer", minimum: 0 },
            assigned_to: { type: "string", format: "uuid" },
            metadata: { type: "object" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          tenant_id: string;
          property_id?: string;
          incident_title: string;
          incident_description: string;
          severity: string;
          breach_type: string;
          discovered_at: string;
          occurred_at?: string;
          data_categories_affected?: string[];
          systems_affected?: string[];
          subjects_affected_count?: number;
          assigned_to?: string;
          metadata?: Record<string, unknown>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const body = request.body;
      const result = await reportBreach({
        tenantId: body.tenant_id,
        propertyId: body.property_id,
        incidentTitle: body.incident_title,
        incidentDescription: body.incident_description,
        severity: body.severity,
        breachType: body.breach_type,
        discoveredAt: body.discovered_at,
        occurredAt: body.occurred_at,
        dataCategoriesAffected: body.data_categories_affected,
        systemsAffected: body.systems_affected,
        subjectsAffectedCount: body.subjects_affected_count,
        assignedTo: body.assigned_to,
        reportedBy: (request as unknown as { tenantContext?: { userId?: string } }).tenantContext
          ?.userId,
        metadata: body.metadata,
      });
      return reply.status(201).send({
        data: result,
        message: "Breach incident reported. 72-hour notification deadline set.",
      });
    },
  );

  // ---------------------------------------------------
  // PUT /v1/compliance/breach-incidents/:incidentId/notify
  // ---------------------------------------------------
  fastify.put(
    "/v1/compliance/breach-incidents/:incidentId/notify",
    {
      schema: {
        summary: "Notify authority/subjects of a data breach",
        tags: ["Compliance"],
        params: {
          type: "object",
          required: ["incidentId"],
          properties: {
            incidentId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            authority_reference: { type: "string", maxLength: 200 },
            notify_subjects: { type: "boolean" },
            notification_notes: { type: "string", maxLength: 2000 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { incidentId: string };
        Body: {
          tenant_id: string;
          authority_reference?: string;
          notify_subjects?: boolean;
          notification_notes?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      await notifyBreach({
        tenantId: request.body.tenant_id,
        incidentId: request.params.incidentId,
        authorityReference: request.body.authority_reference,
        notifySubjects: request.body.notify_subjects,
        updatedBy: (request as unknown as { tenantContext?: { userId?: string } }).tenantContext
          ?.userId,
      });
      return reply.send({
        message: "Breach notification recorded.",
      });
    },
  );
}
