import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3100),
  opensearchUrl: z.string().url().default("http://localhost:9200").describe("OpenSearch endpoint"),
  logIndexPattern: z.string().min(1).default("otel-logs-*"),
  maxPageSize: z.coerce.number().int().min(50).max(1000).default(200),
});

export type ServiceConfig = z.infer<typeof ConfigSchema>;

export const config: ServiceConfig = ConfigSchema.parse({
  port: process.env.PORT,
  opensearchUrl: process.env.OPENSEARCH_URL,
  logIndexPattern: process.env.LOGS_INDEX_PATTERN,
  maxPageSize: process.env.MAX_PAGE_SIZE,
});
