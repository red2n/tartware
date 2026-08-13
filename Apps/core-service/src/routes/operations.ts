/**
 * Operations Routes
 * Purpose: REST endpoints for cashier sessions, shift handovers, lost & found,
 *          banquet orders, guest feedback, and police reports
 */

import { schemaFromZod } from "@tartware/openapi";
import type {
  GuestFeedbackResolveBody,
  GuestFeedbackRespondBody,
  GuestFeedbackUpdateBody,
  GuestFeedbackWriteBody,
  PoliceReportStatusBody,
  PoliceReportUpdateBody,
  PoliceReportWriteBody,
  SelfServiceFeedbackBody,
  ShiftHandoverAcknowledgeBody,
  ShiftHandoverUpdateBody,
  ShiftHandoverWriteBody,
} from "@tartware/schemas";
import {
  GuestFeedbackResolveBodySchema,
  GuestFeedbackRespondBodySchema,
  GuestFeedbackUpdateBodySchema,
  GuestFeedbackWriteBodySchema,
  PoliceReportStatusBodySchema,
  PoliceReportUpdateBodySchema,
  PoliceReportWriteBodySchema,
  SelfServiceFeedbackBodySchema,
  ShiftHandoverAcknowledgeBodySchema,
  ShiftHandoverUpdateBodySchema,
  ShiftHandoverWriteBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  acknowledgeShiftHandover,
  createGuestFeedback,
  createPoliceReport,
  createSelfServiceFeedback,
  createShiftHandover,
  getBanquetOrderById,
  getCashierSessionById,
  getGuestFeedbackById,
  getPoliceReportById,
  getShiftHandoverById,
  listBanquetOrders,
  listCashierSessions,
  listGuestFeedback,
  listPoliceReports,
  listShiftHandovers,
  resolveGuestFeedback,
  respondToGuestFeedback,
  updateGuestFeedback,
  updatePoliceReport,
  updatePoliceReportStatus,
  updateShiftHandover,
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

  // ---------------------------------------------------
  // Write path — see ui-gaps/08-shift-handovers.md.
  // ---------------------------------------------------
  const handoverIdParams = {
    type: "object",
    required: ["handoverId"],
    properties: { handoverId: { type: "string", format: "uuid" } },
  } as const;

  const toHandoverInput = (body: ShiftHandoverUpdateBody) => ({
    handoverTitle: body.handover_title,
    keyPoints: body.key_points,
    importantNotes: body.important_notes,
    urgentMatters: body.urgent_matters,
    handoverStatus: body.handover_status,
    requiresFollowUp: body.requires_follow_up,
    cashOnHand: body.cash_on_hand,
    depositsToMake: body.deposits_to_make,
    paymentIssues: body.payment_issues,
    staffIssues: body.staff_issues,
    specialSituations: body.special_situations,
  });

  fastify.post(
    "/v1/shift-handovers",
    {
      schema: {
        summary: "Open a shift handover",
        description:
          "Opens the handover at the start of the outgoing shift; it is filled as the shift runs and acknowledged by the incoming user.",
        tags: ["Shift Handovers"],
        body: schemaFromZod(ShiftHandoverWriteBodySchema, "ShiftHandoverWriteBody"),
      },
    },
    async (request: FastifyRequest<{ Body: ShiftHandoverWriteBody }>, reply: FastifyReply) => {
      const body = request.body;
      const handover = await createShiftHandover(
        body.tenant_id,
        {
          ...toHandoverInput(body),
          propertyId: body.property_id,
          shiftDate: body.shift_date,
          department: body.department,
          outgoingShift: body.outgoing_shift,
          outgoingUserId: body.outgoing_user_id,
          outgoingUserName: body.outgoing_user_name,
          incomingShift: body.incoming_shift,
          incomingUserId: body.incoming_user_id,
          incomingUserName: body.incoming_user_name,
          keyPoints: body.key_points,
        },
        (request as { userId?: string }).userId,
      );

      if (!handover) {
        return reply.internalServerError("Failed to open shift handover");
      }

      return reply.status(201).send({ data: handover, message: "Shift handover opened" });
    },
  );

  fastify.put(
    "/v1/shift-handovers/:handoverId",
    {
      schema: {
        summary: "Update an open shift handover",
        tags: ["Shift Handovers"],
        params: handoverIdParams,
        body: schemaFromZod(ShiftHandoverUpdateBodySchema, "ShiftHandoverUpdateBody"),
      },
    },
    async (
      request: FastifyRequest<{ Params: { handoverId: string }; Body: ShiftHandoverUpdateBody }>,
      reply: FastifyReply,
    ) => {
      const handover = await updateShiftHandover(
        request.body.tenant_id,
        request.params.handoverId,
        toHandoverInput(request.body),
        (request as { userId?: string }).userId,
      );

      if (!handover) {
        return reply.notFound("Shift handover not found");
      }

      return reply.send({ data: handover, message: "Shift handover updated" });
    },
  );

  fastify.post(
    "/v1/shift-handovers/:handoverId/acknowledge",
    {
      schema: {
        summary: "Acknowledge a shift handover",
        description:
          "The incoming staff member signs off. Rejected with 404 if already acknowledged — who took the handover and when must not be overwritten.",
        tags: ["Shift Handovers"],
        params: handoverIdParams,
        body: schemaFromZod(ShiftHandoverAcknowledgeBodySchema, "ShiftHandoverAcknowledgeBody"),
      },
    },
    async (
      request: FastifyRequest<{
        Params: { handoverId: string };
        Body: ShiftHandoverAcknowledgeBody;
      }>,
      reply: FastifyReply,
    ) => {
      const body = request.body;
      const handover = await acknowledgeShiftHandover(
        body.tenant_id,
        request.params.handoverId,
        {
          acknowledgmentNotes: body.acknowledgment_notes,
          questionsAsked: body.questions_asked,
          handoverQualityRating: body.handover_quality_rating,
        },
        (request as { userId?: string }).userId,
      );

      if (!handover) {
        return reply.notFound("Shift handover not found, or already acknowledged");
      }

      return reply.send({ data: handover, message: "Shift handover acknowledged" });
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
            feedback_status: {
              type: "string",
              enum: ["new", "acknowledged", "in_progress", "responded", "resolved", "closed"],
            },
            feedback_category: { type: "string" },
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
          feedback_status?: string;
          feedback_category?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const {
        tenant_id,
        property_id,
        sentiment_label,
        is_public,
        has_response,
        feedback_status,
        feedback_category,
        limit,
        offset,
      } = request.query;

      const feedback = await listGuestFeedback({
        tenantId: tenant_id,
        propertyId: property_id,
        sentimentLabel: sentiment_label,
        isPublic: is_public,
        hasResponse: has_response,
        feedbackStatus: feedback_status,
        feedbackCategory: feedback_category,
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

  // ---------------------------------------------------
  // Write path. Intake and the response loop — see ui-gaps/09-guest-feedback.md.
  // ---------------------------------------------------
  const feedbackIdParams = {
    type: "object",
    required: ["feedbackId"],
    properties: { feedbackId: { type: "string", format: "uuid" } },
  } as const;

  fastify.post(
    "/v1/guest-feedback",
    {
      schema: {
        summary: "Log guest feedback",
        description:
          "Intake for portal, survey, OTA and staff-entered feedback. guest_id and reservation_id are optional: a phone complaint may have neither.",
        tags: ["Guest Feedback"],
        body: schemaFromZod(GuestFeedbackWriteBodySchema, "GuestFeedbackWriteBody"),
      },
    },
    async (request: FastifyRequest<{ Body: GuestFeedbackWriteBody }>, reply: FastifyReply) => {
      const body = request.body;
      const feedback = await createGuestFeedback(body.tenant_id, {
        propertyId: body.property_id,
        feedbackSource: body.feedback_source,
        reviewText: body.review_text,
        guestId: body.guest_id,
        reservationId: body.reservation_id,
        reviewTitle: body.review_title,
        overallRating: body.overall_rating,
        ratingScale: body.rating_scale,
        cleanlinessRating: body.cleanliness_rating,
        staffRating: body.staff_rating,
        locationRating: body.location_rating,
        valueRating: body.value_rating,
        wouldRecommend: body.would_recommend,
        wouldReturn: body.would_return,
        feedbackCategory: body.feedback_category,
        sentimentLabel: body.sentiment_label,
        isPublic: body.is_public,
        languageCode: body.language_code,
      });

      if (!feedback) {
        return reply.internalServerError("Failed to log guest feedback");
      }

      return reply.status(201).send({ data: feedback, message: "Guest feedback logged" });
    },
  );

  fastify.put(
    "/v1/guest-feedback/:feedbackId",
    {
      schema: {
        summary: "Triage guest feedback",
        description: "Categorise, set sentiment, assign an owner, adjust publication.",
        tags: ["Guest Feedback"],
        params: feedbackIdParams,
        body: schemaFromZod(GuestFeedbackUpdateBodySchema, "GuestFeedbackUpdateBody"),
      },
    },
    async (
      request: FastifyRequest<{ Params: { feedbackId: string }; Body: GuestFeedbackUpdateBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body;
      const feedback = await updateGuestFeedback(body.tenant_id, request.params.feedbackId, {
        feedbackCategory: body.feedback_category,
        sentimentLabel: body.sentiment_label,
        feedbackStatus: body.feedback_status,
        assignedTo: body.assigned_to,
        isPublic: body.is_public,
        isFeatured: body.is_featured,
        isVerified: body.is_verified,
      });

      if (!feedback) {
        return reply.notFound("Guest feedback not found");
      }

      return reply.send({ data: feedback, message: "Guest feedback updated" });
    },
  );

  fastify.post(
    "/v1/guest-feedback/:feedbackId/respond",
    {
      schema: {
        summary: "Record the response sent to the guest",
        tags: ["Guest Feedback"],
        params: feedbackIdParams,
        body: schemaFromZod(GuestFeedbackRespondBodySchema, "GuestFeedbackRespondBody"),
      },
    },
    async (
      request: FastifyRequest<{ Params: { feedbackId: string }; Body: GuestFeedbackRespondBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body;
      const feedback = await respondToGuestFeedback(
        body.tenant_id,
        request.params.feedbackId,
        { responseText: body.response_text, isPublic: body.is_public },
        (request as { userId?: string }).userId,
      );

      if (!feedback) {
        return reply.notFound("Guest feedback not found");
      }

      return reply.send({ data: feedback, message: "Response recorded" });
    },
  );

  /**
   * Guest-portal intake. Registered on core-service because it owns
   * `guest_feedback`; a second writer in guests-service would be the
   * duplicate-surface pattern this backlog keeps having to unpick.
   * See ui-gaps/09-guest-feedback.md.
   */
  fastify.post(
    "/v1/self-service/feedback",
    {
      schema: {
        summary: "Submit guest feedback from the guest portal",
        description:
          "Unauthenticated. The confirmation code is the credential: guest, property and stay are derived from the reservation it resolves to, and the source is fixed to GUEST_PORTAL.",
        tags: ["Guest Feedback"],
        body: schemaFromZod(SelfServiceFeedbackBodySchema, "SelfServiceFeedbackBody"),
      },
    },
    async (request: FastifyRequest<{ Body: SelfServiceFeedbackBody }>, reply: FastifyReply) => {
      const body = SelfServiceFeedbackBodySchema.parse(request.body);
      const feedback = await createSelfServiceFeedback(body.tenant_id, {
        confirmationCode: body.confirmation_code,
        reviewText: body.review_text,
        reviewTitle: body.review_title,
        overallRating: body.overall_rating,
        cleanlinessRating: body.cleanliness_rating,
        staffRating: body.staff_rating,
        locationRating: body.location_rating,
        valueRating: body.value_rating,
        wouldRecommend: body.would_recommend,
        wouldReturn: body.would_return,
      });

      if (!feedback) {
        return reply.notFound("No reservation found for that confirmation code");
      }

      // The guest gets an acknowledgement, not the stored record — it carries
      // internal triage fields they have no business seeing.
      return reply.status(201).send({ message: "Thank you — your feedback has been recorded." });
    },
  );

  fastify.post(
    "/v1/guest-feedback/:feedbackId/resolve",
    {
      schema: {
        summary: "Close guest feedback with a resolution",
        description:
          "service_recovery_reference links the comp posting or gesture to the complaint that caused it.",
        tags: ["Guest Feedback"],
        params: feedbackIdParams,
        body: schemaFromZod(GuestFeedbackResolveBodySchema, "GuestFeedbackResolveBody"),
      },
    },
    async (
      request: FastifyRequest<{ Params: { feedbackId: string }; Body: GuestFeedbackResolveBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body;
      const feedback = await resolveGuestFeedback(
        body.tenant_id,
        request.params.feedbackId,
        {
          resolutionNotes: body.resolution_notes,
          serviceRecoveryReference: body.service_recovery_reference,
          feedbackStatus: body.feedback_status,
        },
        (request as { userId?: string }).userId,
      );

      if (!feedback) {
        return reply.notFound("Guest feedback not found");
      }

      return reply.send({ data: feedback, message: "Guest feedback resolved" });
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
  const toWriteInput = (body: PoliceReportUpdateBody) => ({
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
        body: schemaFromZod(PoliceReportWriteBodySchema, "PoliceReportWriteBody"),
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
        body: schemaFromZod(PoliceReportUpdateBodySchema, "PoliceReportUpdateBody"),
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
        body: schemaFromZod(PoliceReportStatusBodySchema, "PoliceReportStatusBody"),
      },
    },
    async (
      request: FastifyRequest<{
        Params: { reportId: string };
        Body: PoliceReportStatusBody;
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
