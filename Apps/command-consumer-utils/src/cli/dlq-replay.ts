#!/usr/bin/env node
import { stdin as input, stdout as output } from "node:process";
/**
 * DLQ Replay CLI — interactive consumer for `commands.primary.dlq`.
 *
 * For each DLQ message, the operator can:
 *   - [i]nspect   → print full payload + headers
 *   - [r]epublish → produce to `commands.primary` with metadata.replayedFrom="dlq"
 *   - [d]rop      → commit offset without republishing
 *   - [q]uit      → stop and exit
 *
 * Usage:
 *   pnpm --filter @tartware/command-consumer-utils dlq:replay
 *
 * Env:
 *   KAFKA_BROKERS              — comma-separated (default: localhost:9092)
 *   DLQ_TOPIC                  — DLQ topic (default: commands.primary.dlq)
 *   COMMAND_TOPIC              — replay target (default: commands.primary)
 *   DLQ_REPLAY_GROUP           — consumer group (default: dlq-replay-cli)
 *   DLQ_REPLAY_FROM_BEGINNING  — "true" to start from earliest offset (default: true)
 */
import { createInterface } from "node:readline/promises";
import { type Consumer, Kafka, logLevel as KafkaLogLevel, type Producer } from "kafkajs";

type Action = "inspect" | "republish" | "drop" | "quit";

const env = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
};

const brokers = env("KAFKA_BROKERS", "localhost:9092")
  .split(",")
  .map((s) => s.trim());
const dlqTopic = env("DLQ_TOPIC", "commands.primary.dlq");
const commandTopic = env("COMMAND_TOPIC", "commands.primary");
const groupId = env("DLQ_REPLAY_GROUP", "dlq-replay-cli");
const fromBeginning = env("DLQ_REPLAY_FROM_BEGINNING", "true") === "true";

const kafka = new Kafka({
  clientId: "dlq-replay-cli",
  brokers,
  logLevel: KafkaLogLevel.ERROR,
});

const rl = createInterface({ input, output });

const promptAction = async (): Promise<Action> => {
  for (;;) {
    const answer = (await rl.question("Action — [i]nspect / [r]epublish / [d]rop / [q]uit: "))
      .trim()
      .toLowerCase();
    if (answer === "i" || answer === "inspect") return "inspect";
    if (answer === "r" || answer === "republish") return "republish";
    if (answer === "d" || answer === "drop") return "drop";
    if (answer === "q" || answer === "quit") return "quit";
    output.write("  Invalid choice.\n");
  }
};

const decodeHeaders = (
  headers: Record<string, Buffer | string | (Buffer | string)[] | undefined> | undefined,
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((x) => (Buffer.isBuffer(x) ? x.toString("utf8") : String(x))).join(",");
    } else if (Buffer.isBuffer(v)) {
      out[k] = v.toString("utf8");
    } else {
      out[k] = String(v);
    }
  }
  return out;
};

const summarize = (
  rawValue: string,
): { commandName?: string; commandId?: string; tenantId?: string; failureReason?: string } => {
  try {
    const parsed = JSON.parse(rawValue) as {
      metadata?: {
        commandName?: string;
        commandId?: string;
        tenantId?: string;
        failureReason?: string;
      };
    };
    return {
      commandName: parsed.metadata?.commandName,
      commandId: parsed.metadata?.commandId,
      tenantId: parsed.metadata?.tenantId,
      failureReason: parsed.metadata?.failureReason,
    };
  } catch {
    return {};
  }
};

