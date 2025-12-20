import { query } from "../lib/db.js";

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

export const loadCommandRegistrySnapshot = async (
  environment: string,
): Promise<CommandRegistrySnapshot> => {
  const [templates, routes, features] = await Promise.all([
    query<CommandTemplateRow>(COMMAND_TEMPLATES_SQL),
    query<CommandRouteRow>(COMMAND_ROUTES_SQL, [environment]),
    query<CommandFeatureRow>(COMMAND_FEATURES_SQL, [environment]),
  ]);

  return {
    templates: templates.rows.map(mapTemplateRow),
    routes: routes.rows.map(mapRouteRow),
    features: features.rows.map(mapFeatureRow),
  };
};

const mapTemplateRow = (row: CommandTemplateRow): CommandTemplateRow => ({
  ...row,
  required_modules: row.required_modules ?? [],
  payload_schema: coerceObject(row.payload_schema),
  sample_payload: coerceObject(row.sample_payload),
  metadata: coerceObject(row.metadata),
});

const mapRouteRow = (row: CommandRouteRow): CommandRouteRow => ({
  ...row,
  metadata: coerceObject(row.metadata),
  weight: Number(row.weight ?? 0),
});

const mapFeatureRow = (row: CommandFeatureRow): CommandFeatureRow => ({
  ...row,
  metadata: coerceObject(row.metadata),
  max_per_minute:
    row.max_per_minute === null || row.max_per_minute === undefined
      ? null
      : Number(row.max_per_minute),
  burst:
    row.burst === null || row.burst === undefined ? null : Number(row.burst),
});

const coerceObject = (
  value: Record<string, unknown> | null,
): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value;
  }
  return {};
};
