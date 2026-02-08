import type { CancellationPolicy, ReservationCancellationInfo } from "../repositories/reservation-repository.js";
import { reservationsLogger } from "../logger.js";

/**
 * Result of cancellation fee calculation.
 */
export type CancellationFeeResult = {
  /** Calculated cancellation fee (0 if within free-cancel window or no policy). */
  fee: number;
  /** Whether the cancellation is within the penalty window. */
  withinPenaltyWindow: boolean;
  /** Policy type applied. */
  policyType: string;
  /** Hours remaining until check-in at time of calculation. */
  hoursUntilCheckIn: number;
  /** Policy deadline hours. */
  policyDeadlineHours: number;
};

/**
 * Calculates the cancellation fee based on the rate's cancellation_policy
 * and how close to check-in the cancellation occurs.
 *
 * Policy types:
 *  - flexible: free cancel within deadline; penalty is a flat fee
 *  - moderate: penalty = 1 night room_rate if inside deadline
 *  - strict: penalty = full total_amount if inside deadline
 *  - non_refundable: always full total_amount regardless of timing
 */
export const calculateCancellationFee = (
  reservation: ReservationCancellationInfo,
  cancelledAt: Date = new Date(),
): CancellationFeeResult => {
  const policy = reservation.cancellationPolicy;

  // No policy on the rate → no fee
  if (!policy) {
    reservationsLogger.info(
      { reservationId: reservation.reservationId },
      "No cancellation policy found on associated rate; fee = 0",
    );
    return {
      fee: 0,
      withinPenaltyWindow: false,
      policyType: "none",
      hoursUntilCheckIn: hoursUntil(cancelledAt, reservation.checkInDate),
      policyDeadlineHours: 0,
    };
  }

  const hoursRemaining = hoursUntil(cancelledAt, reservation.checkInDate);
  const deadlineHours = policy.hours ?? 24;
  const withinPenaltyWindow = hoursRemaining < deadlineHours;

  const fee = computeFeeByType(policy, reservation, withinPenaltyWindow);

  return {
    fee,
    withinPenaltyWindow,
    policyType: policy.type,
    hoursUntilCheckIn: hoursRemaining,
    policyDeadlineHours: deadlineHours,
  };
};

const hoursUntil = (from: Date, to: Date): number => {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60));
};

const computeFeeByType = (
  policy: CancellationPolicy,
  reservation: ReservationCancellationInfo,
  withinPenaltyWindow: boolean,
): number => {
  switch (policy.type.toLowerCase()) {
    case "non_refundable":
      // Always full amount
      return reservation.totalAmount;

    case "strict":
      // Inside deadline → full amount; outside → free
      return withinPenaltyWindow ? reservation.totalAmount : 0;

    case "moderate":
      // Inside deadline → 1-night room rate; outside → free
      return withinPenaltyWindow ? reservation.roomRate : 0;

    case "flexible":
    default:
      // Inside deadline → policy.penalty flat fee; outside → free
      return withinPenaltyWindow ? (policy.penalty ?? 0) : 0;
  }
};
