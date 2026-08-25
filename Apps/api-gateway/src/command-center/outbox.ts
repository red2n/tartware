import { createOutboxRepository } from "@tartware/outbox";

import { query, withTransaction } from "../lib/db.js";

const repository = createOutboxRepository({ query, withTransaction });

export const {
  claimOutboxBatch,
  enqueueOutboxRecord,
  enqueueOutboxRecordWithClient,
  markOutboxDeliveredBatch,
  markOutboxFailed,
  releaseExpiredLocks,
} = repository;
