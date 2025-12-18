import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type ActivityItem,
  type DashboardStats,
  type DashboardStatsQuery,
  DashboardStatsQuerySchema,
  DashboardStatsSchema,
  RecentActivitySchema,
  type TaskItem,
  UpcomingTasksSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { query } from "../lib/db.js";

const CURRENT_DAY_SQL = "CURRENT_DATE";
const PREVIOUS_DAY_SQL = "(CURRENT_DATE - INTERVAL '1 day')::date";

const buildOccupiedRoomsQuery = (withPropertyFilter: boolean, dayExpression: string): string =>
  withPropertyFilter
    ? `SELECT COUNT(DISTINCT room_number) as occupied_rooms
         FROM reservations
         WHERE tenant_id = $1
         AND property_id = $2
         AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND check_in_date <= ${dayExpression}
         AND check_out_date >= ${dayExpression}
         AND room_number IS NOT NULL
         AND is_deleted = false`
    : `SELECT COUNT(DISTINCT room_number) as occupied_rooms
         FROM reservations
         WHERE tenant_id = $1
         AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND check_in_date <= ${dayExpression}
         AND check_out_date >= ${dayExpression}
         AND room_number IS NOT NULL
         AND is_deleted = false`;

const buildRevenueQuery = (withPropertyFilter: boolean, dayExpression: string): string =>
  withPropertyFilter
    ? `SELECT COALESCE(SUM(amount), 0) as revenue_total
         FROM payments
         WHERE tenant_id = $1
         AND property_id = $2
         AND DATE(processed_at) = ${dayExpression}
         AND status = 'COMPLETED'
         AND is_deleted = false`
    : `SELECT COALESCE(SUM(amount), 0) as revenue_total
         FROM payments
         WHERE tenant_id = $1
         AND DATE(processed_at) = ${dayExpression}
         AND status = 'COMPLETED'
         AND is_deleted = false`;

const resolveTrend = (change: number): "up" | "down" | "neutral" => {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "neutral";
};

const DASHBOARD_TAG = "Dashboard";
const DashboardStatsQueryJsonSchema = schemaFromZod(
  DashboardStatsQuerySchema,
  "DashboardStatsQuery",
);
const DashboardStatsResponseJsonSchema = schemaFromZod(DashboardStatsSchema, "DashboardStats");
const RecentActivityResponseJsonSchema = schemaFromZod(RecentActivitySchema, "DashboardActivity");
const UpcomingTasksResponseJsonSchema = schemaFromZod(UpcomingTasksSchema, "DashboardTasks");

