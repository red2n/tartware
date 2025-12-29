#!/usr/bin/env node

/**
 * Ensures the OpenTelemetry collector is reachable before starting dev services.
 * 1. If OTEL exporter vars are unset/blank, exits successfully (telemetry disabled).
 * 2. Otherwise, attempts a TCP connection to the configured host/port.
 * 3. If unreachable, tries `docker compose up -d opensearch otel-collector`.
 * 4. If still unreachable, prints guidance and exits with code 1.
 */

import { spawnSync } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { URL } from "node:url";

const DEFAULT_ENDPOINT = "http://localhost:4318/v1";
const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_EXPORTER_OTLP_ENDPOINT.trim() !== ""
    ? process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    : DEFAULT_ENDPOINT;

const telemetryDisabled =
  (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").trim() === "" &&
  (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ?? "").trim() === "" &&
  (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "").trim() === "";

if (telemetryDisabled) {
  process.exit(0);
}

const parseAddress = () => {
  try {
    const url = new URL(endpoint);
    const port = Number(url.port || 80);
    return { host: url.hostname, port };
  } catch (error) {
    console.warn(`⚠️  Unable to parse OTEL endpoint "${endpoint}", assuming localhost:4318`, error);
    return { host: "localhost", port: 4318 };
  }
};

const { host, port } = parseAddress();

const canConnect = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(2000);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });

const startCollector = () => {
  console.log("⚙️  Attempting to start OpenTelemetry collector via docker compose...");
  const result = spawnSync(
    "docker",
    ["compose", "up", "-d", "opensearch", "otel-collector"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(
      "✗ Failed to start otel-collector via docker compose. Please ensure Docker is running and rerun `docker compose up -d opensearch otel-collector` manually.",
    );
    return false;
  }
  return true;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  if (await canConnect()) {
    return;
  }

  console.warn(
    `⚠️  OpenTelemetry collector at ${host}:${port} is unreachable. Trying to start required containers...`,
  );
  if (!startCollector()) {
    process.exit(1);
  }

  await wait(2000);

  if (await canConnect()) {
    console.log("✅ OpenTelemetry collector is now reachable.");
    return;
  }

  console.error(
    `✗ Unable to reach OpenTelemetry collector at ${host}:${port}. ` +
      "Start it manually with `docker compose up -d opensearch otel-collector`, " +
      "or disable telemetry by clearing OTEL_EXPORTER_OTLP_* before running dev servers.",
  );
  process.exit(1);
};

main();
