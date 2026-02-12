import type { FastifyInstance } from "fastify";

import { registerCheckinRoutes } from "./checkin.js";
import { registerRegistrationCardRoutes } from "./registration-card.js";
import { registerKeyRoutes } from "./keys.js";
import { registerBookingRoutes } from "./booking.js";

/**
 * Register all guest self-service routes under /v1/self-service/*.
 */
export const registerSelfServiceRoutes = (app: FastifyInstance): void => {
  registerCheckinRoutes(app);
  registerRegistrationCardRoutes(app);
  registerKeyRoutes(app);
  registerBookingRoutes(app);
};
