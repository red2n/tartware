import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  EventBookingListItemSchema,
  EventBookingStatusEnum,
  EventTypeEnum,
  MeetingRoomListItemSchema,
  MeetingRoomStatusEnum,
  MeetingRoomTypeEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getEventBookingById,
  getMeetingRoomById,
  listEventBookings,
  listMeetingRooms,
} from "../../services/booking-config/event.js";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerEventRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------
  // MEETING ROOMS
  // -------------------------------------------------

  const MeetingRoomListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    room_type: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || MeetingRoomTypeEnum.options.includes(val as never), {
        message: "Invalid room type",
      }),
    room_status: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || MeetingRoomStatusEnum.options.includes(val as never), {
        message: "Invalid room status",
      }),
    is_active: z.coerce.boolean().optional(),
    min_capacity: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type MeetingRoomListQuery = z.infer<typeof MeetingRoomListQuerySchema>;

  const MeetingRoomListResponseSchema = z.array(MeetingRoomListItemSchema);
  const MeetingRoomListQueryJsonSchema = schemaFromZod(
    MeetingRoomListQuerySchema,
    "MeetingRoomListQuery",
  );
  const MeetingRoomListResponseJsonSchema = schemaFromZod(
    MeetingRoomListResponseSchema,
    "MeetingRoomListResponse",
  );
  const MeetingRoomDetailResponseJsonSchema = schemaFromZod(
    MeetingRoomListItemSchema,
    "MeetingRoomDetailResponse",
  );
  const MeetingRoomParamsSchema = z.object({ roomId: z.string().uuid() });
  const MeetingRoomIdParamJsonSchema = schemaFromZod(MeetingRoomParamsSchema, "MeetingRoomIdParam");

  const MEETING_ROOMS_TAG = "Meeting Rooms";

  app.get<{ Querystring: MeetingRoomListQuery }>(
    "/v1/meeting-rooms",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MeetingRoomListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "List meeting rooms",
        description:
          "Retrieve conference rooms, ballrooms, and event spaces with capacity and features",
        querystring: MeetingRoomListQueryJsonSchema,
        response: { 200: MeetingRoomListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        room_type,
        room_status,
        is_active,
        min_capacity,
        limit,
        offset,
      } = MeetingRoomListQuerySchema.parse(request.query);
      const rooms = await listMeetingRooms({
        tenantId: tenant_id,
        propertyId: property_id,
        roomType: room_type,
        roomStatus: room_status,
        isActive: is_active,
        minCapacity: min_capacity,
        limit,
        offset,
      });
      return MeetingRoomListResponseSchema.parse(rooms);
    },
  );

  app.get<{ Params: z.infer<typeof MeetingRoomParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/meeting-rooms/:roomId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "Get meeting room details",
        description: "Retrieve detailed information about a specific meeting room",
        params: MeetingRoomIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "MeetingRoomDetailQuery",
        ),
        response: { 200: MeetingRoomDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { roomId } = MeetingRoomParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const room = await getMeetingRoomById({ roomId, tenantId: tenant_id });
      if (!room) {
        return reply.status(404).send({ error: "Meeting room not found" });
      }
      return MeetingRoomListItemSchema.parse(room);
    },
  );

  // -------------------------------------------------
  // EVENT BOOKINGS
  // -------------------------------------------------

  const EventBookingListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    event_type: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || EventTypeEnum.options.includes(val as never), {
        message: "Invalid event type",
      }),
    booking_status: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || EventBookingStatusEnum.options.includes(val as never), {
        message: "Invalid booking status",
      }),
    event_date_from: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "event_date_from must be a valid ISO date",
      }),
    event_date_to: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "event_date_to must be a valid ISO date",
      }),
    meeting_room_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type EventBookingListQuery = z.infer<typeof EventBookingListQuerySchema>;

  const EventBookingListResponseSchema = z.array(EventBookingListItemSchema);
  const EventBookingListQueryJsonSchema = schemaFromZod(
    EventBookingListQuerySchema,
    "EventBookingListQuery",
  );
  const EventBookingListResponseJsonSchema = schemaFromZod(
    EventBookingListResponseSchema,
    "EventBookingListResponse",
  );
  const EventBookingDetailResponseJsonSchema = schemaFromZod(
    EventBookingListItemSchema,
    "EventBookingDetailResponse",
  );
  const EventBookingParamsSchema = z.object({ eventId: z.string().uuid() });
  const EventBookingIdParamJsonSchema = schemaFromZod(
    EventBookingParamsSchema,
    "EventBookingIdParam",
  );

  const EVENT_BOOKINGS_TAG = "Event Bookings";

  app.get<{ Querystring: EventBookingListQuery }>(
    "/v1/event-bookings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as EventBookingListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "List event bookings",
        description:
          "Retrieve meeting, conference, wedding, and banquet bookings with status and attendee details",
        querystring: EventBookingListQueryJsonSchema,
        response: { 200: EventBookingListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        event_type,
        booking_status,
        event_date_from,
        event_date_to,
        meeting_room_id,
        limit,
        offset,
      } = EventBookingListQuerySchema.parse(request.query);
      const events = await listEventBookings({
        tenantId: tenant_id,
        propertyId: property_id,
        eventType: event_type,
        bookingStatus: booking_status,
        eventDateFrom: event_date_from,
        eventDateTo: event_date_to,
        meetingRoomId: meeting_room_id,
        limit,
        offset,
      });
      return EventBookingListResponseSchema.parse(events);
    },
  );

  app.get<{ Params: z.infer<typeof EventBookingParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/event-bookings/:eventId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "Get event booking details",
        description: "Retrieve detailed information about a specific event booking",
        params: EventBookingIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "EventBookingDetailQuery",
        ),
        response: { 200: EventBookingDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { eventId } = EventBookingParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const event = await getEventBookingById({ eventId, tenantId: tenant_id });
      if (!event) {
        return reply.status(404).send({ error: "Event booking not found" });
      }
      return EventBookingListItemSchema.parse(event);
    },
  );
};
