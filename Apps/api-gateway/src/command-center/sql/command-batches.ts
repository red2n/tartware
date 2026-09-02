import { createCommandBatchRepository } from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

const { findCommandBatch, listCommandBatches } = createCommandBatchRepository(query);

export { findCommandBatch, listCommandBatches };
