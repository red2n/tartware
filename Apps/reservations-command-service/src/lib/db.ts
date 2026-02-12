import { createDbPool } from "@tartware/config/db";

import { databaseConfig } from "../config.js";
import { reservationsLogger } from "../logger.js";

const db = createDbPool(databaseConfig, reservationsLogger);

export const { query, withTransaction } = db;
