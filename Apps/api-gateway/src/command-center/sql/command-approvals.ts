import { createCommandApprovalRepository } from "@tartware/command-center-shared";

import { query } from "../../lib/db.js";

export const {
  claimCommandApproval,
  findCommandApproval,
  listPendingCommandApprovals,
  raiseCommandApproval,
  recordApprovalDispatch,
  rejectCommandApproval,
  releaseCommandApproval,
} = createCommandApprovalRepository(query);
