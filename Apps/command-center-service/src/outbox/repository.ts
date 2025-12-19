import { createOutboxRepository } from "@tartware/outbox";

import { query, withTransaction } from "../lib/db.js";

const repository = createOutboxRepository({ query, withTransaction });

export const {
  enqueueOutboxRecord,
  countPendingOutboxRows,
  releaseExpiredLocks,
  claimOutboxBatch,
  markOutboxDelivered,
  markOutboxFailed,
} = repository;
