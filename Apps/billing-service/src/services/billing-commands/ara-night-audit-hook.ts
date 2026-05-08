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
 *
 * Looks up active dunning rules for the property before dispatching.
 * If no rules are configured, the dispatch is skipped.
 */
export const dispatchArDunningTrigger = async (
  tenantId: string,
  propertyId: string,
  businessDate: string,
): Promise<void> => {
  // Check if any active dunning rules exist for this property
  const { listDunningRules } = await import("../../repositories/ar-dunning-rule-repository.js");
  const rules = await listDunningRules(tenantId, propertyId);
  const activeRules = rules.filter((r) => r.is_active);

  if (activeRules.length === 0) {
    logger.info(
      { tenantId, propertyId },
      "No active dunning rules configured — skipping ar.dunning.trigger dispatch",
    );
    return;
  }

  const commandId = randomUUID();
  const idempotencyKey = `ar-dunning:${tenantId}:${propertyId}:${businessDate}`;

  const envelope = {
    id: commandId,
    command_name: "ar.dunning.trigger",
    payload: {
      property_id: propertyId,
      trigger_date: businessDate,
      active_rule_count: activeRules.length,
      buckets_with_rules: [...new Set(activeRules.map((r) => r.bucket_name))],
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
    { commandId, tenantId, propertyId, businessDate, activeRuleCount: activeRules.length },
    "Dispatched ar.dunning.trigger after night audit",
  );
};
