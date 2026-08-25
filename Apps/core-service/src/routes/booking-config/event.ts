import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  EventBookingDetailSchema,
  EventBookingListItemSchema,
  type EventBookingStatusChangeBody,
  EventBookingStatusChangeBodySchema,
  EventBookingStatusEnum,
  type EventBookingUpdateBody,
  EventBookingUpdateBodySchema,
  type EventBookingWriteBody,
  EventBookingWriteBodySchema,
  EventBookingWriteResponseSchema,
  EventTypeEnum,
  MeetingRoomListItemSchema,
  MeetingRoomStatusEnum,
  MeetingRoomTypeEnum,
  type MeetingRoomUpdateBody,
  MeetingRoomUpdateBodySchema,
  type MeetingRoomWriteBody,
  MeetingRoomWriteBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  changeEventBookingStatus,
  createEventBooking,
  createMeetingRoom,
  deleteMeetingRoom,
  EventBookingTransitionError,
  getEventBookingById,
  getMeetingRoomById,
  listEventBookings,
  listMeetingRooms,
  MeetingRoomCodeConflictError,
  MeetingRoomNotFoundError,
  MeetingRoomUnavailableError,
  updateEventBooking,
  updateMeetingRoom,
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
        return reply.notFound("Meeting room not found");
      }
      return MeetingRoomListItemSchema.parse(room);
    },
  );

  // -------------------------------------------------
  // MEETING ROOM WRITES — reference data, plain HTTP per
  // ui-gaps/18-write-path-gap.md. See ui-gaps/13-sales-catering.md.
  // -------------------------------------------------

  const roomWriteScopeFromBody = app.withTenantScope({
    resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const roomDeleteScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const roomTenantQuerySchema = z.object({ tenant_id: z.string().uuid() });

  app.post<{ Body: MeetingRoomWriteBody }>(
    "/v1/meeting-rooms",
    {
      preHandler: roomWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "Create a meeting room",
        description:
          "Function space inventory. room_code is unique per (tenant, property); a collision returns 409.",
        body: schemaFromZod(MeetingRoomWriteBodySchema, "MeetingRoomWriteBody"),
      }),
    },
    async (request, reply) => {
      const body = MeetingRoomWriteBodySchema.parse(request.body);
      let created: Awaited<ReturnType<typeof createMeetingRoom>>;

      try {
        created = await createMeetingRoom(
          body.tenant_id,
          {
            propertyId: body.property_id,
            roomCode: body.room_code,
            roomName: body.room_name,
            roomType: body.room_type,
            roomStatus: body.room_status,
            maxCapacity: body.max_capacity,
            building: body.building,
            floor: body.floor,
            locationDescription: body.location_description,
            theaterCapacity: body.theater_capacity,
            classroomCapacity: body.classroom_capacity,
            banquetCapacity: body.banquet_capacity,
            receptionCapacity: body.reception_capacity,
            uShapeCapacity: body.u_shape_capacity,
            boardroomCapacity: body.boardroom_capacity,
            areaSqm: body.area_sqm,
            areaSqft: body.area_sqft,
            lengthMeters: body.length_meters,
            widthMeters: body.width_meters,
            ceilingHeightMeters: body.ceiling_height_meters,
            hasNaturalLight: body.has_natural_light,
            hasAudioVisual: body.has_audio_visual,
            hasVideoConferencing: body.has_video_conferencing,
            hasWifi: body.has_wifi,
            hasStage: body.has_stage,
            hasDanceFloor: body.has_dance_floor,
            wheelchairAccessible: body.wheelchair_accessible,
            defaultSetup: body.default_setup,
            setupTimeMinutes: body.setup_time_minutes,
            teardownTimeMinutes: body.teardown_time_minutes,
            turnoverTimeMinutes: body.turnover_time_minutes,
            hourlyRate: body.hourly_rate,
            halfDayRate: body.half_day_rate,
            fullDayRate: body.full_day_rate,
            minimumRentalHours: body.minimum_rental_hours,
            currencyCode: body.currency_code,
            operatingHoursStart: body.operating_hours_start,
            operatingHoursEnd: body.operating_hours_end,
            cateringRequired: body.catering_required,
            inHouseCateringAvailable: body.in_house_catering_available,
            externalCateringAllowed: body.external_catering_allowed,
            primaryPhotoUrl: body.primary_photo_url,
            floorPlanUrl: body.floor_plan_url,
            virtualTourUrl: body.virtual_tour_url,
            isActive: body.is_active,
            requiresApproval: body.requires_approval,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        if (error instanceof MeetingRoomCodeConflictError) {
          return reply.conflict(error.message);
        }
        throw error;
      }

      if (!created) {
        return reply.internalServerError("Failed to create meeting room");
      }

      return reply.status(201).send({ data: created, message: "Meeting room created" });
    },
  );

  app.put<{ Params: z.infer<typeof MeetingRoomParamsSchema>; Body: MeetingRoomUpdateBody }>(
    "/v1/meeting-rooms/:roomId",
    {
      preHandler: roomWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "Update a meeting room",
        description:
          "room_code is editable — event bookings and banquet orders reference room_id, not the code.",
        params: MeetingRoomIdParamJsonSchema,
        body: schemaFromZod(MeetingRoomUpdateBodySchema, "MeetingRoomUpdateBody"),
      }),
    },
    async (request, reply) => {
      const body = MeetingRoomUpdateBodySchema.parse(request.body);
      const { roomId } = MeetingRoomParamsSchema.parse(request.params);
      let updated: Awaited<ReturnType<typeof updateMeetingRoom>>;

      try {
        updated = await updateMeetingRoom(
          body.tenant_id,
          roomId,
          {
            roomCode: body.room_code,
            roomName: body.room_name,
            roomType: body.room_type,
            roomStatus: body.room_status,
            maxCapacity: body.max_capacity,
            building: body.building,
            floor: body.floor,
            locationDescription: body.location_description,
            theaterCapacity: body.theater_capacity,
            classroomCapacity: body.classroom_capacity,
            banquetCapacity: body.banquet_capacity,
            receptionCapacity: body.reception_capacity,
            uShapeCapacity: body.u_shape_capacity,
            boardroomCapacity: body.boardroom_capacity,
            areaSqm: body.area_sqm,
            areaSqft: body.area_sqft,
            lengthMeters: body.length_meters,
            widthMeters: body.width_meters,
            ceilingHeightMeters: body.ceiling_height_meters,
            hasNaturalLight: body.has_natural_light,
            hasAudioVisual: body.has_audio_visual,
            hasVideoConferencing: body.has_video_conferencing,
            hasWifi: body.has_wifi,
            hasStage: body.has_stage,
            hasDanceFloor: body.has_dance_floor,
            wheelchairAccessible: body.wheelchair_accessible,
            defaultSetup: body.default_setup,
            setupTimeMinutes: body.setup_time_minutes,
            teardownTimeMinutes: body.teardown_time_minutes,
            turnoverTimeMinutes: body.turnover_time_minutes,
            hourlyRate: body.hourly_rate,
            halfDayRate: body.half_day_rate,
            fullDayRate: body.full_day_rate,
            minimumRentalHours: body.minimum_rental_hours,
            currencyCode: body.currency_code,
            operatingHoursStart: body.operating_hours_start,
            operatingHoursEnd: body.operating_hours_end,
            cateringRequired: body.catering_required,
            inHouseCateringAvailable: body.in_house_catering_available,
            externalCateringAllowed: body.external_catering_allowed,
            primaryPhotoUrl: body.primary_photo_url,
            floorPlanUrl: body.floor_plan_url,
            virtualTourUrl: body.virtual_tour_url,
            isActive: body.is_active,
            requiresApproval: body.requires_approval,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        if (error instanceof MeetingRoomCodeConflictError) {
          return reply.conflict(error.message);
        }
        throw error;
      }

      if (!updated) {
        return reply.notFound("Meeting room not found");
      }

      return reply.send({ data: updated, message: "Meeting room updated" });
    },
  );

  app.delete<{
    Params: z.infer<typeof MeetingRoomParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/meeting-rooms/:roomId",
    {
      preHandler: roomDeleteScopeFromQuery,
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "Retire a meeting room",
        description:
          "Soft delete. Event bookings and banquet orders reference the room with ON DELETE RESTRICT, so history is preserved and the room simply stops being bookable.",
        params: MeetingRoomIdParamJsonSchema,
        querystring: schemaFromZod(roomTenantQuerySchema, "MeetingRoomDeleteQuery"),
      }),
    },
    async (request, reply) => {
      const { roomId } = MeetingRoomParamsSchema.parse(request.params);
      const { tenant_id } = roomTenantQuerySchema.parse(request.query);
      const removed = await deleteMeetingRoom(
        tenant_id,
        roomId,
        (request as { userId?: string }).userId,
      );

      if (!removed) {
        return reply.notFound("Meeting room not found");
      }

      return reply.send({ message: "Meeting room retired" });
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
  // The detail schema, not the list item: the by-id query selects the contact,
  // billing and linkage fields the detail screen needs, and a narrower response
  // schema would have fast-json-stringify strip them back off on the way out.
  const EventBookingDetailResponseJsonSchema = schemaFromZod(
    EventBookingDetailSchema,
    "EventBookingDetailResponse",
  );
  // The write handlers reply with `{ data, message }`, not a bare item. Declaring
  // the bare item here made fast-json-stringify reject every successful write with
  // `"event_id" is required!` — a 500 after the row had already been inserted.
  const EventBookingWriteResponseJsonSchema = schemaFromZod(
    EventBookingWriteResponseSchema,
    "EventBookingWriteResponse",
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
        return reply.notFound("Event booking not found");
      }
      return EventBookingDetailSchema.parse(event);
    },
  );

  // -------------------------------------------------
  // EVENT BOOKING WRITES — slice 2 of ui-gaps/13-sales-catering.md
  // Plain HTTP per COV-18: one table, one service, no fan-out.
  // -------------------------------------------------

  const eventWriteScopeFromBody = app.withTenantScope({
    resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "STAFF",
    requiredModules: "core",
  });

  /**
   * Maps the service's write errors onto HTTP. Shared by all three routes.
   *
   * Typed structurally rather than against `FastifyReply` so each route can pass
   * its own generic-parameterised reply without a variance fight.
   */
  const replyForEventWriteError = <
    TReply extends {
      notFound: (message: string) => unknown;
      conflict: (message: string) => unknown;
    },
  >(
    error: unknown,
    reply: TReply,
  ): unknown => {
    if (error instanceof MeetingRoomNotFoundError) {
      return reply.notFound(error.message);
    }
    if (error instanceof MeetingRoomUnavailableError) {
      return reply.conflict(error.message);
    }
    if (error instanceof EventBookingTransitionError) {
      return reply.conflict(error.message);
    }
    throw error;
  };

  app.post<{ Body: EventBookingWriteBody }>(
    "/v1/event-bookings",
    {
      preHandler: eventWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "Create an event booking",
        description:
          "Books function space. The meeting room must be free for the requested window including setup and teardown; an overlap returns 409.",
        body: schemaFromZod(EventBookingWriteBodySchema, "EventBookingWriteBody"),
        response: {
          201: EventBookingWriteResponseJsonSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = EventBookingWriteBodySchema.parse(request.body);
      let created: Awaited<ReturnType<typeof createEventBooking>>;

      try {
        created = await createEventBooking(
          body.tenant_id,
          {
            propertyId: body.property_id,
            eventNumber: body.event_number,
            eventName: body.event_name,
            eventType: body.event_type,
            meetingRoomId: body.meeting_room_id,
            eventDate: body.event_date,
            startTime: body.start_time,
            endTime: body.end_time,
            setupStartTime: body.setup_start_time,
            teardownEndTime: body.teardown_end_time,
            organizerName: body.organizer_name,
            organizerCompany: body.organizer_company,
            organizerEmail: body.organizer_email,
            organizerPhone: body.organizer_phone,
            contactPerson: body.contact_person,
            contactEmail: body.contact_email,
            contactPhone: body.contact_phone,
            guestId: body.guest_id,
            reservationId: body.reservation_id,
            companyId: body.company_id,
            groupBookingId: body.group_booking_id,
            expectedAttendees: body.expected_attendees,
            confirmedAttendees: body.confirmed_attendees,
            guaranteeNumber: body.guarantee_number,
            setupType: body.setup_type,
            setupDetails: body.setup_details,
            specialRequests: body.special_requests,
            cateringRequired: body.catering_required,
            audioVisualNeeded: body.audio_visual_needed,
            bookingStatus: body.booking_status,
            beoDueDate: body.beo_due_date,
            finalCountDueDate: body.final_count_due_date,
            rentalRate: body.rental_rate,
            setupFee: body.setup_fee,
            equipmentRentalFee: body.equipment_rental_fee,
            avEquipmentFee: body.av_equipment_fee,
            laborCharges: body.labor_charges,
            estimatedFoodBeverage: body.estimated_food_beverage,
            serviceChargePercent: body.service_charge_percent,
            taxRate: body.tax_rate,
            discountAmount: body.discount_amount,
            taxExempt: body.tax_exempt,
            estimatedTotal: body.estimated_total,
            depositRequired: body.deposit_required,
            currencyCode: body.currency_code,
            folioId: body.folio_id,
            billingInstructions: body.billing_instructions,
            billingContactName: body.billing_contact_name,
            billingContactEmail: body.billing_contact_email,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        return replyForEventWriteError(error, reply);
      }

      if (!created) {
        return reply.internalServerError("Failed to create event booking");
      }

      return reply.status(201).send({ data: created, message: "Event booking created" });
    },
  );

  app.put<{ Params: z.infer<typeof EventBookingParamsSchema>; Body: EventBookingUpdateBody }>(
    "/v1/event-bookings/:eventId",
    {
      preHandler: eventWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "Update an event booking",
        description:
          "Edits an event booking. Moving the room, date or times re-checks availability and returns 409 on an overlap. Use the status route for lifecycle changes.",
        params: EventBookingIdParamJsonSchema,
        body: schemaFromZod(EventBookingUpdateBodySchema, "EventBookingUpdateBody"),
        response: {
          200: EventBookingWriteResponseJsonSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { eventId } = EventBookingParamsSchema.parse(request.params);
      const body = EventBookingUpdateBodySchema.parse(request.body);
      let updated: Awaited<ReturnType<typeof updateEventBooking>>;

      try {
        updated = await updateEventBooking(
          body.tenant_id,
          eventId,
          {
            eventNumber: body.event_number,
            eventName: body.event_name,
            eventType: body.event_type,
            meetingRoomId: body.meeting_room_id,
            eventDate: body.event_date,
            startTime: body.start_time,
            endTime: body.end_time,
            setupStartTime: body.setup_start_time,
            teardownEndTime: body.teardown_end_time,
            organizerName: body.organizer_name,
            organizerCompany: body.organizer_company,
            organizerEmail: body.organizer_email,
            organizerPhone: body.organizer_phone,
            contactPerson: body.contact_person,
            contactEmail: body.contact_email,
            contactPhone: body.contact_phone,
            guestId: body.guest_id,
            reservationId: body.reservation_id,
            companyId: body.company_id,
            groupBookingId: body.group_booking_id,
            expectedAttendees: body.expected_attendees,
            confirmedAttendees: body.confirmed_attendees,
            guaranteeNumber: body.guarantee_number,
            setupType: body.setup_type,
            setupDetails: body.setup_details,
            specialRequests: body.special_requests,
            cateringRequired: body.catering_required,
            audioVisualNeeded: body.audio_visual_needed,
            beoDueDate: body.beo_due_date,
            finalCountDueDate: body.final_count_due_date,
            rentalRate: body.rental_rate,
            setupFee: body.setup_fee,
            equipmentRentalFee: body.equipment_rental_fee,
            avEquipmentFee: body.av_equipment_fee,
            laborCharges: body.labor_charges,
            estimatedFoodBeverage: body.estimated_food_beverage,
            serviceChargePercent: body.service_charge_percent,
            taxRate: body.tax_rate,
            discountAmount: body.discount_amount,
            taxExempt: body.tax_exempt,
            estimatedTotal: body.estimated_total,
            depositRequired: body.deposit_required,
            currencyCode: body.currency_code,
            folioId: body.folio_id,
            billingInstructions: body.billing_instructions,
            billingContactName: body.billing_contact_name,
            billingContactEmail: body.billing_contact_email,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        return replyForEventWriteError(error, reply);
      }

      if (!updated) {
        return reply.notFound("Event booking not found");
      }

      return reply.send({ data: updated, message: "Event booking updated" });
    },
  );

  app.post<{
    Params: z.infer<typeof EventBookingParamsSchema>;
    Body: EventBookingStatusChangeBody;
  }>(
    "/v1/event-bookings/:eventId/status",
    {
      preHandler: eventWriteScopeFromBody,
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "Change event booking status",
        description:
          "Lifecycle transition: inquiry → tentative → definite → confirmed, and cancellation. An illegal move returns 409.",
        params: EventBookingIdParamJsonSchema,
        body: schemaFromZod(EventBookingStatusChangeBodySchema, "EventBookingStatusChangeBody"),
        response: {
          200: EventBookingWriteResponseJsonSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { eventId } = EventBookingParamsSchema.parse(request.params);
      const body = EventBookingStatusChangeBodySchema.parse(request.body);
      let changed: Awaited<ReturnType<typeof changeEventBookingStatus>>;

      try {
        changed = await changeEventBookingStatus(
          body.tenant_id,
          eventId,
          body.booking_status,
          body.cancellation_reason,
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        return replyForEventWriteError(error, reply);
      }

      if (!changed) {
        return reply.notFound("Event booking not found");
      }

      return reply.send({ data: changed, message: "Event booking status updated" });
    },
  );
};
