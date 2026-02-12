import { createDbPool } from "@tartware/config/db";

import { config } from "../config.js";
import { rollLogger } from "../lib/logger.js";

const db = createDbPool(config.db, rollLogger);

export const { query, withTransaction } = db;
