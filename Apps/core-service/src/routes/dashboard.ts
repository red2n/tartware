import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type ActivityQuery,
  ActivityQuerySchema,
  type DashboardStats,
  type DashboardStatsQuery,
  DashboardStatsQuerySchema,
  DashboardStatsSchema,
  type PaginatedActivity,
  PaginatedActivitySchema,
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

const buildSparklineQuery = (withPropertyFilter: boolean): string =>
  withPropertyFilter
    ? `SELECT w.week_start, COUNT(r.id)::int as cnt
       FROM generate_series(
         date_trunc('week', CURRENT_DATE - INTERVAL '11 weeks'),
         date_trunc('week', CURRENT_DATE),
         '1 week'
       ) AS w(week_start)
       LEFT JOIN reservations r
         ON r.tenant_id = $1
         AND r.property_id = $2
         AND COALESCE(r.is_deleted, false) = false
         AND date_trunc('week', r.created_at) = w.week_start
       GROUP BY w.week_start
       ORDER BY w.week_start`
    : `SELECT w.week_start, COUNT(r.id)::int as cnt
       FROM generate_series(
         date_trunc('week', CURRENT_DATE - INTERVAL '11 weeks'),
         date_trunc('week', CURRENT_DATE),
         '1 week'
       ) AS w(week_start)
       LEFT JOIN reservations r
         ON r.tenant_id = $1
         AND COALESCE(r.is_deleted, false) = false
         AND date_trunc('week', r.created_at) = w.week_start
       GROUP BY w.week_start
       ORDER BY w.week_start`;

