import type { FastifyInstance } from "fastify";
import {
  getAutomatedMessage,
  listAutomatedMessages,
} from "../services/automated-message-service.js";
import {
  getCommunication,
  listGuestCommunications,
} from "../services/notification-dispatch-service.js";
import { getTemplate, listTemplates } from "../services/template-service.js";

type TenantParams = { tenantId: string };
type TemplateParams = TenantParams & { templateId: string };
type GuestParams = TenantParams & { guestId: string };
type CommunicationParams = TenantParams & { communicationId: string };
type AutomatedMessageParams = TenantParams & { messageId: string };
type PaginationQuery = { limit?: string; offset?: string };

/**
 * Register notification REST routes.
 *
 * Read endpoints (GET) are served directly by this service.
 * Write operations go through the Command Center pipeline (Kafka commands.primary).
 */
export const registerNotificationRoutes = (app: FastifyInstance): void => {
  // ─── Templates (Read) ───────────────────────────────────────────

  app.get<{ Params: TenantParams; Querystring: PaginationQuery }>(
    "/v1/tenants/:tenantId/notifications/templates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Math.max(Number(request.query.offset) || 0, 0);

      const templates = await listTemplates(tenantId, limit, offset);
      return reply.send({ data: templates, limit, offset });
    },
  );

  app.get<{ Params: TemplateParams }>(
    "/v1/tenants/:tenantId/notifications/templates/:templateId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TemplateParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId, templateId } = request.params;
      const template = await getTemplate(tenantId, templateId);
      if (!template) {
        return reply.notFound("Notification template not found");
      }
      return reply.send({ data: template });
    },
  );

  // ─── Guest Communications (Read) ───────────────────────────────

  app.get<{ Params: GuestParams; Querystring: PaginationQuery }>(
    "/v1/tenants/:tenantId/notifications/guests/:guestId/communications",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as GuestParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId, guestId } = request.params;
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Math.max(Number(request.query.offset) || 0, 0);

      const communications = await listGuestCommunications(tenantId, guestId, limit, offset);
      return reply.send({ data: communications, limit, offset });
    },
  );

  app.get<{ Params: CommunicationParams }>(
    "/v1/tenants/:tenantId/notifications/communications/:communicationId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as CommunicationParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId, communicationId } = request.params;
      const communication = await getCommunication(tenantId, communicationId);
      if (!communication) {
        return reply.notFound("Communication not found");
      }
      return reply.send({ data: communication });
    },
  );

  // ─── Automated Messages (Read) ─────────────────────────────────

  app.get<{ Params: TenantParams; Querystring: PaginationQuery }>(
    "/v1/tenants/:tenantId/notifications/automated-messages",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as TenantParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Math.max(Number(request.query.offset) || 0, 0);

      const messages = await listAutomatedMessages(tenantId, limit, offset);
      return reply.send({ data: messages, limit, offset });
    },
  );

  app.get<{ Params: AutomatedMessageParams }>(
    "/v1/tenants/:tenantId/notifications/automated-messages/:messageId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as AutomatedMessageParams).tenantId,
        minRole: "STAFF",
      }),
    },
    async (request, reply) => {
      const { tenantId, messageId } = request.params;
      const message = await getAutomatedMessage(tenantId, messageId);
      if (!message) {
        return reply.notFound("Automated message not found");
      }
      return reply.send({ data: message });
    },
  );
};
