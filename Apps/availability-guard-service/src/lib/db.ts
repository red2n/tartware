import { createDbPool } from "@tartware/config/db";

import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";

const db = createDbPool(config.db, appLogger);

export const { query, withTransaction } = db;
