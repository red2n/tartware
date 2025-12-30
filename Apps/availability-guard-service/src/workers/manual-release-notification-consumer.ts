import type { FastifyBaseLogger } from "fastify";
import type { Consumer, KafkaMessage } from "kafkajs";
import { z } from "zod";

import { config } from "../config.js";
import { kafka } from "../lib/kafka.js";
import {
  buildNotificationSummary,
  classifyRecipients,
  dedupeRecipients,
  type ManualReleaseNotification,
  type RecipientBuckets,
} from "../lib/manual-release-notification-helpers.js";
import {
  observeNotificationDeliveryLag,
  recordNotificationChannelDelivery,
  recordNotificationMessage,
} from "../lib/metrics.js";

type ManualReleaseNotificationChannel = "email" | "sms" | "slack";

const ManualReleaseNotificationSchema = z.object({
  type: z.literal("availability_guard.manual_release"),
  sentAt: z.string(),
  lockId: z.string().min(1),
  tenantId: z.string().min(1),
  reservationId: z.string().min(1).nullable().optional(),
  roomTypeId: z.string().min(1),
  roomId: z.string().min(1).nullable().optional(),
  stayStart: z.string(),
  stayEnd: z.string(),
  reason: z.string().min(1),
  actor: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().nullable().optional(),
  }),
  recipients: z.array(z.string().min(1)),
});

let consumer: Consumer | null = null;
let runLoop: Promise<void> | null = null;

