import type { CommandFeatureStatus } from "@tartware/schemas";

import type { QueryExecutor } from "./command-dispatches.js";

type CommandTemplateRow = {
  command_name: string;
  version: string;
  description: string | null;
  default_target_service: string;
  default_topic: string;
  required_modules: string[] | null;
  payload_schema: Record<string, unknown> | null;
  sample_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type CommandRouteRow = {
  id: string;
  command_name: string;
  environment: string;
  tenant_id: string | null;
  service_id: string;
  topic: string;
  weight: number;
  status: "active" | "disabled";
  metadata: Record<string, unknown> | null;
};

type CommandFeatureRow = {
  id: string;
  command_name: string;
  environment: string;
  tenant_id: string | null;
  status: "enabled" | "disabled" | "observation";
  max_per_minute: number | null;
  burst: number | null;
  metadata: Record<string, unknown> | null;
};

export type CommandRegistrySnapshot = {
  templates: CommandTemplateRow[];
  routes: CommandRouteRow[];
  features: CommandFeatureRow[];
};

const COMMAND_TEMPLATES_SQL = `
  SELECT
    command_name,
    version,
    description,
    default_target_service,
    default_topic,
    required_modules,
    payload_schema,
    sample_payload,
    metadata
  FROM command_templates
  WHERE TRUE
`;

const COMMAND_ROUTES_SQL = `
  SELECT
    id,
    command_name,
    environment,
    tenant_id,
    service_id,
    topic,
    weight,
    status,
    metadata
  FROM command_routes
  WHERE environment = $1
`;

const COMMAND_FEATURES_SQL = `
  SELECT
    id,
    command_name,
    environment,
    tenant_id,
    status,
    max_per_minute,
    burst,
    metadata
  FROM command_features
  WHERE environment = $1
`;

const coerceObject = (value: Record<string, unknown> | null): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value;
  }
  return {};
};

type CommandFeatureListRow = {
  command_name: string;
  label: string;
  description: string;
  default_target_service: string;
  required_modules: string[] | null;
  version: string;
  feature_id: string | null;
  status: "enabled" | "disabled" | "observation";
  max_per_minute: number | null;
  burst: number | null;
};

const COMMAND_FEATURES_LIST_SQL = `
  SELECT
    ct.command_name,
    COALESCE(ct.metadata->>'label', ct.command_name) AS label,
    COALESCE(ct.metadata->>'description', ct.description, ct.command_name) AS description,
    ct.default_target_service,
    ct.required_modules,
    ct.version,
    cf.id AS feature_id,
    COALESCE(cf.status, 'disabled') AS status,
    cf.max_per_minute,
    cf.burst
  FROM command_templates ct
  LEFT JOIN command_features cf
    ON cf.command_name = ct.command_name
    AND cf.environment = $1
    AND cf.tenant_id IS NULL
  ORDER BY ct.command_name
`;

type CommandFeatureUpdateRow = {
  id: string;
  command_name: string;
  status: "enabled" | "disabled" | "observation";
  updated_at: string;
};

const UPDATE_COMMAND_FEATURE_SQL = `
  UPDATE command_features
  SET status = $1::command_feature_status, updated_at = NOW()
  WHERE command_name = $2 AND environment = $3 AND tenant_id IS NULL
  RETURNING id, command_name, status, updated_at::text
`;

const INSERT_COMMAND_FEATURE_SQL = `
  INSERT INTO command_features (id, command_name, environment, tenant_id, status, metadata, created_at, updated_at)
  VALUES (gen_random_uuid(), $1, $2, NULL, $3::command_feature_status, '{}'::jsonb, NOW(), NOW())
  RETURNING id, command_name, status, updated_at::text
`;

export const createCommandRegistryRepository = (query: QueryExecutor) => {
  const loadCommandRegistrySnapshot = async (
    environment: string,
  ): Promise<CommandRegistrySnapshot> => {
    const [templates, routes, features] = await Promise.all([
      query<CommandTemplateRow>(COMMAND_TEMPLATES_SQL),
      query<CommandRouteRow>(COMMAND_ROUTES_SQL, [environment]),
      query<CommandFeatureRow>(COMMAND_FEATURES_SQL, [environment]),
    ]);

    return {
      templates: templates.rows.map((row) => ({
        ...row,
        required_modules: row.required_modules ?? [],
        payload_schema: coerceObject(row.payload_schema),
        sample_payload: coerceObject(row.sample_payload),
        metadata: coerceObject(row.metadata),
      })),
      routes: routes.rows.map((row) => ({
        ...row,
        metadata: coerceObject(row.metadata),
        weight: Number(row.weight ?? 0),
      })),
      features: features.rows.map((row) => ({
        ...row,
        metadata: coerceObject(row.metadata),
        max_per_minute:
          row.max_per_minute === null || row.max_per_minute === undefined
            ? null
            : Number(row.max_per_minute),
        burst: row.burst === null || row.burst === undefined ? null : Number(row.burst),
      })),
    };
  };

  return {
    loadCommandRegistrySnapshot,
  };
};

export const createCommandFeatureRepository = (query: QueryExecutor) => {
  /** List all commands joined with their global feature status. */
  const listCommandFeatures = async (environment: string): Promise<CommandFeatureListRow[]> => {
    const { rows } = await query<CommandFeatureListRow>(COMMAND_FEATURES_LIST_SQL, [environment]);
    return rows.map((row) => ({
      ...row,
      required_modules: row.required_modules ?? [],
      max_per_minute:
        row.max_per_minute === null || row.max_per_minute === undefined
          ? null
          : Number(row.max_per_minute),
      burst: row.burst === null || row.burst === undefined ? null : Number(row.burst),
    }));
  };

  /** Update (or insert) the global feature status for a command. */
  const updateCommandFeatureStatus = async (
    commandName: string,
    environment: string,
    status: CommandFeatureStatus,
  ): Promise<CommandFeatureUpdateRow> => {
    const updated = await query<CommandFeatureUpdateRow>(UPDATE_COMMAND_FEATURE_SQL, [
      status,
      commandName,
      environment,
    ]);
    if (updated.rows.length > 0) {
      return updated.rows[0];
    }
    const inserted = await query<CommandFeatureUpdateRow>(INSERT_COMMAND_FEATURE_SQL, [
      commandName,
      environment,
      status,
    ]);
    return inserted.rows[0];
  };

  /** Batch-update multiple command feature statuses. */
  const batchUpdateCommandFeatureStatuses = async (
    updates: Array<{ command_name: string; status: CommandFeatureStatus }>,
    environment: string,
  ): Promise<{
    updated: CommandFeatureUpdateRow[];
    failed: Array<{ command_name: string; error: string }>;
  }> => {
    const results: CommandFeatureUpdateRow[] = [];
    const failures: Array<{ command_name: string; error: string }> = [];

    for (const { command_name, status } of updates) {
      try {
        const row = await updateCommandFeatureStatus(command_name, environment, status);
        results.push(row);
      } catch {
        failures.push({ command_name, error: "Failed to update" });
      }
    }

    return { updated: results, failed: failures };
  };

  return {
    listCommandFeatures,
    updateCommandFeatureStatus,
    batchUpdateCommandFeatureStatuses,
  };
};

export type {
  CommandTemplateRow,
  CommandRouteRow,
  CommandFeatureRow,
  CommandFeatureListRow,
  CommandFeatureUpdateRow,
};
