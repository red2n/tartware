import { createDbPool } from "@tartware/config/db";

import { dbConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

const db = createDbPool(dbConfig, gatewayLogger);

export const { query, withTransaction } = db;
