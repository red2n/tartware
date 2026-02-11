import { createOutboxRepository } from "@tartware/outbox";

import { query, withTransaction } from "../lib/db.js";

const repository = createOutboxRepository({ query, withTransaction });

export const {
  enqueueOutboxRecord,
  markOutboxDelivered,
  markOutboxDeliveredByEventId,
  markOutboxFailed,
  markOutboxFailedByEventId,
} = repository;
