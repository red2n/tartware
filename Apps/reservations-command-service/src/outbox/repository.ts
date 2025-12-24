import { createOutboxRepository } from "@tartware/outbox";

import { query, withTransaction } from "../lib/db.js";

const repository = createOutboxRepository({ query, withTransaction });

export const {
  enqueueOutboxRecordWithClient,
  countPendingOutboxRows,
  releaseExpiredLocks,
  claimOutboxBatch,
  markOutboxDelivered,
  markOutboxFailed,
} = repository;
