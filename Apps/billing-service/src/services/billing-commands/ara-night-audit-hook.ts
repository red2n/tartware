/**
 * Night Audit → AR Aging Hook
 *
 * Dispatches `ar.aging.compute` to the command pipeline after a successful
 * night audit. The aging command runs asynchronously — it is NOT part of
 * the audit transaction. This ensures aging snapshots reflect end-of-day
 * balances without blocking the audit itself.
 *
 * Also dispatches `ar.dunning.trigger` for any accounts that cross bucket
 * thresholds (handled by the aging handler itself downstream).
 */
import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { publishEvent } from "../../kafka/producer.js";
import { appLogger } from "../../lib/logger.js";

const logger = appLogger.child({ module: "ara-night-audit-hook" });

/**
 * Dispatch ar.aging.compute to the commands.primary topic.
 * Called after night audit completes successfully.
 */
export const dispatchArAgingCompute = async (
  tenantId: string,
  propertyId: string,
  businessDate: string,
): Promise<void> => {
  const commandId = randomUUID();
  const idempotencyKey = `ar-aging:${tenantId}:${propertyId}:${businessDate}`;

  const envelope = {
    id: commandId,
    command_name: "ar.aging.compute",
    payload: {
      property_id: propertyId,
      snapshot_date: businessDate,
      idempotency_key: idempotencyKey,
    },
    metadata: {
      commandName: "ar.aging.compute",
      tenantId,
      initiatedBy: "system:night-audit",
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      targetService: "accounts-service",
      idempotencyKey,
    },
  };

  await publishEvent({
    key: tenantId,
    value: JSON.stringify(envelope),
    topic: config.arEvents.commandTopic,
    headers: {
      "x-command-name": "ar.aging.compute",
      "x-tenant-id": tenantId,
      "x-target-service": "accounts-service",
    },
  });

  logger.info(
    { commandId, tenantId, propertyId, businessDate },
    "Dispatched ar.aging.compute after night audit",
  );
};

/**
 * Dispatch ar.dunning.trigger to the commands.primary topic.
 * Called after night audit aging compute to evaluate dunning rules
 * for accounts crossing aging bucket thresholds.
 */
export const dispatchArDunningTrigger = async (
  tenantId: string,
  propertyId: string,
  businessDate: string,
): Promise<void> => {
  const commandId = randomUUID();
  const idempotencyKey = `ar-dunning:${tenantId}:${propertyId}:${businessDate}`;

  const envelope = {
    id: commandId,
    command_name: "ar.dunning.trigger",
    payload: {
      property_id: propertyId,
      trigger_date: businessDate,
      idempotency_key: idempotencyKey,
    },
    metadata: {
      commandName: "ar.dunning.trigger",
      tenantId,
      initiatedBy: "system:night-audit",
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      targetService: "accounts-service",
      idempotencyKey,
    },
  };

  await publishEvent({
    key: tenantId,
    value: JSON.stringify(envelope),
    topic: config.arEvents.commandTopic,
    headers: {
      "x-command-name": "ar.dunning.trigger",
      "x-tenant-id": tenantId,
      "x-target-service": "accounts-service",
    },
  });

  logger.info(
    { commandId, tenantId, propertyId, businessDate },
    "Dispatched ar.dunning.trigger after night audit",
  );
};
