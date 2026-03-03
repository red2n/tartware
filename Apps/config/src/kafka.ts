export const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

export const parseBrokerList = (value: string | undefined, fallback?: string): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

export const parseNumberList = (value: string | undefined): number[] =>
  (value ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

type KafkaConfigInput = {
  clientId: string;
  defaultPrimaryBroker?: string;
  env?: NodeJS.ProcessEnv;
  runtimeEnv?: string;
  /**
   * Override the default env var names (KAFKA_BROKERS, KAFKA_FAILOVER_BROKERS, etc.)
   * to support services that use a prefix (e.g. COMMAND_CENTER_KAFKA_BROKERS).
   * Each key can be a single name or an array of names tried in order (first defined wins).
   */
  envKeys?: {
    brokers?: string | string[];
    failoverBrokers?: string | string[];
    activeCluster?: string | string[];
    failoverEnabled?: string | string[];
  };
};

/** Resolve a value from one or more env key names, returning the first defined. */
const resolveEnvKey = (
  env: NodeJS.ProcessEnv,
  keys: string | string[] | undefined,
  defaultKey: string,
): string | undefined => {
  const candidates = keys ? (Array.isArray(keys) ? keys : [keys]) : [defaultKey];
  for (const key of candidates) {
    if (env[key] !== undefined) return env[key];
  }
  return undefined;
};

export const resolveKafkaConfig = (input: KafkaConfigInput) => {
  const env = input.env ?? process.env;
  const runtimeEnv = (input.runtimeEnv ?? env.NODE_ENV ?? "development").toLowerCase();
  const isProduction = runtimeEnv === "production";
  const ek = input.envKeys;

  const brokersRaw = resolveEnvKey(env, ek?.brokers, "KAFKA_BROKERS");
  const failoverBrokersRaw = resolveEnvKey(env, ek?.failoverBrokers, "KAFKA_FAILOVER_BROKERS");
  const activeClusterRaw = resolveEnvKey(env, ek?.activeCluster, "KAFKA_ACTIVE_CLUSTER");
  const failoverEnabledRaw = resolveEnvKey(env, ek?.failoverEnabled, "KAFKA_FAILOVER_ENABLED");

  const primaryKafkaBrokers = parseBrokerList(brokersRaw, input.defaultPrimaryBroker);
  const usedDefaultPrimary = (brokersRaw ?? "").trim().length === 0;
  const failoverKafkaBrokers = parseBrokerList(failoverBrokersRaw);
  const requestedCluster = (activeClusterRaw ?? "primary").toLowerCase();
  const failoverToggle = parseBooleanEnv(failoverEnabledRaw, false);
  const useFailover =
    (requestedCluster === "failover" || failoverToggle) && failoverKafkaBrokers.length > 0;

  let kafkaActiveCluster: "primary" | "failover" = "primary";
  let kafkaBrokers = primaryKafkaBrokers;

  if (useFailover) {
    kafkaBrokers = failoverKafkaBrokers;
    kafkaActiveCluster = "failover";
  } else if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length > 0) {
    kafkaBrokers = failoverKafkaBrokers;
    kafkaActiveCluster = "failover";
  }

  if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
    throw new Error("KAFKA_BROKERS or KAFKA_FAILOVER_BROKERS must be set");
  }

  if (useFailover && failoverKafkaBrokers.length === 0) {
    throw new Error("Failover requested/enabled but KAFKA_FAILOVER_BROKERS is empty");
  }

  if (kafkaActiveCluster === "primary" && primaryKafkaBrokers.length === 0) {
    throw new Error("Primary cluster requested but KAFKA_BROKERS is empty");
  }

  if (isProduction && usedDefaultPrimary && kafkaActiveCluster === "primary") {
    throw new Error(
      "Production requires explicit KAFKA_BROKERS; default localhost fallback is disabled",
    );
  }

  return {
    clientId: input.clientId,
    brokers: kafkaBrokers,
    primaryBrokers: primaryKafkaBrokers,
    failoverBrokers: failoverKafkaBrokers,
    activeCluster: kafkaActiveCluster,
  };
};
