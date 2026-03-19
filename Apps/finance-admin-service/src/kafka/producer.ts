import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";

import { kafka } from "./client.js";

const producer = kafka.producer();
let connected = false;

const ensureConnected = async () => {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
};

export const publishDlqEvent = async (
  message: { key?: string; value: string; headers?: Record<string, string> },
  topic?: string,
): Promise<void> => {
  await ensureConnected();
  await producer.send({
    topic: topic ?? config.commandCenter.dlqTopic,
    messages: [message],
  });
};

export const shutdownProducer = async (): Promise<void> => {
  if (connected) {
    try {
      await producer.disconnect();
      appLogger.info("finance-admin kafka producer disconnected");
    } finally {
      connected = false;
    }
  }
};
