/**
 * Types for the recommendation service.
 *
 * Defines the query and candidate types that flow through the pipeline.
 */

import type { HasRequestId, HasScore } from "@tartware/candidate-pipeline";

/**
 * Room recommendation query - input to the pipeline.
 */
export interface RoomRecommendationQuery extends HasRequestId {
  /** Unique request identifier for tracing */
  requestId: string;
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Property ID to search within */
  propertyId: string;
  /** Guest ID for personalization (optional for anonymous users) */
  guestId?: string;
  /** Check-in date */
  checkInDate: string;
  /** Check-out date */
  checkOutDate: string;
  /** Number of adults */
  adults: number;
  /** Number of children */
  children: number;
  /** Maximum number of results to return */
  limit: number;

  // --- Hydrated fields (populated by query hydrators) ---

  /** Guest's booking history (populated by GuestHistoryHydrator) */
  guestHistory?: GuestBookingHistory;
  /** Guest's preferences (populated by GuestPreferencesHydrator) */
  guestPreferences?: GuestPreferences;
  /** Guest's loyalty tier (populated by GuestFeaturesHydrator) */
  loyaltyTier?: string;
  /** Guest's budget range (populated by GuestFeaturesHydrator) */
  budgetRange?: { min: number; max: number };
}

/**
 * Guest booking history for personalization.
 */
export interface GuestBookingHistory {
  /** Total number of past bookings */
  totalBookings: number;
  /** Room types previously booked */
  previousRoomTypes: string[];
  /** Properties previously stayed at */
  previousProperties: string[];
  /** Average nightly rate paid */
  averageRate: number;
  /** Frequently requested amenities */
  preferredAmenities: string[];
}

/**
 * Guest preferences for filtering and scoring.
 */
export interface GuestPreferences {
  /** Preferred room types */
  preferredRoomTypes?: string[];
  /** Preferred floor (high/low/any) */
  floorPreference?: "high" | "low" | "any";
  /** Preferred view types */
  viewPreferences?: string[];
  /** Accessibility requirements */
  accessibilityNeeds?: string[];
  /** Do not disturb preferences */
  quietRoom?: boolean;
}

/**
 * Room candidate - items flowing through the pipeline.
 */
export interface RoomCandidate extends HasScore {
  /** Room ID */
  roomId: string;
  /** Room type ID */
  roomTypeId: string;
  /** Room type name */
  roomTypeName: string;
  /** Room number */
  roomNumber: string;
  /** Floor (string from DB, may be "10", "Lobby", etc.) */
  floor: number | string;
  /** View type */
  viewType?: string;
  /** Base rate per night */
  baseRate: number;
  /** Room status */
  status: string;
  /** Source that provided this candidate */
  source: string;

  // --- Hydrated fields ---

  /** Room amenities (populated by RoomDetailsHydrator) */
  amenities?: string[];
  /** Room description (populated by RoomDetailsHydrator) */
  description?: string;
  /** Room photos (populated by PhotoHydrator) */
  photos?: string[];
  /** Maximum occupancy (populated by RoomDetailsHydrator) */
  maxOccupancy?: number;
  /** Bed type (populated by RoomDetailsHydrator) */
  bedType?: string;
  /** Square footage (populated by RoomDetailsHydrator) */
  squareFootage?: number;
  /** Dynamic rate for the dates (populated by PricingHydrator) */
  dynamicRate?: number;
  /** Total price for the stay (populated by PricingHydrator) */
  totalPrice?: number;
  /** Whether this is an upgrade opportunity */
  isUpgrade?: boolean;
  /** Upgrade discount percentage */
  upgradeDiscount?: number;

  // --- Scoring fields ---

  /** Cumulative score (used for ranking) */
  score?: number;
  /** Individual scores from each scorer */
  scores?: Record<string, number>;
}

/**
 * Recommendation response returned by the API.
 */
export interface RoomRecommendationResponse {
  /** Request ID for tracing */
  requestId: string;
  /** Recommended rooms */
  recommendations: RoomRecommendation[];
  /** Total candidates considered */
  totalCandidates: number;
  /** Pipeline execution time in ms */
  executionTimeMs: number;
}

/**
 * A single room recommendation in the response.
 */
export interface RoomRecommendation {
  roomId: string;
  roomTypeId: string;
  roomTypeName: string;
  roomNumber: string;
  floor: number | string;
  viewType?: string;
  baseRate: number;
  dynamicRate?: number;
  totalPrice?: number;
  amenities?: string[];
  description?: string;
  photos?: string[];
  maxOccupancy?: number;
  bedType?: string;
  squareFootage?: number;
  isUpgrade?: boolean;
  upgradeDiscount?: number;
  /** Relevance score (0-1, higher is better) */
  relevanceScore: number;
  /** Source: "available" | "similar" | "upgrade" */
  source: string;
}
