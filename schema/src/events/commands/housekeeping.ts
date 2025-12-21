import { z } from "zod";

export const HousekeepingAssignCommandSchema = z.object({
	task_id: z.string().uuid(),
	assigned_to: z.string().uuid(),
	priority: z.string().max(20).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type HousekeepingAssignCommand = z.infer<
	typeof HousekeepingAssignCommandSchema
>;

export const HousekeepingCompleteCommandSchema = z.object({
	task_id: z.string().uuid(),
	completed_by: z.string().uuid().optional(),
	notes: z.string().max(2000).optional(),
	inspection: z
		.object({
			inspected_by: z.string().uuid().optional(),
			passed: z.boolean().optional(),
			notes: z.string().max(2000).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type HousekeepingCompleteCommand = z.infer<
	typeof HousekeepingCompleteCommandSchema
>;
