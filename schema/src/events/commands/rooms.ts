import { z } from "zod";

export const RoomInventoryBlockCommandSchema = z.object({
	room_id: z.string().uuid(),
	action: z.enum(["block", "release"]).default("block"),
	reason: z.string().min(1).max(255).optional(),
	blocked_from: z.coerce.date().optional(),
	blocked_until: z.coerce.date().optional(),
	expected_ready_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type RoomInventoryBlockCommand = z.infer<
	typeof RoomInventoryBlockCommandSchema
>;
