import { createDbPool } from "@tartware/config/db";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

const db = createDbPool(config.db, appLogger);

export const { query } = db;
