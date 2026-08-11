/**
 * Operations Routes
 * Purpose: REST endpoints for cashier sessions, shift handovers, lost & found,
 *          banquet orders, guest feedback, and police reports
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createPoliceReport,
  getBanquetOrderById,
  getCashierSessionById,
  getGuestFeedbackById,
  getLostFoundItemById,
  getPoliceReportById,
  getShiftHandoverById,
  listBanquetOrders,
  listCashierSessions,
  listGuestFeedback,
  listLostFoundItems,
  listPoliceReports,
  listShiftHandovers,
  updatePoliceReport,
  updatePoliceReportStatus,
} from "../services/operations-service.js";

// =====================================================
// CASHIER SESSION ROUTES
// =====================================================

export function registerCashierSessionRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/cashier-sessions - List cashier sessions
  // ---------------------------------------------------
  fastify.get(
    "/v1/cashier-sessions",
    {
      schema: {
        summary: "List cashier sessions",
        tags: ["Cashier Sessions"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            session_status: {
              type: "string",
              enum: [
                "open",
                "suspended",
                "closed",
                "reconciled",
                "audited",
                "disputed",
                "cancelled",
              ],
            },
            business_date: { type: "string", format: "date" },
            cashier_id: { type: "string", format: "uuid" },
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
          session_status?: string;
          business_date?: string;
          cashier_id?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, session_status, business_date, cashier_id, limit, offset } =
        request.query;

      const sessions = await listCashierSessions({
        tenantId: tenant_id,
        propertyId: property_id,
        sessionStatus: session_status,
        businessDate: business_date,
        cashierId: cashier_id,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: sessions,
        meta: { count: sessions.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/cashier-sessions/:sessionId - Get session by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/cashier-sessions/:sessionId",
    {
      schema: {
        summary: "Get cashier session by ID",
        tags: ["Cashier Sessions"],
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
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
        Params: { sessionId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = request.params;
      const { tenant_id } = request.query;

      const session = await getCashierSessionById({
        sessionId,
        tenantId: tenant_id,
      });

      if (!session) {
        return reply.notFound("Cashier session not found");
      }

      return reply.send({ data: session });
    },
  );
}

// =====================================================
// SHIFT HANDOVER ROUTES
// =====================================================

export function registerShiftHandoverRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/shift-handovers - List shift handovers
  // ---------------------------------------------------
  fastify.get(
    "/v1/shift-handovers",
    {
      schema: {
        summary: "List shift handovers",
        tags: ["Shift Handovers"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            handover_status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "acknowledged", "escalated"],
            },
            shift_date: { type: "string", format: "date" },
            department: {
              type: "string",
              enum: [
                "front_desk",
                "housekeeping",
                "maintenance",
                "food_beverage",
                "management",
                "sales",
                "security",
                "spa",
                "concierge",
                "other",
              ],
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
          handover_status?: string;
          shift_date?: string;
          department?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, handover_status, shift_date, department, limit, offset } =
        request.query;

      const handovers = await listShiftHandovers({
        tenantId: tenant_id,
        propertyId: property_id,
        handoverStatus: handover_status,
        shiftDate: shift_date,
        department: department,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: handovers,
        meta: { count: handovers.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/shift-handovers/:handoverId - Get handover by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/shift-handovers/:handoverId",
    {
      schema: {
        summary: "Get shift handover by ID",
        tags: ["Shift Handovers"],
        params: {
          type: "object",
          required: ["handoverId"],
          properties: {
            handoverId: { type: "string", format: "uuid" },
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
        Params: { handoverId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { handoverId } = request.params;
      const { tenant_id } = request.query;

      const handover = await getShiftHandoverById({
        handoverId,
        tenantId: tenant_id,
      });

      if (!handover) {
        return reply.notFound("Shift handover not found");
      }

      return reply.send({ data: handover });
    },
  );
}

// =====================================================
// LOST AND FOUND ROUTES
// =====================================================

export function registerLostFoundRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/lost-and-found - List lost and found items
  // ---------------------------------------------------
  fastify.get(
    "/v1/lost-and-found",
    {
      schema: {
        summary: "List lost and found items",
        tags: ["Lost and Found"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            item_status: {
              type: "string",
              enum: [
                "registered",
                "stored",
                "claimed",
                "returned",
                "shipped",
                "donated",
                "disposed",
                "lost_again",
                "pending_claim",
              ],
            },
            item_category: {
              type: "string",
              enum: [
                "electronics",
                "jewelry",
                "clothing",
                "accessories",
                "documents",
                "keys",
                "bags",
                "wallets",
                "phones",
                "laptops",
                "tablets",
                "watches",
                "glasses",
                "books",
                "toys",
                "medical",
                "other",
              ],
            },
            found_date_from: { type: "string", format: "date" },
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
          item_status?: string;
          item_category?: string;
          found_date_from?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, item_status, item_category, found_date_from, limit, offset } =
        request.query;

      const items = await listLostFoundItems({
        tenantId: tenant_id,
        propertyId: property_id,
        itemStatus: item_status,
        itemCategory: item_category,
        foundDateFrom: found_date_from,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: items,
        meta: { count: items.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/lost-and-found/:itemId - Get item by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/lost-and-found/:itemId",
    {
      schema: {
        summary: "Get lost and found item by ID",
        tags: ["Lost and Found"],
        params: {
          type: "object",
          required: ["itemId"],
          properties: {
            itemId: { type: "string", format: "uuid" },
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
        Params: { itemId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { itemId } = request.params;
      const { tenant_id } = request.query;

      const item = await getLostFoundItemById({
        itemId,
        tenantId: tenant_id,
      });

      if (!item) {
        return reply.notFound("Lost and found item not found");
      }

      return reply.send({ data: item });
    },
  );
}

// =====================================================
// BANQUET EVENT ORDER ROUTES
// =====================================================

export function registerBanquetOrderRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/banquet-orders - List banquet event orders
  // ---------------------------------------------------
  fastify.get(
    "/v1/banquet-orders",
    {
      schema: {
        summary: "List banquet event orders (BEOs)",
        tags: ["Banquet Orders"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            beo_status: {
              type: "string",
              enum: [
                "DRAFT",
                "PENDING_APPROVAL",
                "APPROVED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
              ],
            },
            event_date: { type: "string", format: "date" },
            meeting_room_id: { type: "string", format: "uuid" },
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
          beo_status?: string;
          event_date?: string;
          meeting_room_id?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, beo_status, event_date, meeting_room_id, limit, offset } =
        request.query;

      const orders = await listBanquetOrders({
        tenantId: tenant_id,
        propertyId: property_id,
        beoStatus: beo_status,
        eventDate: event_date,
        meetingRoomId: meeting_room_id,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: orders,
        meta: { count: orders.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/banquet-orders/:beoId - Get BEO by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/banquet-orders/:beoId",
    {
      schema: {
        summary: "Get banquet event order by ID",
        tags: ["Banquet Orders"],
        params: {
          type: "object",
          required: ["beoId"],
          properties: {
            beoId: { type: "string", format: "uuid" },
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
        Params: { beoId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { beoId } = request.params;
      const { tenant_id } = request.query;

      const order = await getBanquetOrderById({
        beoId,
        tenantId: tenant_id,
      });

      if (!order) {
        return reply.notFound("Banquet event order not found");
      }

      return reply.send({ data: order });
    },
  );
}

// =====================================================
// GUEST FEEDBACK ROUTES
// =====================================================

export function registerGuestFeedbackRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/guest-feedback - List guest feedback
  // ---------------------------------------------------
  fastify.get(
    "/v1/guest-feedback",
    {
      schema: {
        summary: "List guest feedback and reviews",
        tags: ["Guest Feedback"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            sentiment_label: {
              type: "string",
              enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
            },
            is_public: { type: "boolean" },
            has_response: { type: "boolean" },
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
          sentiment_label?: string;
          is_public?: boolean;
          has_response?: boolean;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id, property_id, sentiment_label, is_public, has_response, limit, offset } =
        request.query;

      const feedback = await listGuestFeedback({
        tenantId: tenant_id,
        propertyId: property_id,
        sentimentLabel: sentiment_label,
        isPublic: is_public,
        hasResponse: has_response,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: feedback,
        meta: { count: feedback.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/guest-feedback/:feedbackId - Get feedback by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/guest-feedback/:feedbackId",
    {
      schema: {
        summary: "Get guest feedback by ID",
        tags: ["Guest Feedback"],
        params: {
          type: "object",
          required: ["feedbackId"],
          properties: {
            feedbackId: { type: "string", format: "uuid" },
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
        Params: { feedbackId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { feedbackId } = request.params;
      const { tenant_id } = request.query;

      const item = await getGuestFeedbackById({
        feedbackId,
        tenantId: tenant_id,
      });

      if (!item) {
        return reply.notFound("Guest feedback not found");
      }

      return reply.send({ data: item });
    },
  );
}

// =====================================================
// POLICE REPORT ROUTES
// =====================================================

export function registerPoliceReportRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------
  // GET /v1/police-reports - List police reports
  // ---------------------------------------------------
  fastify.get(
    "/v1/police-reports",
    {
      schema: {
        summary: "List police/incident reports",
        tags: ["Police Reports"],
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            report_status: {
              type: "string",
              enum: [
                "filed",
                "under_investigation",
                "closed",
                "charges_filed",
                "no_action",
                "referred",
                "pending",
              ],
            },
            incident_type: {
              type: "string",
              enum: [
                "theft",
                "assault",
                "vandalism",
                "trespassing",
                "fraud",
                "suspicious_activity",
                "missing_person",
                "death",
                "drug_related",
                "domestic_disturbance",
                "noise_complaint",
                "vehicle_incident",
                "other",
              ],
            },
            incident_date_from: { type: "string", format: "date" },
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
          report_status?: string;
          incident_type?: string;
          incident_date_from?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const {
        tenant_id,
        property_id,
        report_status,
        incident_type,
        incident_date_from,
        limit,
        offset,
      } = request.query;

      const reports = await listPoliceReports({
        tenantId: tenant_id,
        propertyId: property_id,
        reportStatus: report_status,
        incidentType: incident_type,
        incidentDateFrom: incident_date_from,
        limit: limit,
        offset: offset,
      });

      return reply.send({
        data: reports,
        meta: { count: reports.length },
        offset: offset ?? 0,
      });
    },
  );

  // ---------------------------------------------------
  // GET /v1/police-reports/:reportId - Get report by ID
  // ---------------------------------------------------
  fastify.get(
    "/v1/police-reports/:reportId",
    {
      schema: {
        summary: "Get police report by ID",
        tags: ["Police Reports"],
        params: {
          type: "object",
          required: ["reportId"],
          properties: {
            reportId: { type: "string", format: "uuid" },
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
        Params: { reportId: string };
        Querystring: { tenant_id: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { reportId } = request.params;
      const { tenant_id } = request.query;

      const report = await getPoliceReportById({
        reportId,
        tenantId: tenant_id,
      });

      if (!report) {
        return reply.notFound("Police report not found");
      }

      return reply.send({ data: report });
    },
  );

  // ---------------------------------------------------
  // POST /v1/police-reports - File a report
  //
  // The register was read-only until 2026-08-11: two GETs over a table with no
  // write path anywhere, so nothing could file a report through the product.
  // See ui-gaps/02-police-reports.md.
  // ---------------------------------------------------
  const policeReportWriteProperties = {
    incident_id: { type: "string", format: "uuid" },
    incident_date: { type: "string", format: "date" },
    incident_time: { type: "string" },
    reported_date: { type: "string", format: "date" },
    incident_type: {
      type: "string",
      enum: [
                "theft",
                "assault",
                "vandalism",
                "trespassing",
                "fraud",
                "suspicious_activity",
                "missing_person",
                "death",
                "drug_related",
                "domestic_disturbance",
                "noise_complaint",
                "vehicle_incident",
                "other",
      ],
    },
    incident_description: { type: "string", minLength: 1, maxLength: 5000 },
    incident_location: { type: "string", maxLength: 255 },
    room_number: { type: "string", maxLength: 50 },
    agency_name: { type: "string", minLength: 1, maxLength: 255 },
    agency_jurisdiction: { type: "string", maxLength: 255 },
    agency_contact_number: { type: "string", maxLength: 50 },
    responding_officer_name: { type: "string", maxLength: 255 },
    responding_officer_badge: { type: "string", maxLength: 100 },
    guest_involved: { type: "boolean" },
    staff_involved: { type: "boolean" },
    property_stolen: { type: "boolean" },
    total_loss_value: { type: "number", minimum: 0 },
    injuries_reported: { type: "boolean" },
  } as const;

  type PoliceReportWriteBody = {
    tenant_id: string;
    property_id?: string;
    incident_id?: string;
    incident_date?: string;
    incident_time?: string;
    reported_date?: string;
    incident_type?: string;
    incident_description?: string;
    incident_location?: string;
    room_number?: string;
    agency_name?: string;
    agency_jurisdiction?: string;
    agency_contact_number?: string;
    responding_officer_name?: string;
    responding_officer_badge?: string;
    guest_involved?: boolean;
    staff_involved?: boolean;
    property_stolen?: boolean;
    total_loss_value?: number;
    injuries_reported?: boolean;
  };

  const toWriteInput = (body: PoliceReportWriteBody) => ({
    incidentId: body.incident_id,
    incidentDate: body.incident_date as string,
    incidentTime: body.incident_time,
    reportedDate: body.reported_date,
    incidentType: body.incident_type,
    incidentDescription: body.incident_description as string,
    incidentLocation: body.incident_location,
    roomNumber: body.room_number,
    agencyName: body.agency_name as string,
    agencyJurisdiction: body.agency_jurisdiction,
    agencyContactNumber: body.agency_contact_number,
    respondingOfficerName: body.responding_officer_name,
    respondingOfficerBadge: body.responding_officer_badge,
    guestInvolved: body.guest_involved,
    staffInvolved: body.staff_involved,
    propertyStolen: body.property_stolen,
    totalLossValue: body.total_loss_value,
    injuriesReported: body.injuries_reported,
  });

  fastify.post(
    "/v1/police-reports",
    {
      schema: {
        summary: "File a police report",
        tags: ["Police Reports"],
        body: {
          type: "object",
          required: [
            "tenant_id",
            "property_id",
            "incident_date",
            "incident_description",
            "agency_name",
          ],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            property_id: { type: "string", format: "uuid" },
            ...policeReportWriteProperties,
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: PoliceReportWriteBody }>, reply: FastifyReply) => {
      const report = await createPoliceReport(
        request.body.tenant_id,
        { ...toWriteInput(request.body), propertyId: request.body.property_id as string },
        (request as { userId?: string }).userId,
      );

      if (!report) {
        return reply.internalServerError("Failed to file police report");
      }

      return reply.status(201).send({ data: report, message: "Police report filed" });
    },
  );

  // ---------------------------------------------------
  // PUT /v1/police-reports/:reportId - Correct a report
  // ---------------------------------------------------
  fastify.put(
    "/v1/police-reports/:reportId",
    {
      schema: {
        summary: "Correct a filed police report",
        tags: ["Police Reports"],
        params: {
          type: "object",
          required: ["reportId"],
          properties: { reportId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            ...policeReportWriteProperties,
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { reportId: string }; Body: PoliceReportWriteBody }>,
      reply: FastifyReply,
    ) => {
      const report = await updatePoliceReport(
        request.body.tenant_id,
        request.params.reportId,
        toWriteInput(request.body),
        (request as { userId?: string }).userId,
      );

      if (!report) {
        return reply.notFound("Police report not found");
      }

      return reply.send({ data: report, message: "Police report updated" });
    },
  );

  // ---------------------------------------------------
  // POST /v1/police-reports/:reportId/status - Move status
  // ---------------------------------------------------
  fastify.post(
    "/v1/police-reports/:reportId/status",
    {
      schema: {
        summary: "Update police report status and case number",
        tags: ["Police Reports"],
        params: {
          type: "object",
          required: ["reportId"],
          properties: { reportId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["tenant_id", "report_status"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            report_status: {
              type: "string",
              enum: [
                "filed",
                "under_investigation",
                "closed",
                "charges_filed",
                "no_action",
                "referred",
                "pending",
              ],
            },
            police_case_number: { type: "string", maxLength: 100 },
            lead_investigator_name: { type: "string", maxLength: 255 },
            follow_up_required: { type: "boolean" },
            follow_up_date: { type: "string", format: "date" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { reportId: string };
        Body: {
          tenant_id: string;
          report_status: string;
          police_case_number?: string;
          lead_investigator_name?: string;
          follow_up_required?: boolean;
          follow_up_date?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const report = await updatePoliceReportStatus(
        request.body.tenant_id,
        request.params.reportId,
        {
          reportStatus: request.body.report_status,
          policeCaseNumber: request.body.police_case_number,
          leadInvestigatorName: request.body.lead_investigator_name,
          followUpRequired: request.body.follow_up_required,
          followUpDate: request.body.follow_up_date,
        },
        (request as { userId?: string }).userId,
      );

      if (!report) {
        return reply.notFound("Police report not found");
      }

      return reply.send({ data: report, message: "Police report status updated" });
    },
  );
}
