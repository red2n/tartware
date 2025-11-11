import { z } from "zod";

export const ReservationCreateCommandSchema = z.object({
  property_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  booking_date: z.coerce.date().optional(),
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "CANCELLED",
      "NO_SHOW",
    ])
    .optional(),
  source: z
    .enum(["DIRECT", "WEBSITE", "PHONE", "WALKIN", "OTA", "CORPORATE", "GROUP"])
    .optional(),
  total_amount: z.coerce.number().nonnegative(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
});

export type ReservationCreateCommand = z.infer<
  typeof ReservationCreateCommandSchema
>;
