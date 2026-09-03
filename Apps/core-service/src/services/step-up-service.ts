/**
 * DEV DOC
 * Module: services/step-up-service.ts
 * Purpose: Mint a supervisor's authorisation for one override, at the terminal.
 * Ownership: core-service (owns password verification)
 *
 * This lives in core-service rather than the gateway for one reason: core-service
 * is the only service that holds password hashes, and a second place that
 * verifies a credential is a second place that can get lockout, throttling or
 * MFA subtly wrong. The gateway never sees the supervisor's password — it only
 * ever claims a grant row by id.
 */

import {
  type OverrideStepUpGrantRow,
  STEP_UP_TTL_SECONDS,
  type StepUpRefusalCode,
  stepUpEligibilityRefusal,
} from "@tartware/schemas";

import { insertStepUpGrant } from "../repositories/step-up-repository.js";
import { authenticateUser } from "./auth-service.js";

export type StepUpMintInput = {
  tenantId: string;
  propertyId?: string | null;
  /** The operator asking — from their bearer token, never from the body. */
  requestedBy: string;
  commandName: string;
  entityId?: string | null;
  /** The supervisor's own credentials, entered at the terminal. */
  username: string;
  password: string;
  mfaCode?: string;
};

export type StepUpMintResult =
  | {
      ok: true;
      grant: OverrideStepUpGrantRow;
      supervisorName: string;
    }
  | {
      ok: false;
      status: number;
      code: StepUpRefusalCode | "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "THROTTLED";
      message: string;
      retryAfterMs?: number;
    };

/**
 * Verify a supervisor at the terminal and record their authority for one command.
 *
 * The order of the checks is the policy, and it is the cheap-and-public checks
 * first on purpose — the command's eligibility does not depend on who is
 * standing there, so refusing a dual-control command before any credential is
 * read means a write-off cannot even be *probed* through this endpoint.
 *
 *  1. **Is this command step-uppable at all?** The five dual-control commands
 *     never are. See `override-step-up.ts`.
 *  2. **Are these credentials good?** Delegated whole to `authenticateUser`, so
 *     throttling, account lockout and MFA behave exactly as they do at login and
 *     cannot drift. The access token it returns is deliberately discarded: the
 *     operator is not being given the supervisor's session, which is the entire
 *     difference between this and handing over a login.
 *  3. **Is the supervisor a member of this tenant?** A valid login on another
 *     property is not authority here.
 *  4. **Is the supervisor someone other than the operator?** Otherwise the
 *     record would claim a second authority that never existed — the operator
 *     re-typing their own password proves the terminal is attended, not that
 *     anyone senior agreed.
 *
 * What it deliberately does *not* check is whether the supervisor's role is
 * high enough. That depends on the reason code named in the payload, which this
 * endpoint has not seen and the gateway cannot resolve either; it is decided at
 * apply time by `assertOverrideAuthority`, which is where every other authority
 * question in the product is answered. Minting a grant that turns out to be
 * insufficient is a wasted trip, not a hole.
 */
export const mintStepUpGrant = async (input: StepUpMintInput): Promise<StepUpMintResult> => {
  const ineligible = stepUpEligibilityRefusal(input.commandName);
  if (ineligible) {
    return { ok: false, status: 400, ...ineligible };
  }

  const auth = await authenticateUser({
    username: input.username,
    password: input.password,
    mfaCode: input.mfaCode,
  });

  if (!auth.ok) {
    // The same uniform answer login gives, for the same reason: a step-up prompt
    // that distinguishes "no such user" from "wrong password" is a username
    // oracle sitting on the front desk.
    if (auth.reason === "THROTTLED") {
      return {
        ok: false,
        status: 429,
        code: "THROTTLED",
        message: "Too many attempts. Wait before trying again.",
        retryAfterMs: auth.retryAfterMs,
      };
    }
    if (auth.reason === "ACCOUNT_LOCKED") {
      return {
        ok: false,
        status: 423,
        code: "ACCOUNT_LOCKED",
        message: "That account is locked.",
      };
    }
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Those credentials were not accepted.",
    };
  }

  const supervisor = auth.data.user;
  const membership = auth.data.memberships.find((m) => m.tenant_id === input.tenantId);
  if (!membership) {
    return {
      ok: false,
      status: 403,
      code: "STEP_UP_ROLE_INSUFFICIENT",
      message: "That account has no membership on this tenant.",
    };
  }

  if (supervisor.id === input.requestedBy) {
    return {
      ok: false,
      status: 403,
      code: "STEP_UP_SUPERVISOR_IS_OPERATOR",
      message:
        "A step-up needs a second person. Re-entering your own password proves " +
        "the terminal is attended, not that anyone authorised the override.",
    };
  }

  const grant = await insertStepUpGrant({
    tenantId: input.tenantId,
    propertyId: input.propertyId ?? null,
    commandName: input.commandName,
    entityId: input.entityId ?? null,
    supervisorId: supervisor.id,
    supervisorRole: membership.role,
    requestedBy: input.requestedBy,
    ttlSeconds: STEP_UP_TTL_SECONDS,
  });

  if (!grant) {
    return {
      ok: false,
      status: 500,
      code: "STEP_UP_GRANT_NOT_FOUND",
      message: "The authorisation could not be recorded.",
    };
  }

  return {
    ok: true,
    grant,
    supervisorName:
      [supervisor.first_name, supervisor.last_name].filter(Boolean).join(" ") ||
      supervisor.username,
  };
};
