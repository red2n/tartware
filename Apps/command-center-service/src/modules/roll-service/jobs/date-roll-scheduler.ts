import { randomUUID } from "node:crypto";

import type { FastifyBaseLogger } from "fastify";
import { Kafka, type Producer } from "kafkajs";

import { config } from "../config.js";
import { query } from "../lib/db.js";

// =====================================================
// Types
// =====================================================

type PropertySchedule = {
  tenantId: string;
  propertyId: string;
  propertyName: string;
  autoRollTime: string;
  lastAuditDate: string | null;
  currentBusinessDate: string | null;
  dateStatus: string | null;
};

export type SchedulerStatus = {
  enabled: boolean;
  running: boolean;
  lastCheckAt: string | null;
  scheduledProperties: PropertySchedule[];
  lastDispatchResults: DispatchResult[];
};

type DispatchResult = {
  propertyId: string;
  propertyName: string;
  dispatchedAt: string;
  success: boolean;
  error?: string;
};

// =====================================================
// SQL: fetch properties with auto-roll enabled
// =====================================================

const ELIGIBLE_PROPERTIES_SQL = `
SELECT
    p.id as property_id,
    p.tenant_id,
    p.property_name,
    p.timezone,
    COALESCE(
      (SELECT sv.value->>'value'
       FROM settings_values sv
       JOIN settings_definitions sd ON sd.id = sv.setting_id
       WHERE sd.code = 'FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_TIME'
         AND sv.property_id = p.id
         AND sv.scope_level = 'PROPERTY'
         AND COALESCE(sv.status, 'active') = 'active'
       LIMIT 1),
      '03:00'
    ) as auto_roll_time,
    bd.business_date as current_business_date,
    bd.date_status,
    bd.night_audit_status
FROM properties p
JOIN settings_values sv_enabled ON sv_enabled.property_id = p.id
JOIN settings_definitions sd_enabled ON sd_enabled.id = sv_enabled.setting_id
    AND sd_enabled.code = 'FINANCE.BUSINESS_CALENDAR.AUTO_ROLL_ENABLED'
LEFT JOIN business_dates bd ON bd.property_id = p.id
    AND bd.tenant_id = p.tenant_id
    AND bd.date_status = 'OPEN'
    AND COALESCE(bd.is_deleted, false) = false
WHERE COALESCE(p.is_deleted, false) = false
  AND p.is_active = true
  AND sv_enabled.scope_level = 'PROPERTY'
  AND COALESCE(sv_enabled.status, 'active') = 'active'
  AND (sv_enabled.value->>'value')::boolean = true
ORDER BY p.id
`;

// =====================================================
// Scheduler Job
// =====================================================

type DateRollSchedulerOptions = {
  checkIntervalMs: number;
  commandTopic: string;
};

