import { createDbPool } from "@tartware/config/db";

import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";

const db = createDbPool(config.db, appLogger);

// queryWithClient / withTransaction are deliberately not re-exported: this
// service has no multi-statement write left since the cashier command handlers
// moved to billing-service, and knip fails the build on an unused export.
// Add them back alongside the transaction that needs them.
export const { pool, query } = db;
