import { z } from "zod";

const ReservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

const ReservationSourceSchema = z.enum([
  "DIRECT",
  "WEBSITE",
  "PHONE",
  "WALKIN",
  "OTA",
  "CORPORATE",
  "GROUP",
]);

export const ReservationCreateCommandSchema = z.object({
  property_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  booking_date: z.coerce.date().optional(),
  status: ReservationStatusSchema.optional(),
  source: ReservationSourceSchema.optional(),
  total_amount: z.coerce.number().nonnegative(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
});

export type ReservationCreateCommand = z.infer<
  typeof ReservationCreateCommandSchema
>;

export const ReservationUpdateCommandSchema =
  ReservationCreateCommandSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided for update",
  );

export type ReservationUpdateCommand = z.infer<
  typeof ReservationUpdateCommandSchema
>;

export const ReservationCancelCommandSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelled_by: z.string().uuid().optional(),
  cancelled_at: z.coerce.date().optional(),
});

export type ReservationCancelCommand = z.infer<
  typeof ReservationCancelCommandSchema
>;
