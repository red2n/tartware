import { v4 as uuid } from "uuid";

import { query } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import type {
  MetasearchClickRecordCommand,
  MetasearchConfigCreateCommand,
  MetasearchConfigUpdateCommand,
} from "../../schemas/reservation-command.js";

import {
  type CreateReservationResult,
  ReservationCommandError,
  SYSTEM_ACTOR_ID,
} from "./common.js";

const logger = reservationsLogger.child({ module: "metasearch-commands" });

/**
 * Create a new metasearch platform configuration.
 */
export const createMetasearchConfig = async (
  tenantId: string,
  command: MetasearchConfigCreateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const configId = uuid();
  const eventId = uuid();

  const { rowCount } = await query(
    `INSERT INTO metasearch_configurations (
       config_id, tenant_id, property_id,
       platform, platform_account_id, is_active,
       bid_strategy,
       max_cpc, default_cpc, cpc_multipliers,
       target_cpa, cpa_commission_percent,
       budget_daily, budget_monthly, currency,
       rate_feed_url, rate_feed_format, rate_feed_frequency,
       target_roas, min_booking_value,
       metadata, created_by
     ) VALUES (
       $1, $2, $3,
       $4, $5, TRUE,
       $6,
       $7, $8, $9,
       $10, $11,
       $12, $13, COALESCE($14, 'USD'),
       $15, $16, $17,
       $18, $19,
       COALESCE($20, '{}'::jsonb), $21
     )
     ON CONFLICT (tenant_id, property_id, platform) WHERE is_active = TRUE
     DO NOTHING`,
    [
      configId,
      tenantId,
      command.property_id,
      command.platform,
      command.platform_account_id ?? null,
      command.bid_strategy,
      command.max_cpc ?? null,
      command.default_cpc ?? null,
      command.cpc_multipliers ? JSON.stringify(command.cpc_multipliers) : null,
      command.target_cpa ?? null,
      command.cpa_commission_percent ?? null,
      command.budget_daily ?? null,
      command.budget_monthly ?? null,
      command.currency ?? null,
      command.rate_feed_url ?? null,
      command.rate_feed_format ?? null,
      command.rate_feed_frequency ?? null,
      command.target_roas ?? null,
      command.min_booking_value ?? null,
      command.metadata ? JSON.stringify(command.metadata) : null,
      SYSTEM_ACTOR_ID,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new ReservationCommandError(
      "METASEARCH_CONFIG_DUPLICATE",
      `Active configuration already exists for platform "${command.platform}" on property ${command.property_id}`,
    );
  }

  logger.info(
    { tenantId, configId, platform: command.platform, correlationId: options.correlationId },
    "metasearch.config.create applied",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Update an existing metasearch configuration.
 */
export const updateMetasearchConfig = async (
  tenantId: string,
  command: MetasearchConfigUpdateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  // Build dynamic SET clause from non-null fields
  const updates: string[] = [];
  const values: unknown[] = [tenantId, command.config_id];
  let paramIdx = 3;

  const fields: [string, unknown][] = [
    ["is_active", command.is_active],
    ["bid_strategy", command.bid_strategy],
    ["max_cpc", command.max_cpc],
    ["default_cpc", command.default_cpc],
    [
      "cpc_multipliers",
      command.cpc_multipliers ? JSON.stringify(command.cpc_multipliers) : undefined,
    ],
    ["target_cpa", command.target_cpa],
    ["cpa_commission_percent", command.cpa_commission_percent],
    ["budget_daily", command.budget_daily],
    ["budget_monthly", command.budget_monthly],
    ["rate_feed_url", command.rate_feed_url],
    ["rate_feed_format", command.rate_feed_format],
    ["rate_feed_frequency", command.rate_feed_frequency],
    ["target_roas", command.target_roas],
    ["min_booking_value", command.min_booking_value],
    ["metadata", command.metadata ? JSON.stringify(command.metadata) : undefined],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      updates.push(`${col} = $${paramIdx}`);
      values.push(val);
      paramIdx++;
    }
  }

  if (updates.length === 0) {
    throw new ReservationCommandError("METASEARCH_NO_UPDATES", "No fields to update");
  }

  updates.push("updated_at = NOW()");

  const { rowCount } = await query(
    `UPDATE metasearch_configurations
     SET ${updates.join(", ")}
     WHERE tenant_id = $1 AND config_id = $2`,
    values,
  );

  if (!rowCount || rowCount === 0) {
    throw new ReservationCommandError(
      "METASEARCH_CONFIG_NOT_FOUND",
      `Configuration ${command.config_id} not found`,
    );
  }

  logger.info(
    { tenantId, configId: command.config_id, correlationId: options.correlationId },
    "metasearch.config.update applied",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Record a click event from a metasearch platform.
 */
export const recordMetasearchClick = async (
  tenantId: string,
  command: MetasearchClickRecordCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const clickId = uuid();
  const eventId = uuid();

  await query(
    `INSERT INTO metasearch_click_log (
       click_id, tenant_id, property_id, config_id, platform,
       cost, currency,
       search_type, device, market,
       check_in_date, check_out_date, occupancy,
       tracking_id, landing_page_url
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, COALESCE($7, 'USD'),
       $8, $9, $10,
       $11, $12, $13,
       $14, $15
     )`,
    [
      clickId,
      tenantId,
      command.property_id,
      command.config_id,
      command.platform,
      command.cost,
      command.currency ?? null,
      command.search_type ?? null,
      command.device ?? null,
      command.market ?? null,
      command.check_in_date?.toISOString() ?? null,
      command.check_out_date?.toISOString() ?? null,
      command.occupancy ?? null,
      command.tracking_id ?? null,
      command.landing_page_url ?? null,
    ],
  );

  logger.info(
    {
      tenantId,
      clickId,
      platform: command.platform,
      cost: command.cost,
      correlationId: options.correlationId,
    },
    "metasearch.click.record applied",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};
