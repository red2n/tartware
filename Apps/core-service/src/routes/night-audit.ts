/**
 * Night Audit Routes
 * Purpose: REST endpoints for night audit status, history, and OTA connections
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  getBusinessDateStatus,
  getNightAuditRunDetail,
  listNightAuditHistory,
  listOtaConnections,
  listOtaSyncLogs,
} from "../services/night-audit-service.js";

// =====================================================
// NIGHT AUDIT ROUTES
// =====================================================

export function registerNightAuditRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/night-audit/status - Current business date status
  // ---------------------------------------------------
  fastify.get(
    "/v1/night-audit/status",
    {
      schema: {
        summary: "Get current business date status for a property",
        tags: ["Night Audit"],
        querystring: {
          type: "object",
          required: ["tenant_id", "property_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          tenant_id: string;
          property_id: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id } = request.query;

      const status = await getBusinessDateStatus({
        tenantId: tenant_id,
        propertyId: property_id,
      });

      if (!status) {
        return reply.notFound("No open business date found for property");
      }

      return reply.send({ data: status });
    },
  );

  // ---------------------------------------------------
  // GET /v1/night-audit/history - Night audit run history
  // ---------------------------------------------------
  fastify.get(
    "/v1/night-audit/history",
    {
      schema: {
        summary: "List night audit run history",
        tags: ["Night Audit"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
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
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, limit, offset } = request.query;

      const runs = await listNightAuditHistory({
        tenantId: tenant_id,
        propertyId: property_id,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: runs,
        meta: { count: runs.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/night-audit/runs/:runId - Night audit run detail
  // ---------------------------------------------------
  fastify.get(
    "/v1/night-audit/runs/:runId",
    {
      schema: {
        summary: "Get night audit run details with step breakdown",
        tags: ["Night Audit"],
        params: {
          type: "object",
          required: ["runId"],
          properties: {
            runId: { type: "string", format: "uuid" },
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
        Params: { runId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { runId } = request.params;
      const { tenant_id } = request.query;

      const runDetail = await getNightAuditRunDetail({
        runId,
        tenantId: tenant_id,
      });

      if (!runDetail) {
        return reply.notFound("Night audit run not found");
      }

      return reply.send({ data: runDetail });
    },
  );
}

// =====================================================
// OTA CONNECTION ROUTES
// =====================================================

export function registerOtaRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/ota-connections - List OTA/channel connections
  // ---------------------------------------------------
  fastify.get(
    "/v1/ota-connections",
    {
      schema: {
        summary: "List OTA/channel manager connections",
        tags: ["OTA Connections"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            connection_status: {
              type: "string",
              enum: ["CONNECTED", "DISCONNECTED", "PENDING", "ERROR", "SUSPENDED"],
            },
            is_active: { type: "boolean" },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
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
          connection_status?: string;
          is_active?: boolean;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, connection_status, is_active, limit, offset } = request.query;

      const connections = await listOtaConnections({
        tenantId: tenant_id,
        propertyId: property_id,
        connectionStatus: connection_status,
        isActive: is_active,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: connections,
        meta: { count: connections.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/ota-connections/:connectionId/sync-history
  // ---------------------------------------------------
  fastify.get(
    "/v1/ota-connections/:connectionId/sync-history",
    {
      schema: {
        summary: "Get sync history for an OTA connection",
        tags: ["OTA Connections"],
        params: {
          type: "object",
          required: ["connectionId"],
          properties: {
            connectionId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { connectionId: string };
        Querystring: {
          tenant_id: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { connectionId } = request.params;
      const { tenant_id, limit, offset } = request.query;

      const logs = await listOtaSyncLogs({
        connectionId,
        tenantId: tenant_id,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: logs,
        meta: { count: logs.length },
        offset: offset ?? 0,
      });
    },
  );
}
