import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import { createServiceLogger } from "@tartware/telemetry";
import type { Consumer } from "kafkajs";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import {
  handleCompetitiveResponseConfigure,
  handleCompetitorAutoCollect,
  handleCompetitorBulkImport,
  handleCompetitorConfigureCompset,
  handleCompetitorRecord,
} from "./handlers/competitor-handlers.js";
import { handleDailyCloseProcess } from "./handlers/daily-close-handler.js";
import { handleDemandImportEvents, handleDemandUpdate } from "./handlers/demand-handlers.js";
import {
  handleBookingPaceSnapshot,
  handleForecastAdjust,
  handleForecastCompute,
  handleForecastEvaluate,
  resolveActorId,
} from "./handlers/forecast-handlers.js";
import {
  handleGoalCreate,
  handleGoalDelete,
  handleGoalTrackActual,
  handleGoalUpdate,
} from "./handlers/goal-handlers.js";
import { handleGroupEvaluate } from "./handlers/group-handlers.js";
import { handleHurdleRateCalculate, handleHurdleRateSet } from "./handlers/hurdle-rate-handlers.js";
import {
  handlePricingRuleActivate,
  handlePricingRuleCreate,
  handlePricingRuleDeactivate,
  handlePricingRuleDelete,
  handlePricingRuleUpdate,
} from "./handlers/pricing-rule-handlers.js";
import {
  handleRecommendationApply,
  handleRecommendationApprove,
  handleRecommendationBulkApprove,
  handleRecommendationGenerate,
  handleRecommendationReject,
} from "./handlers/recommendation-handlers.js";
import {
  handleRestrictionBulkSet,
  handleRestrictionRemove,
  handleRestrictionSet,
} from "./handlers/restriction-handlers.js";

let consumer: Consumer | null = null;

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
}).child({ module: "revenue-command-consumer" });

export const startRevenueCommandCenterConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: config.commandCenter.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: config.commandCenter.maxBatchBytes,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.commandCenter.topic,
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: config.commandCenter.topic,
      groupId: config.commandCenter.consumerGroupId,
      targetService: config.commandCenter.targetServiceId,
    },
    "revenue command consumer started",
  );
};

export const shutdownRevenueCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("revenue command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const buildDlqPayload = (input: {
  envelope?: CommandEnvelope;
  rawValue: string;
  topic: string;
  partition: number;
  offset: string;
  attempts: number;
  failureReason: "PARSING_ERROR" | "HANDLER_FAILURE";
  error: unknown;
}) => {
  const error =
    input.error instanceof Error
      ? { name: input.error.name, message: input.error.message }
      : { name: "Error", message: String(input.error) };

  return {
    metadata: {
      failureReason: input.failureReason,
      attempts: input.attempts,
      topic: input.topic,
      partition: input.partition,
      offset: input.offset,
      commandId: input.envelope?.metadata?.commandId,
      commandName: input.envelope?.metadata?.commandName,
      tenantId: input.envelope?.metadata?.tenantId,
      requestId: input.envelope?.metadata?.requestId,
      targetService: input.envelope?.metadata?.targetService,
    },
    error,
    payload: input.envelope?.payload ?? null,
    raw: input.rawValue,
    emittedAt: new Date().toISOString(),
  };
};

const routeRevenueCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  const actorId = resolveActorId(metadata.initiatedBy);
  const payload = envelope.payload as Record<string, unknown>;

  switch (metadata.commandName) {
    case "revenue.forecast.compute": {
      await handleForecastCompute(payload, metadata, actorId);
      break;
    }

    case "revenue.pricing_rule.create": {
      const result = await handlePricingRuleCreate(payload, metadata, actorId);
      logger.info({ ruleId: result.ruleId, tenantId: metadata.tenantId }, "pricing rule created");
      break;
    }

    case "revenue.pricing_rule.update": {
      const result = await handlePricingRuleUpdate(payload, metadata, actorId);
      logger.info({ ruleId: result.ruleId, tenantId: metadata.tenantId }, "pricing rule updated");
      break;
    }

    case "revenue.pricing_rule.activate": {
      const result = await handlePricingRuleActivate(payload, metadata, actorId);
      logger.info({ ruleId: result.ruleId, tenantId: metadata.tenantId }, "pricing rule activated");
      break;
    }

    case "revenue.pricing_rule.deactivate": {
      const result = await handlePricingRuleDeactivate(payload, metadata, actorId);
      logger.info(
        { ruleId: result.ruleId, tenantId: metadata.tenantId },
        "pricing rule deactivated",
      );
      break;
    }

    case "revenue.pricing_rule.delete": {
      const result = await handlePricingRuleDelete(payload, metadata, actorId);
      logger.info({ ruleId: result.ruleId, tenantId: metadata.tenantId }, "pricing rule deleted");
      break;
    }

    case "revenue.demand.update": {
      const result = await handleDemandUpdate(payload, metadata, actorId);
      logger.info({ count: result.count, tenantId: metadata.tenantId }, "demand calendar updated");
      break;
    }

    case "revenue.demand.import_events": {
      const result = await handleDemandImportEvents(payload, metadata, actorId);
      logger.info(
        { events: result.events, upserted: result.upserted, tenantId: metadata.tenantId },
        "demand events imported",
      );
      break;
    }

    case "revenue.competitor.record": {
      const result = await handleCompetitorRecord(payload, metadata, actorId);
      logger.info(
        { competitorRateId: result.competitorRateId, tenantId: metadata.tenantId },
        "competitor rate recorded",
      );
      break;
    }

    case "revenue.competitor.bulk_import": {
      const result = await handleCompetitorBulkImport(payload, metadata, actorId);
      logger.info(
        { imported: result.imported, tenantId: metadata.tenantId },
        "competitor rates bulk imported",
      );
      break;
    }

    case "revenue.competitor.configure_compset": {
      const result = await handleCompetitorConfigureCompset(payload, metadata, actorId);
      logger.info(
        { upserted: result.upserted, tenantId: metadata.tenantId },
        "competitive set configured",
      );
      break;
    }

    case "revenue.competitor.auto_collect": {
      const result = await handleCompetitorAutoCollect(payload, metadata, actorId);
      logger.info(
        { collected: result.collected, tenantId: metadata.tenantId },
        "rate shopping auto-collect completed",
      );
      break;
    }

    case "revenue.competitive_response.configure": {
      const result = await handleCompetitiveResponseConfigure(payload, metadata, actorId);
      logger.info(
        { ruleId: result.ruleId, tenantId: metadata.tenantId },
        "competitive response rule configured",
      );
      break;
    }

    case "revenue.restriction.set": {
      const result = await handleRestrictionSet(payload, metadata, actorId);
      logger.info(
        {
          upserted: result.upserted,
          restrictionType: result.restrictionType,
          tenantId: metadata.tenantId,
        },
        "rate restrictions set",
      );
      break;
    }

    case "revenue.restriction.remove": {
      const result = await handleRestrictionRemove(payload, metadata, actorId);
      logger.info(
        {
          removed: result.removed,
          restrictionType: result.restrictionType,
          tenantId: metadata.tenantId,
        },
        "rate restrictions removed",
      );
      break;
    }

    case "revenue.restriction.bulk_set": {
      const result = await handleRestrictionBulkSet(payload, metadata, actorId);
      logger.info(
        {
          restrictions: result.restrictions,
          totalUpserted: result.totalUpserted,
          tenantId: metadata.tenantId,
        },
        "bulk rate restrictions set",
      );
      break;
    }

    case "revenue.hurdle_rate.set": {
      const result = await handleHurdleRateSet(payload, metadata, actorId);
      logger.info(
        { upserted: result.upserted, roomTypeId: result.roomTypeId, tenantId: metadata.tenantId },
        "hurdle rates set",
      );
      break;
    }

    case "revenue.hurdle_rate.calculate": {
      const result = await handleHurdleRateCalculate(payload, metadata, actorId);
      logger.info(
        {
          calculated: result.calculated,
          roomTypes: result.roomTypes,
          tenantId: metadata.tenantId,
        },
        "hurdle rates auto-calculated",
      );
      break;
    }

    case "revenue.goal.create": {
      const result = await handleGoalCreate(payload, metadata, actorId ?? metadata.tenantId);
      logger.info({ goalId: result.goalId, tenantId: metadata.tenantId }, "revenue goal created");
      break;
    }

    case "revenue.goal.update": {
      const result = await handleGoalUpdate(payload, metadata, actorId ?? metadata.tenantId);
      logger.info({ goalId: result.goalId, tenantId: metadata.tenantId }, "revenue goal updated");
      break;
    }

    case "revenue.goal.delete": {
      const result = await handleGoalDelete(payload, metadata, actorId ?? metadata.tenantId);
      logger.info({ goalId: result.goalId, tenantId: metadata.tenantId }, "revenue goal deleted");
      break;
    }

    case "revenue.goal.track_actual": {
      const result = await handleGoalTrackActual(payload, metadata, actorId ?? metadata.tenantId);
      logger.info(
        { updated: result.updated, tenantId: metadata.tenantId },
        "revenue goal actuals tracked",
      );
      break;
    }

    case "revenue.daily_close.process": {
      const result = await handleDailyCloseProcess(payload, metadata, actorId);
      logger.info(
        {
          goalsUpdated: result.goalsUpdated,
          forecastRun: result.forecastRun,
          tenantId: metadata.tenantId,
        },
        "daily close processing completed",
      );
      break;
    }

    case "revenue.booking_pace.snapshot": {
      const result = await handleBookingPaceSnapshot(payload, metadata, actorId);
      logger.info(
        { daysUpdated: result.daysUpdated, tenantId: metadata.tenantId },
        "booking pace snapshot completed",
      );
      break;
    }

    case "revenue.forecast.adjust": {
      const result = await handleForecastAdjust(payload, metadata, actorId);
      logger.info(
        { adjusted: result.adjusted, tenantId: metadata.tenantId },
        "forecast manually adjusted",
      );
      break;
    }

    case "revenue.forecast.evaluate": {
      const result = await handleForecastEvaluate(payload, metadata, actorId);
      logger.info(
        { evaluated: result.evaluated, tenantId: metadata.tenantId },
        "forecast accuracy evaluated",
      );
      break;
    }

    case "revenue.group.evaluate": {
      await handleGroupEvaluate(payload, metadata, actorId);
      logger.info(
        { groupId: (payload as Record<string, unknown>).group_id, tenantId: metadata.tenantId },
        "group displacement evaluated",
      );
      break;
    }

    case "revenue.recommendation.generate": {
      const result = await handleRecommendationGenerate(payload, metadata, actorId);
      logger.info(
        {
          generated: result.generated,
          autoApplied: result.autoApplied,
          tenantId: metadata.tenantId,
        },
        "rate recommendations generated",
      );
      break;
    }

    case "revenue.recommendation.approve": {
      const result = await handleRecommendationApprove(payload, metadata, actorId);
      logger.info(
        { recommendationId: result.recommendationId, tenantId: metadata.tenantId },
        "rate recommendation approved",
      );
      break;
    }

    case "revenue.recommendation.reject": {
      const result = await handleRecommendationReject(payload, metadata, actorId);
      logger.info(
        { recommendationId: result.recommendationId, tenantId: metadata.tenantId },
        "rate recommendation rejected",
      );
      break;
    }

    case "revenue.recommendation.apply": {
      const result = await handleRecommendationApply(payload, metadata, actorId);
      logger.info(
        {
          recommendationId: result.recommendationId,
          implementedRate: result.implementedRate,
          tenantId: metadata.tenantId,
        },
        "rate recommendation applied",
      );
      break;
    }

    case "revenue.recommendation.bulk_approve": {
      const result = await handleRecommendationBulkApprove(payload, metadata, actorId);
      logger.info(
        { approved: result.approved, tenantId: metadata.tenantId },
        "rate recommendations bulk approved",
      );
      break;
    }

    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no revenue handler registered for command",
      );
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.commandCenter.maxRetries,
    baseDelayMs: config.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.commandCenter.retryScheduleMs.length > 0
        ? config.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeRevenueCommand,
  commandLabel: "revenue",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});
