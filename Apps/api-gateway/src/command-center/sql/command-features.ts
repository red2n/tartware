import { createCommandFeatureRepository } from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

const { listCommandFeatures, updateCommandFeatureStatus, batchUpdateCommandFeatureStatuses } =
  createCommandFeatureRepository(query);

export { batchUpdateCommandFeatureStatuses, listCommandFeatures, updateCommandFeatureStatus };
