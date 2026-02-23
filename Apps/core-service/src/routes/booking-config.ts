// Barrel — delegates to domain route files
import type { FastifyInstance } from "fastify";

import { registerAllotmentRoutes } from "./booking-config/allotment.js";
import { registerCompanyRoutes } from "./booking-config/company.js";
import { registerDistributionRoutes } from "./booking-config/distribution.js";
import { registerEventRoutes } from "./booking-config/event.js";
import { registerGroupWaitlistPromoRoutes } from "./booking-config/group-waitlist-promo.js";
import { registerMetasearchRoutes } from "./booking-config/metasearch.js";

export const registerBookingConfigRoutes = (app: FastifyInstance): void => {
  registerAllotmentRoutes(app);
  registerDistributionRoutes(app);
  registerCompanyRoutes(app);
  registerEventRoutes(app);
  registerGroupWaitlistPromoRoutes(app);
  registerMetasearchRoutes(app);
};
