import { z } from "zod";
import type { FastifyInstance } from "fastify";

import {
  startMobileCheckin,
  completeMobileCheckin,
  lookupReservationByConfirmation,
  getCheckinById,
} from "../services/checkin-service.js";
import { generateRegistrationCard } from "../services/registration-card-service.js";

const SELF_SERVICE_TAG = "Self-Service Check-In";

const StartCheckinBody = z.object({
  confirmation_code: z.string().min(1).max(50),
  access_method: z
    .enum(["mobile_app", "web_browser", "kiosk", "sms_link", "email_link", "qr_code"])
    .default("mobile_app"),
  device_type: z.string().max(50).optional(),
  app_version: z.string().max(20).optional(),
});

const CompleteCheckinBody = z.object({
  identity_verification_method: z
    .enum([
      "government_id",
      "passport",
      "drivers_license",
      "face_recognition",
      "biometric",
      "existing_profile",
      "manual_verification",
      "not_required",
    ])
    .default("existing_profile"),
  id_document_verified: z.boolean().default(false),
  registration_card_signed: z.boolean().default(false),
  payment_method_verified: z.boolean().default(false),
  terms_accepted: z.boolean().default(false),
  room_id: z.string().uuid().optional(),
  digital_key_type: z
    .enum(["mobile_app_key", "nfc", "bluetooth", "qr_code", "pin_code", "physical_key_required"])
    .optional(),
  guest_signature_url: z.string().url().optional(),
});

const ReservationIdParams = z.object({
  reservationId: z.string().uuid(),
});

const CheckinIdParams = z.object({
  checkinId: z.string().uuid(),
});

/**
 * Register mobile check-in REST endpoints (S17).
 * Guest-facing — authenticates via confirmation code, not JWT.
 */
export const registerCheckinRoutes = (app: FastifyInstance): void => {
  /**
   * POST /v1/self-service/check-in/start
   * Start a mobile check-in using a confirmation code.
   */
  app.post(
    "/v1/self-service/check-in/start",
    {
      schema: {
        tags: [SELF_SERVICE_TAG],
        summary: "Start mobile check-in for a reservation",
        description:
          "Authenticates via confirmation code (not JWT). Creates a mobile check-in record.",
      },
    },
    async (request, reply) => {
      const body = StartCheckinBody.parse(request.body);

      // Authenticate via confirmation code
      const reservation = await lookupReservationByConfirmation(body.confirmation_code);
      if (!reservation) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "No reservation found with the provided confirmation code",
        });
      }

      const result = await startMobileCheckin({
        reservationId: reservation.id,
        tenantId: reservation.tenant_id,
        guestId: reservation.guest_id,
        accessMethod: body.access_method,
        deviceType: body.device_type,
        appVersion: body.app_version,
      });

      return reply.status(201).send(result);
    },
  );

  /**
   * POST /v1/self-service/check-in/:checkinId/complete
   * Complete a mobile check-in.
   */
  app.post(
    "/v1/self-service/check-in/:checkinId/complete",
    {
      schema: {
        tags: [SELF_SERVICE_TAG],
        summary: "Complete a mobile check-in",
        description:
          "Validates identity document, accepts terms, and transitions the check-in to completed.",
      },
    },
    async (request, reply) => {
      const params = CheckinIdParams.parse(request.params);
      const body = CompleteCheckinBody.parse(request.body);

      const result = await completeMobileCheckin({
        mobileCheckinId: params.checkinId,
        identityVerificationMethod: body.identity_verification_method,
        idDocumentVerified: body.id_document_verified,
        registrationCardSigned: body.registration_card_signed,
        paymentMethodVerified: body.payment_method_verified,
        termsAccepted: body.terms_accepted,
        roomId: body.room_id,
        digitalKeyType: body.digital_key_type,
        guestSignatureUrl: body.guest_signature_url,
      });

      // Generate registration card on completion
      if (result.status === "completed") {
        const checkin = await getCheckinById(result.mobileCheckinId);
        if (checkin) {
          try {
            await generateRegistrationCard({
              reservationId: checkin.reservation_id,
              tenantId: checkin.tenant_id,
              mobileCheckinId: checkin.mobile_checkin_id,
            });
          } catch (error) {
            request.log.warn(
              { err: error, mobileCheckinId: result.mobileCheckinId },
              "registration card generation failed — check-in still completed",
            );
          }
        }
      }

      return reply.status(200).send(result);
    },
  );

  /**
   * GET /v1/self-service/check-in/:checkinId
   * Get check-in status.
   */
  app.get(
    "/v1/self-service/check-in/:checkinId",
    {
      schema: {
        tags: [SELF_SERVICE_TAG],
        summary: "Get mobile check-in status",
      },
    },
    async (request, reply) => {
      const params = CheckinIdParams.parse(request.params);
      const checkin = await getCheckinById(params.checkinId);

      if (!checkin) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Check-in record not found",
        });
      }

      return reply.send(checkin);
    },
  );
};