export const startManualReleaseNotificationConsumer = async (
  logger: FastifyBaseLogger,
): Promise<void> => {
  const consumerConfig =
    config.guard.manualRelease.notifications.consumer ?? null;
  const topic = config.guard.manualRelease.notifications.topic;
  const workerLogger = logger.child({
    module: "manual-release-notification-consumer",
  });

  if (!consumerConfig?.enabled) {
    workerLogger.info("Manual release notification consumer disabled");
    return;
  }

  if (consumer) {
    workerLogger.warn("Manual release notification consumer already running");
    return;
  }

  consumer = kafka.consumer({
    groupId: consumerConfig.groupId,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  runLoop = consumer.run({
    eachMessage: async ({ topic: eventTopic, partition, message }) => {
      const messageLogger = workerLogger.child({
        topic: eventTopic,
        partition,
        offset: message.offset,
      });

      const payload = parseNotificationMessage(message, messageLogger);
      if (!payload) {
        recordNotificationMessage("skipped");
        return;
      }

      try {
        await processNotification(payload, message, messageLogger);
        recordNotificationMessage("processed");
      } catch (error) {
        recordNotificationMessage("failed");
        messageLogger.error(
          { err: error, lockId: payload.lockId },
          "Manual release notification processing failed",
        );
        throw error;
      }
    },
  });

  runLoop.catch((error: unknown) => {
    workerLogger.error(
      { err: error },
      "Manual release notification consumer crashed",
    );
  });

  workerLogger.info({ topic }, "Manual release notification consumer started");
};

export const shutdownManualReleaseNotificationConsumer = async (
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (!consumer) {
    return;
  }

  const workerLogger = logger.child({
    module: "manual-release-notification-consumer",
  });

  try {
    await consumer.stop();
    await runLoop?.catch(() => undefined);
    await consumer.disconnect();
    workerLogger.info("Manual release notification consumer stopped");
  } catch (error) {
    workerLogger.error(
      { err: error },
      "Failed to shutdown manual release notification consumer",
    );
  } finally {
    consumer = null;
    runLoop = null;
  }
};

const parseNotificationMessage = (
  message: KafkaMessage,
  logger: FastifyBaseLogger,
): ManualReleaseNotification | null => {
  if (!message.value) {
    logger.warn("Manual release notification missing payload");
    return null;
  }

  try {
    const parsedPayload: unknown = JSON.parse(message.value.toString("utf-8"));
    const normalized = ManualReleaseNotificationSchema.parse(parsedPayload);
    return {
      ...normalized,
      reservationId: normalized.reservationId ?? null,
      roomId: normalized.roomId ?? null,
      actor: {
        ...normalized.actor,
        email: normalized.actor.email ?? null,
      },
    };
  } catch (error) {
    logger.error(
      { err: error, payload: message.value.toString("utf-8") },
      "Invalid manual release notification payload",
    );
    return null;
  }
};

const processNotification = async (
  payload: ManualReleaseNotification,
  message: KafkaMessage,
  logger: FastifyBaseLogger,
): Promise<void> => {
  const recipients = dedupeRecipients([
    ...payload.recipients,
    ...config.guard.manualRelease.notifications.recipients,
  ]);
  if (recipients.length === 0) {
    logger.warn(
      { lockId: payload.lockId },
      "Manual release notification skipped; empty recipient list",
    );
    return;
  }

  const lagSeconds = calculateDeliveryLagSeconds(payload, message);
  observeNotificationDeliveryLag(lagSeconds);

  const buckets = classifyRecipients(recipients);
  const consumerConfig = config.guard.manualRelease.notifications.consumer;

  if (!consumerConfig) {
    logger.error(
      { lockId: payload.lockId },
      "Notification consumer configuration missing; skipping delivery",
    );
    return;
  }

  const attempts = buildChannelAttempts(
    payload,
    buckets,
    consumerConfig.channels,
    logger,
    consumerConfig.dryRun ?? false,
  );

  if (attempts.length === 0) {
    logger.warn(
      { lockId: payload.lockId },
      "No notification channels configured for manual release recipients",
    );
    return;
  }

  const results = await Promise.allSettled(
    attempts.map((attempt) => attempt.run()),
  );

  let successfulDeliveries = 0;
  let failedDeliveries = 0;

  for (const [index, result] of results.entries()) {
    const attempt = attempts[index];
    if (!attempt) {
      logger.warn(
        { index },
        "Manual release notification attempt metadata missing",
      );
      continue;
    }
    if (result.status === "fulfilled") {
      recordNotificationChannelDelivery(attempt.channel, "delivered");
      successfulDeliveries += 1;
    } else {
      recordNotificationChannelDelivery(attempt.channel, "failed");
      failedDeliveries += 1;
      logger.error(
        {
          err: result.reason as Error,
          lockId: payload.lockId,
          channel: attempt.channel,
        },
        "Manual release notification channel delivery failed",
      );
    }
  }

  if (successfulDeliveries === 0 && failedDeliveries > 0) {
    throw new Error(
      "Manual release notification delivery failed for all channels",
    );
  }
};

type ChannelConfig = {
  enabled: boolean;
  webhookUrl: string;
  apiKey?: string;
  timeoutMs: number;
};

type ChannelConfigMap = {
  email: ChannelConfig;
  sms: ChannelConfig;
  slack: ChannelConfig;
};

type DeliveryAttempt = {
  channel: ManualReleaseNotificationChannel;
  run: () => Promise<void>;
};

type NotificationDispatchPayload = Record<string, unknown> & {
  recipients?: string[];
};

const buildChannelAttempts = (
  payload: ManualReleaseNotification,
  buckets: RecipientBuckets,
  channelConfig: ChannelConfigMap,
  logger: FastifyBaseLogger,
  dryRun: boolean,
): DeliveryAttempt[] => {
  const attempts: DeliveryAttempt[] = [];
  const summary = buildNotificationSummary(payload);

  if (shouldAttemptChannel(buckets.email, channelConfig.email)) {
    attempts.push({
      channel: "email",
      run: () =>
        dispatchViaWebhook(
          "email",
          channelConfig.email,
          {
            template: "availability_guard_manual_release",
            subject: summary.subject,
            textBody: summary.plainText,
            htmlBody: summary.htmlBody,
            recipients: buckets.email,
            metadata: summary.metadata,
          },
          logger,
          dryRun,
        ),
    });
  }

  if (shouldAttemptChannel(buckets.sms, channelConfig.sms)) {
    attempts.push({
      channel: "sms",
      run: () =>
        dispatchViaWebhook(
          "sms",
          channelConfig.sms,
          {
            template: "availability_guard_manual_release",
            message: summary.smsText,
            recipients: buckets.sms,
            metadata: summary.metadata,
          },
          logger,
          dryRun,
        ),
    });
  }

  if (shouldAttemptChannel(buckets.slack, channelConfig.slack)) {
    attempts.push({
      channel: "slack",
      run: () =>
        dispatchViaWebhook(
          "slack",
          channelConfig.slack,
          {
            template: "availability_guard_manual_release",
            message: summary.slackText,
            recipients: buckets.slack,
            metadata: summary.metadata,
          },
          logger,
          dryRun,
        ),
    });
  }

  return attempts;
};

const shouldAttemptChannel = (
  recipients: string[],
  channel: ChannelConfig,
): boolean => {
  return (
    channel.enabled && Boolean(channel.webhookUrl) && recipients.length > 0
  );
};

const dispatchViaWebhook = async (
  channel: ManualReleaseNotificationChannel,
  channelConfig: ChannelConfig,
  payload: NotificationDispatchPayload,
  logger: FastifyBaseLogger,
  dryRun: boolean,
): Promise<void> => {
  const retries = config.guard.manualRelease.notifications.consumer?.maxRetries;
  const retryBackoffMs =
    config.guard.manualRelease.notifications.consumer?.retryBackoffMs ?? 2000;

  const totalAttempts = Math.max(retries ?? 3, 0) + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      if (dryRun) {
        logger.info(
          { channel, recipients: payload.recipients ?? [] },
          "Manual release notification dry-run dispatch",
        );
        return;
      }
      await sendWebhookRequest(channelConfig, payload);
      return;
    } catch (error) {
      const retriesLeft = totalAttempts - attempt;
      logger.warn(
        {
          err: error,
          channel,
          attempt,
          retries: Math.max(retriesLeft, 0),
        },
        "Manual release notification webhook attempt failed",
      );
      if (attempt === totalAttempts) {
        throw error;
      }
      await sleep(retryBackoffMs * attempt);
    }
  }
};

const sendWebhookRequest = async (
  channelConfig: ChannelConfig,
  payload: Record<string, unknown>,
): Promise<void> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), channelConfig.timeoutMs);

  try {
    const response = await fetch(channelConfig.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(channelConfig.apiKey
          ? { Authorization: `Bearer ${channelConfig.apiKey}` }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Notification webhook responded with ${response.status} ${response.statusText} ${body}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const calculateDeliveryLagSeconds = (
  payload: ManualReleaseNotification,
  message: KafkaMessage,
): number | null => {
  const sentAt = Date.parse(payload.sentAt);
  if (Number.isFinite(sentAt)) {
    return (Date.now() - sentAt) / 1000;
  }

  if (message.timestamp) {
    const kafkaTimestamp = Number(message.timestamp);
    if (Number.isFinite(kafkaTimestamp)) {
      return (Date.now() - kafkaTimestamp) / 1000;
    }
  }

  return null;
};
