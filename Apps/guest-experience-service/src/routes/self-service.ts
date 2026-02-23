import type { FastifyInstance } from "fastify";
import { registerBookingRoutes } from "./booking.js";
import { registerCheckinRoutes } from "./checkin.js";
import { registerCheckoutRoutes } from "./checkout.js";
import { registerKeyRoutes } from "./keys.js";
import { registerRegistrationCardRoutes } from "./registration-card.js";
import { registerRewardRoutes } from "./rewards.js";

/**
 * Register all guest self-service routes under /v1/self-service/*.
 */
export const registerSelfServiceRoutes = (app: FastifyInstance): void => {
  registerCheckinRoutes(app);
  registerCheckoutRoutes(app);
  registerRegistrationCardRoutes(app);
  registerKeyRoutes(app);
  registerBookingRoutes(app);
  registerRewardRoutes(app);
};