export const buildDateRollScheduler = (
  logger: FastifyBaseLogger,
  options: DateRollSchedulerOptions,
) => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let inFlight = false;
  let producer: Producer | null = null;

  const status: SchedulerStatus = {
    enabled: true,
    running: false,
    lastCheckAt: null,
    scheduledProperties: [],
    lastDispatchResults: [],
  };

  const kafka = new Kafka({
    clientId: `${config.kafka.clientId}-scheduler`,
    brokers: config.kafka.brokers,
  });

  const connectProducer = async () => {
    if (!producer) {
      producer = kafka.producer();
      await producer.connect();
    }
  };

  const disconnectProducer = async () => {
    if (producer) {
      await producer.disconnect();
      producer = null;
    }
  };

  const shouldTrigger = (autoRollTime: string, timezone: string | null): boolean => {
    const now = new Date();
    const tz = timezone ?? "UTC";

    let localTime: string;
    try {
      localTime = now.toLocaleTimeString("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      localTime = now.toLocaleTimeString("en-GB", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    const [nowH, nowM] = localTime.split(":").map(Number);
    const [rollH, rollM] = autoRollTime.split(":").map(Number);

    if (nowH === undefined || nowM === undefined || rollH === undefined || rollM === undefined) {
      return false;
    }

    const nowMinutes = nowH * 60 + nowM;
    const rollMinutes = rollH * 60 + rollM;

    // Trigger if we're within 2 minutes after the configured time
    return nowMinutes >= rollMinutes && nowMinutes < rollMinutes + 2;
  };

  const dispatchNightAudit = async (
    prop: PropertySchedule & { timezone: string | null },
  ): Promise<DispatchResult> => {
    const requestId = randomUUID();
    const timestamp = new Date().toISOString();

    try {
      await connectProducer();

      const message = {
        key: prop.propertyId,
        value: JSON.stringify({
          metadata: {
            requestId,
            commandName: "billing.night_audit.execute",
            tenantId: prop.tenantId,
            targetService: "billing-service",
            topic: options.commandTopic,
            timestamp,
            source: "date-roll-scheduler",
          },
          payload: {
            property_id: prop.propertyId,
            advance_date: true,
            post_room_charges: true,
            post_package_charges: true,
            lock_postings: true,
            generate_trial_balance: true,
            idempotency_key: `auto-roll-${prop.propertyId}-${prop.currentBusinessDate ?? "unknown"}`,
          },
        }),
        headers: {
          "x-request-id": requestId,
          "x-command-name": "billing.night_audit.execute",
          "x-tenant-id": prop.tenantId,
          "x-source": "date-roll-scheduler",
        },
      };

      await producer!.send({
        topic: options.commandTopic,
        messages: [message],
      });

      logger.info(
        {
          propertyId: prop.propertyId,
          propertyName: prop.propertyName,
          businessDate: prop.currentBusinessDate,
          requestId,
        },
        "Auto date roll: dispatched night audit command",
      );

      return {
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        dispatchedAt: timestamp,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { propertyId: prop.propertyId, error: errorMessage },
        "Auto date roll: failed to dispatch night audit command",
      );
      return {
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        dispatchedAt: timestamp,
        success: false,
        error: errorMessage,
      };
    }
  };

  const checkAndDispatch = async () => {
    status.lastCheckAt = new Date().toISOString();

    const { rows } = await query<
      PropertySchedule & { timezone: string | null; night_audit_status: string | null }
    >(ELIGIBLE_PROPERTIES_SQL, []);

    status.scheduledProperties = rows.map((r) => ({
      tenantId: r.tenantId ?? ((r as Record<string, unknown>).tenant_id as string),
      propertyId: r.propertyId ?? ((r as Record<string, unknown>).property_id as string),
      propertyName: r.propertyName ?? ((r as Record<string, unknown>).property_name as string),
      autoRollTime: r.autoRollTime ?? ((r as Record<string, unknown>).auto_roll_time as string),
      lastAuditDate: null,
      currentBusinessDate:
        r.currentBusinessDate ??
        ((r as Record<string, unknown>).current_business_date as string | null),
      dateStatus: r.dateStatus ?? ((r as Record<string, unknown>).date_status as string | null),
    }));

    const results: DispatchResult[] = [];

    for (const row of rows) {
      const prop = {
        tenantId: (row as Record<string, unknown>).tenant_id as string,
        propertyId: (row as Record<string, unknown>).property_id as string,
        propertyName: (row as Record<string, unknown>).property_name as string,
        autoRollTime: (row as Record<string, unknown>).auto_roll_time as string,
        currentBusinessDate: (row as Record<string, unknown>).current_business_date as
          | string
          | null,
        dateStatus: (row as Record<string, unknown>).date_status as string | null,
        lastAuditDate: null,
        timezone: (row as Record<string, unknown>).timezone as string | null,
        night_audit_status: (row as Record<string, unknown>).night_audit_status as string | null,
      };

      // Skip if date is not OPEN or audit is already running/completed
      if (prop.dateStatus !== "OPEN") continue;
      if (prop.night_audit_status === "IN_PROGRESS" || prop.night_audit_status === "COMPLETED")
        continue;

      // Check if it's time to trigger
      if (!shouldTrigger(prop.autoRollTime, prop.timezone)) continue;

      const result = await dispatchNightAudit(prop);
      results.push(result);
    }

    if (results.length > 0) {
      status.lastDispatchResults = results;
    }
  };

  const runOnce = async () => {
    if (inFlight) {
      logger.debug("Date roll scheduler check already in flight; skipping");
      return;
    }
    inFlight = true;
    try {
      await checkAndDispatch();
    } catch (error) {
      logger.error(error, "Date roll scheduler check failed");
    } finally {
      inFlight = false;
    }
  };

  return {
    start: async () => {
      if (running) return;
      running = true;
      status.running = true;

      timer = setInterval(() => {
        void runOnce();
      }, options.checkIntervalMs);
      timer.unref?.();

      logger.info(
        { checkIntervalMs: options.checkIntervalMs, commandTopic: options.commandTopic },
        "Date roll scheduler started",
      );
    },

    stop: async () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      running = false;
      status.running = false;
      await disconnectProducer();
    },

    getStatus: (): SchedulerStatus => ({ ...status }),
    runOnce,
  };
};
