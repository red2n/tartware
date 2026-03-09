import type { CommandMetadata } from "@tartware/command-consumer-utils";

import { evaluateGroupBlock } from "../../services/group-evaluate-service.js";

/** R19: Evaluate a group block — full displacement analysis with recommendation. */
export const handleGroupEvaluate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ evaluation: unknown }> => {
  const p = payload as { property_id: string; group_id: string };
  return evaluateGroupBlock({
    tenantId: metadata.tenantId,
    propertyId: p.property_id,
    groupId: p.group_id,
    actorId: actorId ?? "system",
  });
};
