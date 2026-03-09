/**
 * Barrel re-export — all pricing domain services are now split into
 * focused, single-responsibility modules. Import from this file to
 * preserve backward compatibility, or import the specific module directly.
 */

export type {
  CompetitorRateListItem,
  CreateCompetitorRateInput,
} from "./competitor-rate-service.js";
// Competitor Rates
export { createCompetitorRate, listCompetitorRates } from "./competitor-rate-service.js";
export type { DemandCalendarListItem } from "./demand-calendar-service.js";
// Demand Calendar
export { listDemandCalendar, upsertDemandCalendarEntry } from "./demand-calendar-service.js";
export type { HurdleRateListItem } from "./hurdle-rate-service.js";
// Hurdle Rates
export { listHurdleRates, upsertHurdleRate } from "./hurdle-rate-service.js";
export type {
  CreatePricingRuleInput,
  PricingRuleListItem,
  UpdatePricingRuleInput,
} from "./pricing-rule-service.js";
// Pricing Rules
export {
  activatePricingRule,
  createPricingRule,
  deactivatePricingRule,
  deletePricingRule,
  getPricingRuleById,
  listPricingRules,
  updatePricingRule,
} from "./pricing-rule-service.js";
export type { RateRecommendationListItem } from "./recommendation-service.js";
// Rate Recommendations
export { listRateRecommendations } from "./recommendation-service.js";
export type { RateRestrictionListItem } from "./restriction-service.js";
// Rate Restrictions
export {
  listRateRestrictions,
  removeRateRestriction,
  upsertRateRestriction,
} from "./restriction-service.js";
