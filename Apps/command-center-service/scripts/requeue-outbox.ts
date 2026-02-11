#!/usr/bin/env tsx
/**
 * Requeue command center transactional outbox rows.
 *
 * Usage:
 *   pnpm run requeue:outbox -- --status=DLQ --limit=25 --tenant-id=<uuid> --command-name=billing.payment.capture
 */

import { config } from "../src/config.js";
import { query } from "../src/lib/db.js";

type RequeueStatus = "FAILED" | "DLQ";

type CliOptions = {
  status: RequeueStatus;
  limit: number;
  eventId?: string;
  tenantId?: string;
  commandName?: string;
  actor: string;
};

const DEFAULT_OPTIONS: CliOptions = {
  status: "FAILED",
  limit: 50,
  actor: `${config.service.name}-cli`,
};

const parseArgs = (): CliOptions => {
  const options: CliOptions = { ...DEFAULT_OPTIONS };
  for (const rawArg of process.argv.slice(2)) {
    const [flag, value] = rawArg.includes("=")
      ? (rawArg.split("=", 2) as [string, string])
      : ([rawArg, ""] as const);
    switch (flag) {
      case "--status":
        if (value.toUpperCase() === "DLQ" || value.toUpperCase() === "FAILED") {
          options.status = value.toUpperCase() as RequeueStatus;
        }
        break;
      case "--limit":
        options.limit = Number.parseInt(value, 10) || DEFAULT_OPTIONS.limit;
        break;
      case "--event-id":
        options.eventId = value;
        break;
      case "--tenant-id":
        options.tenantId = value;
        break;
      case "--command-name":
        options.commandName = value;
        break;
      case "--actor":
        options.actor = value;
        break;
      default:
        break;
    }
  }
  return options;
};

const requeueOutboxRows = async (options: CliOptions) => {
  const filters: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  filters.push(`status = ANY($${paramIndex++}::outbox_status[])`);
  params.push([options.status]);

  if (options.eventId) {
    filters.push(`event_id = $${paramIndex++}`);
    params.push(options.eventId);
  }
  if (options.tenantId) {
    filters.push(`tenant_id = $${paramIndex++}`);
    params.push(options.tenantId);
  }
  if (options.commandName) {
    filters.push(`event_type = $${paramIndex++}`);
    params.push(`command.${options.commandName}`);
  }

  const actorParam = paramIndex++;
  params.push(options.actor);

  const limitParam = paramIndex++;
  params.push(options.limit);

  const sql = `
    WITH candidates AS (
      SELECT id
      FROM transactional_outbox
      WHERE ${filters.join(" AND ")}
      ORDER BY updated_at ASC
      LIMIT $${limitParam}
    )
    UPDATE transactional_outbox o
    SET
      status = 'PENDING',
      available_at = NOW(),
      locked_at = NULL,
      locked_by = NULL,
      retry_count = 0,
      updated_at = NOW(),
      metadata = COALESCE(o.metadata, '{}'::jsonb) || jsonb_build_object(
        'lifecycleState',
        'PERSISTED',
        'requeuedAt',
        NOW(),
        'requeuedBy',
        $${actorParam}
      )
    FROM candidates
    WHERE o.id = candidates.id
    RETURNING o.id, o.event_id, o.tenant_id, o.event_type;
  `;

  const result = await query(sql, params);
  return result.rows;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  if (!config.db.database) {
    throw new Error("Database configuration missing; cannot run requeue tool.");
  }
  console.log(
    `[requeue-outbox] status=${options.status} limit=${options.limit} actor=${options.actor}`,
  );
  const rows = await requeueOutboxRows(options);
  if (rows.length === 0) {
    console.log("No outbox rows matched the criteria.");
    return;
  }
  console.table(
    rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
    })),
  );
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to requeue outbox rows", error);
    process.exit(1);
  });
