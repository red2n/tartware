import {
  type ActivityItem,
  type DashboardStats,
  type DashboardStatsQuery,
  DashboardStatsQuerySchema,
  type TaskItem,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";

export const registerDashboardRoutes = (app: FastifyInstance): void => {
  // Dashboard stats endpoint
  app.get<{ Querystring: DashboardStatsQuery; Reply: DashboardStats }>(
    "/v1/dashboard/stats",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DashboardStatsQuery).tenant_id,
        minRole: "STAFF",
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
      const occupiedQuery = effectivePropertyId
        ? `SELECT COUNT(DISTINCT room_number) as occupied_rooms
           FROM reservations
           WHERE tenant_id = $1
           AND property_id = $2
           AND status IN ('CONFIRMED', 'CHECKED_IN')
           AND check_in_date <= CURRENT_DATE
           AND check_out_date >= CURRENT_DATE
           AND room_number IS NOT NULL
           AND is_deleted = false`
        : `SELECT COUNT(DISTINCT room_number) as occupied_rooms
           FROM reservations
           WHERE tenant_id = $1
           AND status IN ('CONFIRMED', 'CHECKED_IN')
           AND check_in_date <= CURRENT_DATE
           AND check_out_date >= CURRENT_DATE
           AND room_number IS NOT NULL
           AND is_deleted = false`;
      const occupiedParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const occupiedResult = await query<{ occupied_rooms: string }>(occupiedQuery, occupiedParams);
      const occupiedRooms = parseInt(occupiedResult.rows[0]?.occupied_rooms || "0", 10);

      // Calculate occupancy rate
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      // Get today's revenue from payments
      const revenueQuery = effectivePropertyId
        ? `SELECT COALESCE(SUM(amount), 0) as revenue_today
           FROM payments
           WHERE tenant_id = $1
           AND property_id = $2
           AND DATE(processed_at) = CURRENT_DATE
           AND status = 'COMPLETED'
           AND is_deleted = false`
        : `SELECT COALESCE(SUM(amount), 0) as revenue_today
           FROM payments
           WHERE tenant_id = $1
           AND DATE(processed_at) = CURRENT_DATE
           AND status = 'COMPLETED'
           AND is_deleted = false`;
      const revenueParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const revenueResult = await query<{ revenue_today: string }>(revenueQuery, revenueParams);
      const revenueToday = parseFloat(revenueResult.rows[0]?.revenue_today || "0");

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

      return {
        occupancy: { rate: occupancyRate, change: 5, trend: "up" as const },
        revenue: { today: revenueToday, change: 12, trend: "up" as const, currency: "USD" },
        checkIns: { total: checkInsTotal, pending: checkInsPending },
        checkOuts: { total: checkOutsTotal, pending: checkOutsPending },
      };
    },
  );

  // Recent activity endpoint
  app.get<{ Querystring: DashboardStatsQuery; Reply: ActivityItem[] }>(
    "/v1/dashboard/activity",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DashboardStatsQuery).tenant_id,
        minRole: "STAFF",
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
        minRole: "STAFF",
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
