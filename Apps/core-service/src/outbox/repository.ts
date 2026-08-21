/**
 * Transactional-outbox access for core-service.
 *
 * The repository is built on first use rather than at import time: `../lib/db.js`
 * is partially mocked across the route test suites, and reading `withTransaction`
 * at module scope makes merely importing anything that touches the outbox throw
 * there. Deferring the read keeps this module side-effect-free to import.
 */
import { createOutboxRepository, type OutboxRepository } from "@tartware/outbox";

import { query, withTransaction } from "../lib/db.js";

let repository: OutboxRepository | null = null;

const getRepository = (): OutboxRepository => {
  repository ??= createOutboxRepository({ query, withTransaction });
  return repository;
};

export const enqueueOutboxRecordWithClient: OutboxRepository["enqueueOutboxRecordWithClient"] = (
  client,
  input,
) => getRepository().enqueueOutboxRecordWithClient(client, input);

export const releaseExpiredLocks: OutboxRepository["releaseExpiredLocks"] = (lockTimeoutMs) =>
  getRepository().releaseExpiredLocks(lockTimeoutMs);

export const claimOutboxBatch: OutboxRepository["claimOutboxBatch"] = (
  limit,
  workerId,
  aggregateTypeFilter,
) => getRepository().claimOutboxBatch(limit, workerId, aggregateTypeFilter);

export const markOutboxDelivered: OutboxRepository["markOutboxDelivered"] = (id) =>
  getRepository().markOutboxDelivered(id);

export const markOutboxFailed: OutboxRepository["markOutboxFailed"] = (
  id,
  error,
  retryBackoffMs,
  maxRetries,
) => getRepository().markOutboxFailed(id, error, retryBackoffMs, maxRetries);