const buildReplayEnvelope = (
  rawValue: string,
  originalOffset: string,
): { value: string; key: string } => {
  // DLQ payload shape (from buildDlqPayload): { metadata: {...}, error, payload, raw, emittedAt }
  // Original envelope payload is stored under `.payload`; original metadata under `.metadata`.
  let dlq: {
    metadata?: Record<string, unknown>;
    payload?: unknown;
    raw?: string;
  };
  try {
    dlq = JSON.parse(rawValue);
  } catch (err) {
    throw new Error(`Cannot parse DLQ message JSON: ${(err as Error).message}`);
  }

  // If payload is null, try to recover from `raw` field (original envelope as string).
  let envelope: { metadata?: Record<string, unknown>; payload?: unknown };
  if (dlq.payload !== undefined && dlq.payload !== null) {
    envelope = {
      metadata: {
        commandName: dlq.metadata?.commandName,
        commandId: dlq.metadata?.commandId,
        tenantId: dlq.metadata?.tenantId,
        targetService: dlq.metadata?.targetService,
        requestId: dlq.metadata?.requestId,
      },
      payload: dlq.payload,
    };
  } else if (dlq.raw) {
    try {
      envelope = JSON.parse(dlq.raw);
    } catch (err) {
      throw new Error(`Cannot parse original envelope from raw field: ${(err as Error).message}`);
    }
  } else {
    throw new Error("DLQ message has neither `payload` nor `raw` — cannot rebuild envelope.");
  }

  // Stamp replay metadata so downstream consumers / audit can trace.
  envelope.metadata = {
    ...(envelope.metadata ?? {}),
    replayedFrom: "dlq",
    replayedAt: new Date().toISOString(),
    replayedDlqOffset: originalOffset,
  };

  const key =
    typeof envelope.metadata.commandId === "string"
      ? envelope.metadata.commandId
      : typeof envelope.metadata.tenantId === "string"
        ? envelope.metadata.tenantId
        : "dlq-replay";

  return { value: JSON.stringify(envelope), key };
};

const main = async (): Promise<void> => {
  output.write(
    `\nDLQ Replay CLI\n` +
      `  Brokers:        ${brokers.join(",")}\n` +
      `  DLQ topic:      ${dlqTopic}\n` +
      `  Replay target:  ${commandTopic}\n` +
      `  Group:          ${groupId}\n` +
      `  From beginning: ${fromBeginning}\n\n`,
  );

  const consumer: Consumer = kafka.consumer({ groupId });
  const producer: Producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });

  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: dlqTopic, fromBeginning });

  let stop = false;

  const shutdown = async () => {
    stop = true;
    try {
      await consumer.disconnect();
    } catch {
      /* ignore */
    }
    try {
      await producer.disconnect();
    } catch {
      /* ignore */
    }
    rl.close();
  };

  process.on("SIGINT", () => {
    output.write("\nReceived SIGINT — shutting down...\n");
    void shutdown().then(() => process.exit(0));
  });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (stop) return;

      const offset = message.offset;
      const rawValue = message.value?.toString("utf8") ?? "";
      const headers = decodeHeaders(message.headers);
      const summary = summarize(rawValue);

      output.write(
        `\n────────────────────────────────────────────────────────────────\n` +
          `[DLQ msg] topic=${topic} partition=${partition} offset=${offset}\n` +
          `  command: ${summary.commandName ?? "(unknown)"}\n` +
          `  tenant:  ${summary.tenantId ?? "(unknown)"}\n` +
          `  cmd-id:  ${summary.commandId ?? "(unknown)"}\n` +
          `  reason:  ${summary.failureReason ?? "(unknown)"}\n`,
      );

      let handled = false;
      while (!handled && !stop) {
        const action = await promptAction();
        switch (action) {
          case "inspect": {
            output.write(`  headers: ${JSON.stringify(headers, null, 2)}\n`);
            output.write(`  body:    ${rawValue}\n`);
            break;
          }
          case "republish": {
            try {
              const { value, key } = buildReplayEnvelope(rawValue, offset);
              await producer.send({
                topic: commandTopic,
                messages: [
                  {
                    key,
                    value,
                    headers: {
                      ...headers,
                      "x-replayed-from": "dlq",
                      "x-replayed-dlq-offset": offset,
                    },
                  },
                ],
              });
              output.write(`  ✓ Republished to ${commandTopic} (key=${key})\n`);
              await consumer.commitOffsets([
                { topic, partition, offset: (BigInt(offset) + 1n).toString() },
              ]);
              handled = true;
            } catch (err) {
              output.write(`  ✗ Republish failed: ${(err as Error).message}\n`);
            }
            break;
          }
          case "drop": {
            await consumer.commitOffsets([
              { topic, partition, offset: (BigInt(offset) + 1n).toString() },
            ]);
            output.write(`  ✓ Dropped (offset committed, not replayed)\n`);
            handled = true;
            break;
          }
          case "quit": {
            await shutdown();
            process.exit(0);
          }
        }
      }
    },
  });
};

main().catch((err) => {
  output.write(`\nFATAL: ${(err as Error).message}\n${(err as Error).stack ?? ""}\n`);
  process.exit(1);
});
