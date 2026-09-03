import { createHash, randomUUID } from "node:crypto";
import type {
  AcceptCommandInput,
  AcceptedCommand,
  CommandAcceptanceOutcome,
  CommandAcceptanceResult,
  CommandApprovalTicket,
  CommandDeferredForApproval,
  CommandDispatchDependencies,
  CommandDispatchLookup,
  CommandDispatchWriter,
  CommandFeatureInfo,
  CommandOutboxRecord,
  CommandResolution,
  CommandRouteInfo,
  Initiator,
} from "@tartware/schemas";
import {
  commandApproverRole,
  evaluateStepUpGrant,
  type OverrideStepUpGrant,
} from "@tartware/schemas";

import { resolveCommandPartitionKey } from "./partition-key.js";

export type {
  Initiator,
  CommandRouteInfo,
  CommandFeatureInfo,
  CommandResolution,
  AcceptCommandInput,
  CommandOutboxRecord,
  CommandDispatchDependencies,
  CommandDispatchWriter,
  CommandAcceptanceResult,
  CommandAcceptanceOutcome,
  CommandApprovalTicket,
  CommandDeferredForApproval,
  AcceptedCommand,
};

/**
 * Error type for command dispatch failures.
 */
export class CommandDispatchError extends Error {
  code: string;
  statusCode: number;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Thrown when the dispatch insert loses a race to an identical request.
 *
 * It has to escape the transaction rather than be handled inside it: the outbox
 * row is written first to satisfy the `outbox_event_id` foreign key, so by the
 * time the conflict is known there is an outbox row in the transaction that
 * would publish a second copy of a command already accepted. Unwinding is what
 * discards it — the replay is then answered from the committed row outside.
 */
class DuplicateDispatchError extends Error {
  constructor() {
    super("command dispatch already exists for this request");
    this.name = "DuplicateDispatchError";
  }
}

/**
 * Verify and spend a step-up grant, or refuse the command.
 *
 * `evaluateStepUpGrant` holds the rules; this only does the claiming and turns
 * a refusal into the error the caller sees. The claim is conditional in SQL as
 * well as evaluated here — the evaluation gives a specific, honest message
 * ("expired", "already used", "given for a different record"), and the
 * conditional UPDATE is what makes single use true under a race rather than
 * merely checked.
 */
const claimStepUp = async (
  writer: CommandDispatchWriter,
  input: AcceptCommandInput<unknown>,
  commandId: string,
): Promise<OverrideStepUpGrant> => {
  const grantId = input.stepUpGrantId as string;

  if (!writer.claimStepUpGrant) {
    // Fail closed, exactly as the dual-control branch does. Applying the
    // operator's own authority because the step-up could not be verified is the
    // failure the step-up exists to prevent.
    throw new CommandDispatchError(
      503,
      "STEP_UP_UNAVAILABLE",
      "A supervisor authorisation was supplied and cannot be verified here.",
    );
  }

  const result = await writer.claimStepUpGrant({
    grantId,
    tenantId: input.tenantId,
    commandId,
  });

  if (!result) {
    // No such grant. Says nothing about which ids exist, deliberately.
    throw new CommandDispatchError(
      403,
      "STEP_UP_GRANT_NOT_FOUND",
      "That supervisor authorisation is no longer usable. Ask for a new one.",
    );
  }

  // Evaluated against the row as it stood *before* the claim: an
  // `UPDATE … RETURNING` would hand back the `consumed_at` this claim just
  // wrote, and the first legitimate spend would be refused as a replay.
  const entityId = readEntityId(input.payload);
  const verdict = evaluateStepUpGrant({
    grant: result.grant,
    tenantId: input.tenantId,
    commandName: input.commandName,
    entityId,
  });
  if (!verdict.ok) {
    // The claim, if it won one, stays. A grant spent on a command it did not
    // authorise is burnt rather than returned: re-offering it would let an
    // operator hunt for the command it happens to fit.
    throw new CommandDispatchError(403, verdict.code, verdict.message);
  }

  if (!result.claimed) {
    // The rules passed but the conditional UPDATE did not win: another command
    // took this grant between the read and the claim. Single use is decided
    // there, not here.
    throw new CommandDispatchError(
      403,
      "STEP_UP_GRANT_CONSUMED",
      "This authorisation has already been used. Ask for a new one.",
    );
  }

  const claimed = result.grant;

  return {
    grantId: claimed.grant_id,
    supervisorId: claimed.supervisor_id,
    supervisorRole: claimed.supervisor_role as OverrideStepUpGrant["supervisorRole"],
    entityId: claimed.entity_id,
    grantedAt: new Date(claimed.created_at).toISOString(),
  };
};

/**
 * The record a command names, for binding a grant to it.
 *
 * Commands name their subject under a handful of conventional keys rather than
 * one, so this reads the first that is a uuid. A command with none yields
 * `null`, which only a grant that also named no entity can satisfy.
 */
const STEP_UP_ENTITY_KEYS = [
  "reservation_id",
  "folio_id",
  "guest_id",
  "ar_account_id",
  "payment_id",
  "room_id",
  "entity_id",
  "id",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readEntityId = (payload: Record<string, unknown>): string | null => {
  for (const key of STEP_UP_ENTITY_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && UUID_RE.test(value)) return value;
  }
  return null;
};

const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

/**
 * Rebuild the acceptance result from the dispatch row recorded the first time
 * this request id was seen, so a retry observes the original command id and
 * routing rather than a second command.
 */
const buildReplayResult = (
  existing: CommandDispatchLookup,
  payload: Record<string, unknown>,
): CommandAcceptanceResult => {
  const routingMetadata = existing.routing_metadata ?? {};
  const featureStatus = readString(existing.metadata?.featureStatus, "enabled");
  const targetService = existing.target_service;
  const targetTopic = existing.target_topic;
  const issuedAt = existing.issued_at;
  const routeSource = readString(routingMetadata.routeSource, "unknown");

  const headers: Record<string, string> = {
    "x-command-name": existing.command_name,
    "x-command-tenant-id": existing.tenant_id,
    "x-command-request-id": existing.request_id,
    "x-command-target": targetService,
    "x-command-route-source": routeSource,
  };
  if (existing.correlation_id) {
    headers["x-correlation-id"] = existing.correlation_id;
  }

  const route = {
    id: readString(routingMetadata.routeId, "unknown"),
    source: routeSource,
    tenantId:
      typeof routingMetadata.routeTenantId === "string" ? routingMetadata.routeTenantId : null,
  };

  return {
    status: "accepted",
    commandId: existing.id,
    commandName: existing.command_name,
    tenantId: existing.tenant_id,
    correlationId: existing.correlation_id ?? undefined,
    targetService,
    targetTopic,
    issuedAt,
    headers,
    eventPayload: {
      metadata: {
        commandId: existing.id,
        commandName: existing.command_name,
        tenantId: existing.tenant_id,
        correlationId: existing.correlation_id ?? undefined,
        requestId: existing.request_id,
        targetService,
        targetTopic,
        route: {
          id: route.id,
          tenantId: routingMetadata.routeTenantId ?? null,
          environment: routingMetadata.routeEnvironment ?? "unknown",
          source: routeSource,
        },
        issuedAt,
        featureStatus,
      },
      payload,
    },
    featureStatus,
    route,
  };
};

/**
 * Create a command dispatch service with provided dependencies.
 */
export const createCommandDispatchService = <Membership>(
  deps: CommandDispatchDependencies<Membership>,
) => {
  /**
   * Used when no `withDispatchTransaction` is supplied: the same operations
   * against whatever ambient connection each dependency holds. Without a
   * transaction there is no conflict to report — a duplicate reaches the unique
   * index instead — so the insert always claims to have won.
   */
  const ambientWriter: CommandDispatchWriter = {
    enqueueOutboxRecord: deps.enqueueOutboxRecord,
    insertCommandDispatch: deps.insertCommandDispatch,
    findCommandDispatchByRequest: deps.findCommandDispatchByRequest,
    claimStepUpGrant: deps.claimStepUpGrant,
  };

  const acceptWithin = async (
    writer: CommandDispatchWriter,
    input: AcceptCommandInput<Membership>,
    payloadHash: string,
  ): Promise<CommandAcceptanceOutcome> => {
    const existing = await writer.findCommandDispatchByRequest(
      input.tenantId,
      input.commandName,
      input.requestId,
    );
    if (existing) {
      // Idempotent replays return the original dispatch without reapplying throttles.
      if (existing.payload_hash !== payloadHash) {
        throw new CommandDispatchError(
          409,
          "COMMAND_IDEMPOTENCY_CONFLICT",
          "Request id already used with a different payload.",
        );
      }

      return buildReplayResult(existing, input.payload);
    }

    const resolution = deps.resolveCommandForTenant({
      commandName: input.commandName,
      tenantId: input.tenantId,
      membership: input.membership,
      correlationId: input.correlationId,
      requestId: input.requestId,
    });

    if (resolution.status === "NOT_FOUND") {
      throw new CommandDispatchError(
        404,
        "COMMAND_NOT_FOUND",
        `Command ${input.commandName} is not registered`,
      );
    }

    if (resolution.status === "MODULES_MISSING") {
      throw new CommandDispatchError(
        403,
        "COMMAND_MODULES_NOT_ENABLED",
        `Missing required modules: ${resolution.missingModules.join(", ")}`,
      );
    }

    if (resolution.status === "PERMISSION_DENIED") {
      // One message for every refusal shape. Telling an unauthorised caller
      // whether the command exists, what role it needs, or whether someone
      // denied it to them specifically maps out the permission model for
      // anyone with a login; the reason travels in the log, not the response.
      throw new CommandDispatchError(
        403,
        "COMMAND_PERMISSION_DENIED",
        `Not authorised to run ${input.commandName}.`,
      );
    }

    if (resolution.status === "DISABLED") {
      throw new CommandDispatchError(
        409,
        resolution.reason,
        `Command ${input.commandName} is currently disabled`,
      );
    }

    const { route, feature } = resolution;
    if (deps.throttleCommand) {
      const allowed = await deps.throttleCommand({
        commandName: input.commandName,
        tenantId: input.tenantId,
        requestId: input.requestId,
        feature: feature ?? null,
      });
      if (!allowed) {
        throw new CommandDispatchError(429, "COMMAND_THROTTLED", "Command rate limit exceeded.");
      }
    }

    // ─── Dual control ──────────────────────────────────────────────────────
    //
    // A command that permanently removes money from the ledger, or reopens a
    // control that has already closed, does not reach the outbox on one
    // person's say-so. It becomes a row in `approval_requests` — the queue that
    // has existed since 2025 and that nothing ever entered — and is dispatched
    // by the approval path, from the stored payload, once a second person with
    // the declared role releases it.
    //
    // This sits here rather than in a handler for the same reason the
    // per-command floor does: it is the one point every accepted command passes
    // through, so there is no other route a requester could use instead.
    const approverRole = commandApproverRole(input.commandName);
    if (approverRole && !input.approvalGrant) {
      if (!deps.requireCommandApproval) {
        // Fail closed. Dispatching because the control could not run is the
        // exact failure dual control exists to prevent.
        throw new CommandDispatchError(
          503,
          "COMMAND_APPROVAL_UNAVAILABLE",
          `${input.commandName} requires a second approver and the approval queue is not available.`,
        );
      }
      const ticket = await deps.requireCommandApproval({
        commandName: input.commandName,
        tenantId: input.tenantId,
        payload: input.payload,
        requestId: input.requestId,
        correlationId: input.correlationId,
        initiatedBy: input.initiatedBy,
        approverRole,
      });
      return {
        status: "pending_approval",
        commandName: input.commandName,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        approval: ticket,
      };
    }

    const commandId = randomUUID();

    // A supervisor's authorisation, spent here and only here.
    //
    // After the dual-control branch above, deliberately: a dual-control command
    // can have no grant to spend (the mint path refuses to issue one), and
    // checking in this order means that stays true rather than depending on it.
    //
    // Refuses rather than proceeding unauthorised. An operator who attached a
    // grant is telling us the command needs one, so a grant that cannot be spent
    // is a command that must not run — the alternative is silently applying the
    // clerk's own authority to an override they asked a manager to authorise.
    const stepUp = input.stepUpGrantId ? await claimStepUp(writer, input, commandId) : undefined;

    const targetService = route.service_id;
    const targetTopic = route.topic;
    const issuedAt = new Date().toISOString();
    const featureStatus = feature?.status ?? "enabled";

    const headers: Record<string, string> = {
      "x-command-name": input.commandName,
      "x-command-tenant-id": input.tenantId,
      "x-command-request-id": input.requestId,
      "x-command-target": targetService,
      "x-command-route-source": route.source,
    };
    if (input.correlationId) {
      headers["x-correlation-id"] = input.correlationId;
    }

    const eventPayload = {
      metadata: {
        commandId,
        commandName: input.commandName,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        targetService,
        targetTopic,
        route: {
          id: route.id,
          tenantId: route.tenant_id,
          environment: route.environment,
          source: route.source,
        },
        initiatedBy: input.initiatedBy ?? undefined,
        // Who released it, for the consumer that writes the override record.
        // `initiatedBy` stays the requester: the operator ran the command, the
        // approver authorised it, and collapsing the two would lose which is
        // which on the one record that has to say.
        approval: input.approvalGrant ?? undefined,
        // The supervisor who authorised this override at the terminal. Read at
        // apply time by the authority gates, which is where the reason code —
        // and therefore the level being cleared — is known. `initiatedBy` stays
        // the operator here too.
        stepUp,
        issuedAt,
        featureStatus,
      },
      payload: input.payload,
    };

    await writer.enqueueOutboxRecord({
      eventId: commandId,
      tenantId: input.tenantId,
      aggregateId: commandId,
      aggregateType: "command",
      eventType: `command.${input.commandName}`,
      payload: eventPayload,
      headers,
      correlationId: input.correlationId,
      // The aggregate this command mutates, so every command touching one
      // reservation or folio applies in order. See partition-key.ts for why
      // this is neither the command id (no ordering) nor the tenant (hot
      // partitions for the largest chains).
      partitionKey: resolveCommandPartitionKey(input.payload, commandId),
      metadata: {
        initiator: input.initiatedBy,
        requestId: input.requestId,
        route: {
          id: route.id,
          source: route.source,
          tenantId: route.tenant_id,
        },
        featureStatus,
      },
    });

    const inserted = await writer.insertCommandDispatch({
      id: commandId,
      commandName: input.commandName,
      tenantId: input.tenantId,
      targetService,
      targetTopic,
      correlationId: input.correlationId,
      requestId: input.requestId,
      payloadHash,
      outboxEventId: commandId,
      routingMetadata: {
        routeId: route.id,
        routeSource: route.source,
        targetTopic,
      },
      initiatedBy: input.initiatedBy ?? null,
      metadata: {
        featureStatus,
      },
    });

    if (!inserted) {
      throw new DuplicateDispatchError();
    }

    return {
      status: "accepted",
      commandId,
      commandName: input.commandName,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      targetService,
      targetTopic,
      issuedAt,
      headers,
      eventPayload,
      featureStatus,
      route: {
        id: route.id,
        source: route.source,
        tenantId: route.tenant_id,
      },
    };
  };

  const acceptCommand = async (
    input: AcceptCommandInput<Membership>,
  ): Promise<CommandAcceptanceOutcome> => {
    const payloadHash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
    const runInTransaction = deps.withDispatchTransaction;

    if (!runInTransaction) {
      return acceptWithin(ambientWriter, input, payloadHash);
    }

    try {
      return await runInTransaction((writer) => acceptWithin(writer, input, payloadHash));
    } catch (error) {
      if (!(error instanceof DuplicateDispatchError)) {
        throw error;
      }
    }

    // The transaction unwound, so the outbox row it staged is gone. The winning
    // request has committed by now, so its dispatch row is the answer.
    const winner = await deps.findCommandDispatchByRequest(
      input.tenantId,
      input.commandName,
      input.requestId,
    );
    if (!winner) {
      throw new CommandDispatchError(
        409,
        "COMMAND_DISPATCH_CONFLICT",
        "Command dispatch conflicted but no existing dispatch could be read.",
      );
    }
    if (winner.payload_hash !== payloadHash) {
      throw new CommandDispatchError(
        409,
        "COMMAND_IDEMPOTENCY_CONFLICT",
        "Request id already used with a different payload.",
      );
    }
    return buildReplayResult(winner, input.payload);
  };

  return {
    acceptCommand,
  };
};
