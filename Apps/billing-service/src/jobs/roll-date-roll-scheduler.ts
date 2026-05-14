import { randomUUID } from "node:crypto";

import { createKafkaClient } from "@tartware/command-consumer-utils/producer";
import type { ActivePropertyRow, SchedulerStatus } from "@tartware/schemas";
import type { FastifyBaseLogger } from "fastify";
import type { Producer } from "kafkajs";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import type { BusinessCalendarSettingsService } from "../services/business-calendar-settings-service.js";

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

type DispatchResult = {
  propertyId: string;
  propertyName: string;
  dispatchedAt: string;
  success: boolean;
  error?: string;
};

// =====================================================
// SQL: fetch all active properties and their business dates
// =====================================================

const ACTIVE_PROPERTIES_SQL = `
SELECT
    p.id as property_id,
    p.tenant_id,
    p.property_name,
    p.timezone,
    bd.business_date as current_business_date,
    bd.date_status,
    bd.night_audit_status
FROM properties p
LEFT JOIN business_dates bd ON bd.property_id = p.id
    AND bd.tenant_id = p.tenant_id
    AND bd.date_status = 'OPEN'
    AND COALESCE(bd.is_deleted, false) = false
WHERE COALESCE(p.is_deleted, false) = false
  AND p.is_active = true
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
  settingsService: BusinessCalendarSettingsService,
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

  const kafka = createKafkaClient({
    clientId: `${config.roll.kafka.clientId}-scheduler`,
    brokers: config.roll.kafka.brokers,
    logger,
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

      if (!producer) {
        throw new Error("Kafka producer is not initialized — cannot dispatch night audit command");
      }

      await producer.send({
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

    const client = await pool.connect();
    let rows: ActivePropertyRow[];
    try {
      const result = await client.query<ActivePropertyRow>(ACTIVE_PROPERTIES_SQL, []);
      rows = result.rows;
    } finally {
      client.release();
    }

    const scheduled: PropertySchedule[] = [];
    const results: DispatchResult[] = [];

    for (const row of rows) {
      const tenantId = row.tenant_id;
      const propertyId = row.property_id;

      // Resolve settings from the service
      const settings = settingsService.getSettings(tenantId, propertyId);

      if (!settings.autoRollEnabled) continue;

      const prop: PropertySchedule & {
        timezone: string | null;
        night_audit_status: string | null;
      } = {
        tenantId,
        propertyId,
        propertyName: row.property_name,
        autoRollTime: settings.autoRollTime,
        currentBusinessDate: row.current_business_date,
        dateStatus: row.date_status,
        lastAuditDate: null,
        timezone: row.timezone,
        night_audit_status: row.night_audit_status,
      };

      scheduled.push({
        tenantId: prop.tenantId,
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        autoRollTime: prop.autoRollTime,
        lastAuditDate: null,
        currentBusinessDate: prop.currentBusinessDate,
        dateStatus: prop.dateStatus,
      });

      // Skip if date is not OPEN or audit is already running/completed
      if (prop.dateStatus !== "OPEN") continue;
      if (prop.night_audit_status === "IN_PROGRESS" || prop.night_audit_status === "COMPLETED")
        continue;

      // Check if it's time to trigger
      if (!shouldTrigger(prop.autoRollTime, prop.timezone)) continue;

      const result = await dispatchNightAudit(prop);
      results.push(result);
    }

    status.scheduledProperties = scheduled;
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
