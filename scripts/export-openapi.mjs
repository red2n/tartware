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
    id: "settings-service",
    output: "docs/openapi/settings-service.json",
    modulePath: "Apps/settings-service/dist/Apps/settings-service/src/app.js",
    build: async () => {
      ensureSettingsServiceEnv();
      const { buildServer } = await import(
        resolveDistModule("Apps/settings-service/dist/Apps/settings-service/src/app.js")
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
      `${message}\nEnsure the service has been built (npm run build) so that ${resolvedModulePath} exists.`,
    );
    enhancedError.cause = error;
    throw enhancedError;
  }
};

const run = async () => {
  for (const service of services) {
    await exportSpec(service);
  }
};

const ensureSettingsServiceEnv = () => {
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "local-audience";
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "local-issuer";
  process.env.JWT_PUBLIC_KEY =
    process.env.JWT_PUBLIC_KEY ??
    [
      "-----BEGIN PUBLIC KEY-----",
      "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALiH8XTur2qxGn8pY/+bexdFv+I5jBq5",
      "x2VxYcy8KX2HFqRSbuuSSMzdg3NofM8JrIoVNewc19hXtOD87mpy4V8CAwEAAQ==",
      "-----END PUBLIC KEY-----",
    ].join("\\n");
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