export const registerDashboardRoutes = (app: FastifyInstance): void => {
  // Dashboard stats endpoint
  app.get<{ Querystring: DashboardStatsQuery; Reply: DashboardStats }>(
    "/v1/dashboard/stats",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DashboardStatsQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DASHBOARD_TAG,
        summary: "Return aggregated dashboard KPIs",
        querystring: DashboardStatsQueryJsonSchema,
        response: {
          200: DashboardStatsResponseJsonSchema,
        },
      }),
    },
    async (request): Promise<DashboardStats> => {
      const { tenant_id, property_id } = DashboardStatsQuerySchema.parse(request.query);

      // Treat "all" as undefined (no property filter)
      const effectivePropertyId = property_id === "all" ? undefined : property_id;

      // Get total rooms for occupancy calculation
      const roomsQuery = effectivePropertyId
        ? `SELECT COUNT(*) as total_rooms FROM rooms WHERE tenant_id = $1 AND property_id = $2 AND is_deleted = false`
        : `SELECT COUNT(*) as total_rooms FROM rooms WHERE tenant_id = $1 AND is_deleted = false`;
      const roomsParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const roomsResult = await query<{ total_rooms: string }>(roomsQuery, roomsParams);
      const totalRooms = parseInt(roomsResult.rows[0]?.total_rooms || "0", 10);

      // Get occupied rooms count (reservations with check-in today or before, check-out today or after)
      const occupiedQuery = buildOccupiedRoomsQuery(Boolean(effectivePropertyId), CURRENT_DAY_SQL);
      const occupiedParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const occupiedResult = await query<{ occupied_rooms: string }>(occupiedQuery, occupiedParams);
      const occupiedRooms = parseInt(occupiedResult.rows[0]?.occupied_rooms || "0", 10);
      const occupiedPrevQuery = buildOccupiedRoomsQuery(
        Boolean(effectivePropertyId),
        PREVIOUS_DAY_SQL,
      );
      const occupiedPrevResult = await query<{ occupied_rooms: string }>(
        occupiedPrevQuery,
        occupiedParams,
      );
      const occupiedRoomsPrevious = parseInt(occupiedPrevResult.rows[0]?.occupied_rooms || "0", 10);

      // Calculate occupancy rate
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
      const occupancyRatePrevious =
        totalRooms > 0 ? Math.round((occupiedRoomsPrevious / totalRooms) * 100) : 0;
      const occupancyChange = Number((occupancyRate - occupancyRatePrevious).toFixed(2));
      const occupancyTrend = resolveTrend(occupancyChange);

      // Get today's revenue from payments
      const revenueQuery = buildRevenueQuery(Boolean(effectivePropertyId), CURRENT_DAY_SQL);
      const revenueParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const revenueResult = await query<{ revenue_total: string }>(revenueQuery, revenueParams);
      const revenueToday = parseFloat(revenueResult.rows[0]?.revenue_total || "0");
      const revenueYesterdayQuery = buildRevenueQuery(
        Boolean(effectivePropertyId),
        PREVIOUS_DAY_SQL,
      );
      const revenueYesterdayResult = await query<{ revenue_total: string }>(
        revenueYesterdayQuery,
        revenueParams,
      );
      const revenueYesterday = parseFloat(revenueYesterdayResult.rows[0]?.revenue_total || "0");
      const revenueChangeRaw =
        revenueYesterday > 0
          ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
          : revenueToday > 0
            ? 100
            : 0;
      const revenueChange = Number(revenueChangeRaw.toFixed(2));
      const revenueTrend = resolveTrend(revenueChange);

      // Get check-ins today
      const checkInsQuery = effectivePropertyId
        ? `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'CONFIRMED') as pending
           FROM reservations
           WHERE tenant_id = $1
           AND property_id = $2
           AND check_in_date = CURRENT_DATE
           AND is_deleted = false`
        : `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'CONFIRMED') as pending
           FROM reservations
           WHERE tenant_id = $1
           AND check_in_date = CURRENT_DATE
           AND is_deleted = false`;
      const checkInsParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const checkInsResult = await query<{ total: string; pending: string }>(
        checkInsQuery,
        checkInsParams,
      );
      const checkInsTotal = parseInt(checkInsResult.rows[0]?.total || "0", 10);
      const checkInsPending = parseInt(checkInsResult.rows[0]?.pending || "0", 10);
      const checkInsCompleted = Math.max(0, checkInsTotal - checkInsPending);

      // Get check-outs today
      const checkOutsQuery = effectivePropertyId
        ? `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'CHECKED_IN') as pending
           FROM reservations
           WHERE tenant_id = $1
           AND property_id = $2
           AND check_out_date = CURRENT_DATE
           AND is_deleted = false`
        : `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'CHECKED_IN') as pending
           FROM reservations
           WHERE tenant_id = $1
           AND check_out_date = CURRENT_DATE
           AND is_deleted = false`;
      const checkOutsParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const checkOutsResult = await query<{ total: string; pending: string }>(
        checkOutsQuery,
        checkOutsParams,
      );
      const checkOutsTotal = parseInt(checkOutsResult.rows[0]?.total || "0", 10);
      const checkOutsPending = parseInt(checkOutsResult.rows[0]?.pending || "0", 10);
      const checkOutsCompleted = Math.max(0, checkOutsTotal - checkOutsPending);

      return {
        occupancy: { rate: occupancyRate, change: occupancyChange, trend: occupancyTrend },
        revenue: {
          today: revenueToday,
          change: revenueChange,
          trend: revenueTrend,
          currency: "USD",
        },
        checkIns: { total: checkInsTotal, pending: checkInsPending, completed: checkInsCompleted },
        checkOuts: {
          total: checkOutsTotal,
          pending: checkOutsPending,
          completed: checkOutsCompleted,
        },
      };
    },
  );

  // Recent activity endpoint
  app.get<{ Querystring: DashboardStatsQuery; Reply: ActivityItem[] }>(
    "/v1/dashboard/activity",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DashboardStatsQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DASHBOARD_TAG,
        summary: "Recent reservations / activity feed",
        querystring: DashboardStatsQueryJsonSchema,
        response: {
          200: RecentActivityResponseJsonSchema,
        },
      }),
    },
    async (request): Promise<ActivityItem[]> => {
      const { tenant_id, property_id } = DashboardStatsQuerySchema.parse(request.query);

      // Treat "all" as undefined (no property filter)
      const effectivePropertyId = property_id === "all" ? undefined : property_id;

      // Get recent reservations, check-ins, and check-outs
      const activityQuery = effectivePropertyId
        ? `SELECT
             r.id::text as id,
             'reservation' as type,
             'New reservation created' as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || g.first_name || ' ' || g.last_name as description,
             r.created_at as timestamp,
             'event' as icon
           FROM reservations r
           JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND r.property_id = $2
           AND r.is_deleted = false
           ORDER BY r.created_at DESC
           LIMIT 5`
        : `SELECT
             r.id::text as id,
             'reservation' as type,
             'New reservation created' as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || g.first_name || ' ' || g.last_name as description,
             r.created_at as timestamp,
             'event' as icon
           FROM reservations r
           JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND r.is_deleted = false
           ORDER BY r.created_at DESC
           LIMIT 5`;
      const activityParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const activityResult = await query(activityQuery, activityParams);

      return activityResult.rows as ActivityItem[];
    },
  );

  // Upcoming tasks endpoint
  app.get<{ Querystring: DashboardStatsQuery; Reply: TaskItem[] }>(
    "/v1/dashboard/tasks",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DashboardStatsQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DASHBOARD_TAG,
        summary: "Upcoming stay-related tasks",
        querystring: DashboardStatsQueryJsonSchema,
        response: {
          200: UpcomingTasksResponseJsonSchema,
        },
      }),
    },
    async (request): Promise<TaskItem[]> => {
      const { tenant_id, property_id } = DashboardStatsQuerySchema.parse(request.query);

      // Treat "all" as undefined (no property filter)
      const effectivePropertyId = property_id === "all" ? undefined : property_id;

      // Get upcoming check-ins and check-outs for today and tomorrow
      const tasksQuery = effectivePropertyId
        ? `SELECT
             r.id::text as id,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN 'Check-in at ' || TO_CHAR(r.check_in_date, 'HH:MI AM')
               WHEN r.check_out_date = CURRENT_DATE THEN 'Check-out at ' || TO_CHAR(r.check_out_date, 'HH:MI AM')
               ELSE 'Upcoming reservation'
             END as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || g.first_name || ' ' || g.last_name as description,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN r.check_in_date
               ELSE r.check_out_date
             END as due_time,
             CASE
               WHEN g.vip_status = true THEN 'urgent'
               WHEN r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE THEN 'high'
               ELSE 'medium'
             END as priority,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN 'login'
               WHEN r.check_out_date = CURRENT_DATE THEN 'logout'
               ELSE 'event'
             END as icon
           FROM reservations r
           JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND r.property_id = $2
           AND (r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE OR r.check_in_date = CURRENT_DATE + 1)
           AND r.status IN ('CONFIRMED', 'CHECKED_IN')
           AND r.is_deleted = false
           ORDER BY due_time ASC
           LIMIT 10`
        : `SELECT
             r.id::text as id,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN 'Check-in at ' || TO_CHAR(r.check_in_date, 'HH:MI AM')
               WHEN r.check_out_date = CURRENT_DATE THEN 'Check-out at ' || TO_CHAR(r.check_out_date, 'HH:MI AM')
               ELSE 'Upcoming reservation'
             END as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || g.first_name || ' ' || g.last_name as description,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN r.check_in_date
               ELSE r.check_out_date
             END as due_time,
             CASE
               WHEN g.vip_status = true THEN 'urgent'
               WHEN r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE THEN 'high'
               ELSE 'medium'
             END as priority,
             CASE
               WHEN r.check_in_date = CURRENT_DATE THEN 'login'
               WHEN r.check_out_date = CURRENT_DATE THEN 'logout'
               ELSE 'event'
             END as icon
           FROM reservations r
           JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND (r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE OR r.check_in_date = CURRENT_DATE + 1)
           AND r.status IN ('CONFIRMED', 'CHECKED_IN')
           AND r.is_deleted = false
           ORDER BY due_time ASC
           LIMIT 10`;
      const tasksParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const tasksResult = await query(tasksQuery, tasksParams);

      return tasksResult.rows as TaskItem[];
    },
  );
};
