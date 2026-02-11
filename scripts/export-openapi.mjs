import { generateKeyPairSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const resolveDistModule = (relativePath) => {
  const absolutePath = path.resolve(workspaceRoot, relativePath);
  return pathToFileURL(absolutePath).href;
};

const services = [
  {
    id: "core-service",
    output: "docs/openapi/core-service.json",
    modulePath: "Apps/core-service/dist/Apps/core-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(resolveDistModule("Apps/core-service/dist/Apps/core-service/src/server.js"));
      return buildServer();
    },
  },
  {
    id: "reservations-command-service",
    output: "docs/openapi/reservations-command-service.json",
    modulePath: "Apps/reservations-command-service/dist/Apps/reservations-command-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/reservations-command-service/dist/Apps/reservations-command-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "guests-service",
    output: "docs/openapi/guests-service.json",
    modulePath: "Apps/guests-service/dist/Apps/guests-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/guests-service/dist/Apps/guests-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "rooms-service",
    output: "docs/openapi/rooms-service.json",
    modulePath: "Apps/rooms-service/dist/Apps/rooms-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/rooms-service/dist/Apps/rooms-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "housekeeping-service",
    output: "docs/openapi/housekeeping-service.json",
    modulePath: "Apps/housekeeping-service/dist/Apps/housekeeping-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/housekeeping-service/dist/Apps/housekeeping-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "billing-service",
    output: "docs/openapi/billing-service.json",
    modulePath: "Apps/billing-service/dist/Apps/billing-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/billing-service/dist/Apps/billing-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "command-center-service",
    output: "docs/openapi/command-center-service.json",
    modulePath: "Apps/command-center-service/dist/Apps/command-center-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/command-center-service/dist/Apps/command-center-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "api-gateway",
    output: "docs/openapi/api-gateway.json",
    modulePath: "Apps/api-gateway/dist/Apps/api-gateway/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/api-gateway/dist/Apps/api-gateway/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "settings-service",
    output: "docs/openapi/settings-service.json",
    modulePath: "Apps/settings-service/dist/Apps/settings-service/src/server.js",
    build: async () => {
      ensureSettingsServiceEnv();
      const { buildServer } = await import(
        resolveDistModule("Apps/settings-service/dist/Apps/settings-service/src/server.js")
      );
      return buildServer({ logger: false });
    },
  },
  {
    id: "recommendation-service",
    output: "docs/openapi/recommendation-service.json",
    modulePath: "Apps/recommendation-service/dist/Apps/recommendation-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/recommendation-service/dist/Apps/recommendation-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "availability-guard-service",
    output: "docs/openapi/availability-guard-service.json",
    modulePath: "Apps/availability-guard-service/dist/Apps/availability-guard-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/availability-guard-service/dist/Apps/availability-guard-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "notification-service",
    output: "docs/openapi/notification-service.json",
    modulePath: "Apps/notification-service/dist/Apps/notification-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/notification-service/dist/Apps/notification-service/src/server.js")
      );
      return buildServer();
    },
  },
  {
    id: "revenue-service",
    output: "docs/openapi/revenue-service.json",
    modulePath: "Apps/revenue-service/dist/Apps/revenue-service/src/server.js",
    build: async () => {
      const { buildServer } = await import(
        resolveDistModule("Apps/revenue-service/dist/Apps/revenue-service/src/server.js")
      );
      return buildServer({ logger: false });
    },
  },
];

const ensureDistExists = async (relativePath) => {
  const absolutePath = path.resolve(workspaceRoot, relativePath);
  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
  } catch {
    // Directory creation failure handled later when writing files.
  }
};

const exportSpec = async ({ id, output, modulePath, build }) => {
  const resolvedModulePath = path.resolve(workspaceRoot, modulePath);
  try {
    await ensureDistExists(output);
    const app = await build();
    try {
      await app.ready();
      if (typeof app.swagger !== "function") {
        throw new Error(
          `${id} does not have swagger() available. Ensure the Swagger plugin is registered before running export.`,
        );
      }

      const spec = app.swagger();
      const outputPath = path.resolve(workspaceRoot, output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(spec, null, 2), "utf8");
      console.log(`[export:openapi] Wrote ${output}`);
    } finally {
      await app.close();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Unable to export spec for ${id}: ${String(error)}`;
    const enhancedError = new Error(
      `${message}\nEnsure the service has been built (pnpm run build) so that ${resolvedModulePath} exists.`,
    );
    enhancedError.cause = error;
    throw enhancedError;
  }
};

const run = async () => {
  // Set test env to bypass config validation (DB_PASSWORD, JWT keys, etc.)
  process.env.NODE_ENV = "test";

  const failed = [];
  for (const service of services) {
    try {
      await exportSpec(service);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[export:openapi] SKIP ${service.id}: ${msg.split("\n")[0]}`);
      failed.push(service.id);
    }
  }
  if (failed.length > 0) {
    console.warn(`\n[export:openapi] ${failed.length} service(s) failed: ${failed.join(", ")}`);
  }
};

const ensureSettingsServiceEnv = () => {
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "local-audience";
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "local-issuer";
  // Generate a valid RSA-2048 key pair for spec export (fast-jwt validates key format)
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  process.env.JWT_PUBLIC_KEY = publicKey;
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
