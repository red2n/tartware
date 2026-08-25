import { createCommandDispatchRepository } from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

export const {
  findCommandDispatchByRequest,
  insertCommandDispatch,
  updateCommandDispatchStatusBatch,
} = createCommandDispatchRepository(query);