const DASHBOARD_TAG = "Dashboard";
const DashboardStatsQueryJsonSchema = schemaFromZod(
  DashboardStatsQuerySchema,
  "DashboardStatsQuery",
);
const DashboardStatsResponseJsonSchema = schemaFromZod(DashboardStatsSchema, "DashboardStats");
const PaginatedActivityResponseJsonSchema = schemaFromZod(
  PaginatedActivitySchema,
  "DashboardActivity",
);
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

      // Get reservation sparkline (12 weekly buckets)
      const sparklineQuery = buildSparklineQuery(Boolean(effectivePropertyId));
      const sparklineParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const sparklineResult = await query<{ week_start: string; cnt: number }>(
        sparklineQuery,
        sparklineParams,
      );
      const reservationSparkline = sparklineResult.rows.map((r) => Number(r.cnt));

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
        reservation_sparkline: reservationSparkline,
      };
    },
  );

  // Recent activity endpoint (paginated)
  app.get<{ Querystring: ActivityQuery; Reply: PaginatedActivity }>(
    "/v1/dashboard/activity",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ActivityQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DASHBOARD_TAG,
        summary: "Recent reservations / activity feed",
        querystring: DashboardStatsQueryJsonSchema,
        response: {
          200: PaginatedActivityResponseJsonSchema,
        },
      }),
    },
    async (request): Promise<PaginatedActivity> => {
      const { tenant_id, property_id, limit, offset } = ActivityQuerySchema.parse(request.query);

      // null means "all properties" — single query handles both cases via IS NULL check
      const propertyFilter = property_id === "all" ? null : (property_id ?? null);

      const activityQuery = `
        WITH activity AS (
          -- 1. New reservations created
          SELECT
            r.id::text                                                              AS id,
            'reservation'                                                           AS type,
            'Reservation ' || r.confirmation_number || ' created'                  AS title,
            COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest')
              || ' · Room ' || COALESCE(r.room_number, 'TBD')
              || ' · ' || r.check_in_date::text || ' → ' || r.check_out_date::text AS description,
            r.created_at                                                            AS ts,
            'event_note'                                                            AS icon,
            false                                                                   AS urgent
          FROM reservations r
          LEFT JOIN guests g ON r.guest_id = g.id
          WHERE r.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.is_deleted = false
            AND r.created_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 2. Check-ins (status flipped to CHECKED_IN recently)
          SELECT
            r.id::text || '-ci',
            'checkin',
            'Guest checked in · Room ' || COALESCE(r.room_number, 'TBD'),
            COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest')
              || CASE WHEN g.vip_status IS NOT NULL AND g.vip_status <> 'NONE'
                      THEN ' · VIP ' || g.vip_status ELSE '' END,
            r.updated_at,
            'login',
            (g.vip_status IS NOT NULL AND g.vip_status <> 'NONE')
          FROM reservations r
          LEFT JOIN guests g ON r.guest_id = g.id
          WHERE r.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CHECKED_IN'
            AND r.is_deleted = false
            AND r.updated_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 3. Check-outs
          SELECT
            r.id::text || '-co',
            'checkout',
            'Guest checked out · Room ' || COALESCE(r.room_number, 'TBD'),
            COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest')
              || ' · Stay ' || r.check_in_date::text || ' → ' || r.check_out_date::text,
            r.updated_at,
            'logout',
            false
          FROM reservations r
          LEFT JOIN guests g ON r.guest_id = g.id
          WHERE r.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CHECKED_OUT'
            AND r.is_deleted = false
            AND r.updated_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 4. Cancellations
          SELECT
            r.id::text || '-can',
            'cancellation',
            'Reservation cancelled · ' || r.confirmation_number,
            COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest')
              || ' · Arrival ' || r.check_in_date::text,
            r.updated_at,
            'cancel',
            false
          FROM reservations r
          LEFT JOIN guests g ON r.guest_id = g.id
          WHERE r.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CANCELLED'
            AND r.is_deleted = false
            AND r.updated_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 5. No-shows
          SELECT
            r.id::text || '-ns',
            'noshow',
            'No-show · Room ' || COALESCE(r.room_number, 'TBD'),
            COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest')
              || ' · Was due ' || r.check_in_date::text,
            r.updated_at,
            'person_off',
            false
          FROM reservations r
          LEFT JOIN guests g ON r.guest_id = g.id
          WHERE r.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'NO_SHOW'
            AND r.is_deleted = false
            AND r.updated_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 6. Folios opened
          SELECT
            f.folio_id::text,
            'folio',
            'Folio #' || f.folio_number || ' opened',
            COALESCE(f.guest_name, 'Unknown Guest') || ' · ' || f.folio_type,
            f.created_at,
            'receipt_long',
            false
          FROM folios f
          WHERE f.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR f.property_id = $2::uuid)
            AND f.deleted_at IS NULL
            AND f.created_at > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 7. Folios settled
          SELECT
            f.folio_id::text || '-settled',
            'payment',
            'Folio #' || f.folio_number || ' settled',
            COALESCE(f.guest_name, 'Unknown Guest') || ' · Balance cleared',
            COALESCE(f.settled_at, f.updated_at),
            'payments',
            false
          FROM folios f
          WHERE f.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR f.property_id = $2::uuid)
            AND f.folio_status = 'SETTLED'
            AND f.deleted_at IS NULL
            AND COALESCE(f.settled_at, f.updated_at) > NOW() - INTERVAL '48 hours'

          UNION ALL

          -- 8. Rooms cleaned / inspected
          SELECT
            ht.id::text,
            'housekeeping',
            CASE ht.status
              WHEN 'CLEAN'     THEN 'Room ' || ht.room_number || ' cleaned'
              WHEN 'INSPECTED' THEN 'Room ' || ht.room_number || ' inspected & ready'
              ELSE                  'Room ' || ht.room_number || ' cleaning started'
            END,
            ht.task_type
              || CASE WHEN ht.is_guest_request THEN ' · Guest request' ELSE '' END
              || CASE WHEN ht.priority IN ('HIGH', 'URGENT') THEN ' · ' || ht.priority ELSE '' END,
            COALESCE(ht.completed_at, ht.updated_at, ht.created_at),
            CASE ht.status
              WHEN 'CLEAN'     THEN 'cleaning_services'
              WHEN 'INSPECTED' THEN 'verified'
              ELSE                  'mop'
            END,
            ht.is_guest_request
          FROM housekeeping_tasks ht
          WHERE ht.tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR ht.property_id = $2::uuid)
            AND ht.status IN ('CLEAN', 'INSPECTED', 'IN_PROGRESS')
            AND COALESCE(ht.completed_at, ht.updated_at, ht.created_at) > NOW() - INTERVAL '48 hours'
        )
        SELECT id, type, title, description, ts AS timestamp, icon, urgent
        FROM activity
        ORDER BY ts DESC
        LIMIT $3 OFFSET $4`;

      const countQuery = `
        WITH activity AS (
          SELECT r.id::text FROM reservations r
          WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.is_deleted = false AND r.created_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT r.id::text || '-ci' FROM reservations r
          WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CHECKED_IN' AND r.is_deleted = false AND r.updated_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT r.id::text || '-co' FROM reservations r
          WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CHECKED_OUT' AND r.is_deleted = false AND r.updated_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT r.id::text || '-can' FROM reservations r
          WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'CANCELLED' AND r.is_deleted = false AND r.updated_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT r.id::text || '-ns' FROM reservations r
          WHERE r.tenant_id = $1::uuid AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
            AND r.status = 'NO_SHOW' AND r.is_deleted = false AND r.updated_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT f.folio_id::text FROM folios f
          WHERE f.tenant_id = $1::uuid AND ($2::uuid IS NULL OR f.property_id = $2::uuid)
            AND f.deleted_at IS NULL AND f.created_at > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT f.folio_id::text || '-settled' FROM folios f
          WHERE f.tenant_id = $1::uuid AND ($2::uuid IS NULL OR f.property_id = $2::uuid)
            AND f.folio_status = 'SETTLED' AND f.deleted_at IS NULL
            AND COALESCE(f.settled_at, f.updated_at) > NOW() - INTERVAL '48 hours'
          UNION ALL
          SELECT ht.id::text FROM housekeeping_tasks ht
          WHERE ht.tenant_id = $1::uuid AND ($2::uuid IS NULL OR ht.property_id = $2::uuid)
            AND ht.status IN ('CLEAN', 'INSPECTED', 'IN_PROGRESS')
            AND COALESCE(ht.completed_at, ht.updated_at, ht.created_at) > NOW() - INTERVAL '48 hours'
        ) SELECT COUNT(*)::int AS total FROM activity`;

      const [activityResult, countResult] = await Promise.all([
        query(activityQuery, [tenant_id, propertyFilter, limit, offset]),
        query(countQuery, [tenant_id, propertyFilter]),
      ]);

      return {
        items: activityResult.rows as PaginatedActivity["items"],
        total: (countResult.rows[0]?.total ?? 0) as number,
      };
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

      // Get upcoming check-ins (CONFIRMED only) and check-outs (CHECKED_IN only)
      const tasksQuery = effectivePropertyId
        ? `SELECT
             r.id::text as id,
             CASE
               WHEN r.status = 'CONFIRMED' AND r.check_in_date = CURRENT_DATE THEN 'Check-in today'
               WHEN r.status = 'CONFIRMED' AND r.check_in_date = CURRENT_DATE + 1 THEN 'Check-in tomorrow'
               WHEN r.status = 'CHECKED_IN' AND r.check_out_date = CURRENT_DATE THEN 'Check-out today'
               ELSE 'Upcoming reservation'
             END as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest') as description,
             CASE
               WHEN r.status = 'CONFIRMED' THEN r.check_in_date
               ELSE r.check_out_date
             END as due_time,
             CASE
               WHEN g.vip_status != 'NONE' THEN 'urgent'
               WHEN r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE THEN 'high'
               ELSE 'medium'
             END as priority,
             CASE
               WHEN r.status = 'CONFIRMED' THEN 'login'
               WHEN r.status = 'CHECKED_IN' THEN 'logout'
               ELSE 'event'
             END as icon
           FROM reservations r
           LEFT JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND r.property_id = $2
           AND (
             (r.status = 'CONFIRMED' AND (r.check_in_date = CURRENT_DATE OR r.check_in_date = CURRENT_DATE + 1))
             OR (r.status = 'CHECKED_IN' AND r.check_out_date = CURRENT_DATE)
           )
           AND r.is_deleted = false
           ORDER BY due_time ASC
           LIMIT 10`
        : `SELECT
             r.id::text as id,
             CASE
               WHEN r.status = 'CONFIRMED' AND r.check_in_date = CURRENT_DATE THEN 'Check-in today'
               WHEN r.status = 'CONFIRMED' AND r.check_in_date = CURRENT_DATE + 1 THEN 'Check-in tomorrow'
               WHEN r.status = 'CHECKED_IN' AND r.check_out_date = CURRENT_DATE THEN 'Check-out today'
               ELSE 'Upcoming reservation'
             END as title,
             COALESCE(r.room_number, 'TBD') || ' • ' || COALESCE(g.first_name || ' ' || g.last_name, r.guest_name, 'Unknown Guest') as description,
             CASE
               WHEN r.status = 'CONFIRMED' THEN r.check_in_date
               ELSE r.check_out_date
             END as due_time,
             CASE
               WHEN g.vip_status != 'NONE' THEN 'urgent'
               WHEN r.check_in_date = CURRENT_DATE OR r.check_out_date = CURRENT_DATE THEN 'high'
               ELSE 'medium'
             END as priority,
             CASE
               WHEN r.status = 'CONFIRMED' THEN 'login'
               WHEN r.status = 'CHECKED_IN' THEN 'logout'
               ELSE 'event'
             END as icon
           FROM reservations r
           LEFT JOIN guests g ON r.guest_id = g.id
           WHERE r.tenant_id = $1
           AND (
             (r.status = 'CONFIRMED' AND (r.check_in_date = CURRENT_DATE OR r.check_in_date = CURRENT_DATE + 1))
             OR (r.status = 'CHECKED_IN' AND r.check_out_date = CURRENT_DATE)
           )
           AND r.is_deleted = false
           ORDER BY due_time ASC
           LIMIT 10`;
      const tasksParams = effectivePropertyId ? [tenant_id, effectivePropertyId] : [tenant_id];
      const tasksResult = await query(tasksQuery, tasksParams);

      return tasksResult.rows as TaskItem[];
    },
  );
};
