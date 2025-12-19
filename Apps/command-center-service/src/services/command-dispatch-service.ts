import { randomUUID } from "node:crypto";

type Initiator = {
  userId: string;
  role: string;
} | null;

export type AcceptCommandInput = {
  commandName: string;
  tenantId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  requestId: string;
  initiatedBy: Initiator;
};

export type AcceptedCommand = {
  status: "accepted";
  commandId: string;
  commandName: string;
  tenantId: string;
  correlationId?: string;
  targetService: string | null;
  requestedAt: string;
};

/**
 * Placeholder implementation that will eventually enqueue the command
 * into the transactional outbox. For now it returns the metadata so
 * clients can begin integration.
 */
export const acceptCommand = async (
  input: AcceptCommandInput,
): Promise<AcceptedCommand> => {
  const commandId = randomUUID();

  // TODO: persist command + enqueue in transactional outbox
  void input;

  return {
    status: "accepted",
    commandId,
    commandName: input.commandName,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    targetService: null,
    requestedAt: new Date().toISOString(),
  };
};
