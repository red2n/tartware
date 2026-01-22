/**
 * DEV DOC
 * Module: schemas/07-analytics/dashboard-stats.ts
 * Description: Dashboard Statistics Schema - Real-time dashboard metrics
 * Table: n/a
 * Category: 07-analytics
 * Primary exports: DashboardStatsSchema, DashboardStatsQuerySchema, OccupancyStatsSchema, RevenueStatsSchema, CheckInStatsSchema, CheckOutStatsSchema, ActivityItemSchema
 * @table n/a
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * Dashboard Statistics Schema - Real-time dashboard metrics
 * @category 07-analytics
 * @synchronized 2025-11-09
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Occupancy statistics
 */
export const OccupancyStatsSchema = z.object({
	rate: z.number().min(0).max(100).describe("Occupancy rate as percentage"),
	change: z.number().describe("Percentage change from previous period"),
	trend: z.enum(["up", "down", "neutral"]).describe("Trend indicator"),
});

export type OccupancyStats = z.infer<typeof OccupancyStatsSchema>;

/**
 * Revenue statistics
 */
export const RevenueStatsSchema = z.object({
	today: z.number().nonnegative().describe("Today's revenue"),
	change: z.number().describe("Percentage change from yesterday"),
	trend: z.enum(["up", "down", "neutral"]).describe("Trend indicator"),
	currency: z.string().length(3).default("USD").describe("Currency code"),
});

export type RevenueStats = z.infer<typeof RevenueStatsSchema>;

/**
 * Check-in statistics
 */
export const CheckInStatsSchema = z.object({
	total: z.number().int().nonnegative().describe("Total check-ins today"),
	pending: z.number().int().nonnegative().describe("Pending check-ins"),
	completed: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Completed check-ins"),
});

export type CheckInStats = z.infer<typeof CheckInStatsSchema>;

/**
 * Check-out statistics
 */
export const CheckOutStatsSchema = z.object({
	total: z.number().int().nonnegative().describe("Total check-outs today"),
	pending: z.number().int().nonnegative().describe("Pending check-outs"),
	completed: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Completed check-outs"),
});

export type CheckOutStats = z.infer<typeof CheckOutStatsSchema>;

/**
 * Complete dashboard statistics
 */
export const DashboardStatsSchema = z.object({
	occupancy: OccupancyStatsSchema,
	revenue: RevenueStatsSchema,
	checkIns: CheckInStatsSchema,
	checkOuts: CheckOutStatsSchema,
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

/**
 * Dashboard stats query parameters
 */
export const DashboardStatsQuerySchema = z.object({
	tenant_id: uuid.describe("Tenant ID"),
	property_id: z
		.string()
		.optional()
		.refine(
			(val: string | undefined) =>
				!val ||
				val === "all" ||
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					val,
				),
			{ message: "property_id must be a valid UUID or 'all'" },
		)
		.describe('Property ID or "all" for aggregated stats'),
});

export type DashboardStatsQuery = z.infer<typeof DashboardStatsQuerySchema>;

/**
 * Recent activity item
 */
export const ActivityItemSchema = z.object({
	id: z.string().describe("Activity ID"),
	type: z.string().describe("Activity type"),
	title: z.string().describe("Activity title"),
	description: z.string().describe("Activity description"),
	timestamp: z.coerce.date().describe("Activity timestamp"),
	icon: z.string().describe("Material icon name"),
	urgent: z.boolean().optional().describe("Urgent flag"),
});

export type ActivityItem = z.infer<typeof ActivityItemSchema>;

/**
 * Recent activity response
 */
export const RecentActivitySchema = z.array(ActivityItemSchema);

export type RecentActivity = z.infer<typeof RecentActivitySchema>;

/**
 * Task item
 */
export const TaskItemSchema = z.object({
	id: z.string().describe("Task ID"),
	title: z.string().describe("Task title"),
	description: z.string().describe("Task description"),
	due_time: z.coerce.date().describe("Due time"),
	priority: z
		.enum(["urgent", "high", "medium", "low"])
		.describe("Priority level"),
	icon: z.string().describe("Material icon name"),
	urgent: z.boolean().optional().describe("Urgent flag"),
});

export type TaskItem = z.infer<typeof TaskItemSchema>;

/**
 * Upcoming tasks response
 */
export const UpcomingTasksSchema = z.array(TaskItemSchema);

export type UpcomingTasks = z.infer<typeof UpcomingTasksSchema>;
