import { createCommandDispatchRepository } from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

export const {
	insertCommandDispatch,
	updateCommandDispatchStatus,
} = createCommandDispatchRepository(query);
