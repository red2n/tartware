/**
 * Choosing the Kafka partition key for a command.
 *
 * Kafka orders messages within a partition and nowhere else, so the key decides
 * which commands are guaranteed to apply in the order they were accepted.
 *
 * Commands used to be keyed by their own command id. That spreads load evenly
 * and guarantees nothing: `reservation.check_in` and `reservation.check_out`
 * for one stay would land on different partitions and could apply in either
 * order. For a property management system that is a guest checked out before
 * they were checked in, or a folio closed before its charges post.
 *
 * Keying by tenant would fix the ordering and create a different problem — a
 * chain the size of a large hotel group becomes one partition, and that tenant
 * is then capped at a single consumer's throughput no matter how the cluster
 * is scaled.
 *
 * So the key is the *aggregate the command mutates*: the reservation, the
 * folio, the invoice. Every command touching one reservation lands on one
 * partition and applies in order, while different reservations spread across
 * the cluster. Ordering where it is needed, distribution everywhere else.
 *
 * A note on creates: `reservation.create` has no reservation to key on unless
 * the caller supplies `reservation_id` (the schema allows it). Without one the
 * command falls back to a coarser field and finally to its own id, which is
 * safe — nothing precedes a create for an aggregate that does not exist yet.
 * A caller that supplies the id upfront gets the whole create → check-in →
 * check-out chain ordered end to end, which is the reason to supply it.
 */

/**
 * Aggregate identifiers in priority order: most specific first.
 *
 * Order is the contract. `property_id` appears on almost every command, so it
 * sits near the end — promoting it would collapse a whole property onto one
 * partition and undo the point. Anything finer-grained must be listed above it.
 */
const AGGREGATE_KEY_FIELDS = [
  "reservation_id",
  "folio_id",
  "invoice_id",
  "payment_id",
  "group_booking_id",
  "task_id",
  "maintenance_id",
  "asset_id",
  "contract_id",
  "schedule_id",
  "shift_id",
  "batch_id",
  "period_id",
  "voucher_id",
  "policy_id",
  "segment_id",
  "template_id",
  "room_id",
  "guest_id",
  "company_id",
  "account_id",
  "profile_id",
  // Coarsest useful scope: property-wide operations such as a night audit or a
  // date roll have no finer aggregate, and ordering them per property is right.
  "property_id",
] as const;

/** Exposed so a conformance test can assert the ordering rather than trust it. */
export const aggregateKeyFields: readonly string[] = AGGREGATE_KEY_FIELDS;

const isUsableKey = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Resolve the partition key for a command payload.
 *
 * @param payload the command's validated payload
 * @param fallback used when the payload names no aggregate — pass the command
 * id, which spreads evenly and orders nothing, the correct behaviour for a
 * command that has no aggregate to be ordered against.
 */
export const resolveCommandPartitionKey = (
  payload: Record<string, unknown> | null | undefined,
  fallback: string,
): string => {
  if (!payload) {
    return fallback;
  }
  for (const field of AGGREGATE_KEY_FIELDS) {
    const value = payload[field];
    if (isUsableKey(value)) {
      return value;
    }
  }
  return fallback;
};
