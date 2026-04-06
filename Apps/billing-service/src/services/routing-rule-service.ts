/**
 * DEV DOC
 * Module: services/routing-rule-service.ts
 * Purpose: Evaluate folio routing rules to determine how a charge should be
 *          distributed across folios. Called by the charge posting pipeline.
 * Ownership: billing-service
 *
 * Algorithm:
 *   1. Fetch active, non-template rules for the source folio ordered by priority ASC.
 *   2. For each rule, check criteria (charge code pattern, category, amount window, date window).
 *   3. If criteria match, calculate the routed amount based on routing_type.
 *   4. Accumulate decisions; if stop_on_match is true, stop iterating.
 *   5. Return the list of decisions and the remainder amount for the source folio.
 */

import type {
  EvaluateRoutingInput,
  RoutingDecision,
  RoutingEvaluationResult,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { roundMoney, toCents } from "../utils/money.js";

/* ── DB row shape (internal, single-file only) ── */
type RuleRow = {
  rule_id: string;
  destination_folio_id: string;
  charge_code_pattern: string | null;
  transaction_type: string | null;
  charge_category: string | null;
  min_amount: string | null;
  max_amount: string | null;
  routing_type: string;
  routing_percentage: string | null;
  routing_fixed_amount: string | null;
  stop_on_match: boolean;
  effective_from: string | null;
  effective_until: string | null;
};

const FETCH_ACTIVE_RULES_SQL = `
  SELECT
    rule_id,
    destination_folio_id,
    charge_code_pattern,
    transaction_type,
    charge_category,
    min_amount,
    max_amount,
    routing_type,
    routing_percentage,
    routing_fixed_amount,
    stop_on_match,
    effective_from,
    effective_until
  FROM public.folio_routing_rules
  WHERE tenant_id = $1::uuid
    AND source_folio_id = $2::uuid
    AND is_template = FALSE
    AND is_active = TRUE
    AND COALESCE(is_deleted, false) = false
  ORDER BY priority ASC, created_at ASC
`;

/**
 * Evaluate all active routing rules for a given source folio and charge.
 * Returns an empty decisions array when no rules match (caller posts normally).
 */
export async function evaluateRoutingRules(
  input: EvaluateRoutingInput,
): Promise<RoutingEvaluationResult> {
  const { rows } = await query<RuleRow>(FETCH_ACTIVE_RULES_SQL, [input.tenantId, input.folioId]);

  if (rows.length === 0) {
    return { decisions: [], remainderAmount: input.amount };
  }

  const today = new Date();
  const decisions: RoutingDecision[] = [];
  let remainingCents = toCents(input.amount);

  for (const rule of rows) {
    if (remainingCents <= 0) break;

    if (!matchesCriteria(rule, input, today)) continue;

    const routedCents = calculateRoutedCents(rule, remainingCents, input.amount);
    if (routedCents <= 0) continue;

    decisions.push({
      destinationFolioId: rule.destination_folio_id,
      routedAmount: roundMoney(routedCents / 100),
      ruleId: rule.rule_id,
    });

    remainingCents -= routedCents;

    if (rule.stop_on_match) break;
  }

  const result: RoutingEvaluationResult = {
    decisions,
    remainderAmount: roundMoney(remainingCents / 100),
  };

  if (decisions.length > 0) {
    appLogger.info(
      {
        folioId: input.folioId,
        chargeCode: input.chargeCode,
        amount: input.amount,
        rulesMatched: decisions.length,
        remainder: result.remainderAmount,
      },
      "Routing rules evaluated for charge",
    );
  }

  return result;
}

/* ── Criteria matching ── */

function matchesCriteria(rule: RuleRow, input: EvaluateRoutingInput, today: Date): boolean {
  // Effective date window
  if (rule.effective_from) {
    const from = new Date(rule.effective_from);
    if (today < from) return false;
  }
  if (rule.effective_until) {
    const until = new Date(rule.effective_until);
    if (today > until) return false;
  }

  // Charge category
  if (rule.charge_category && input.chargeCategory) {
    if (rule.charge_category.toUpperCase() !== input.chargeCategory.toUpperCase()) {
      return false;
    }
  } else if (rule.charge_category && !input.chargeCategory) {
    // Rule requires a specific category but charge has none — no match
    return false;
  }

  // Transaction type
  if (rule.transaction_type && input.transactionType) {
    if (rule.transaction_type.toUpperCase() !== input.transactionType.toUpperCase()) {
      return false;
    }
  } else if (rule.transaction_type && !input.transactionType) {
    return false;
  }

  // Charge code pattern matching
  if (rule.charge_code_pattern) {
    if (!matchesChargeCodePattern(rule.charge_code_pattern, input.chargeCode)) {
      return false;
    }
  }

  // Amount window
  if (rule.min_amount !== null) {
    const min = Number(rule.min_amount);
    if (input.amount < min) return false;
  }
  if (rule.max_amount !== null) {
    const max = Number(rule.max_amount);
    if (input.amount > max) return false;
  }

  return true;
}

/**
 * Match charge code against pattern.
 * Supports:
 *   - Exact match: "ROOM"
 *   - Wildcard suffix: "F&B*" (matches "F&B", "F&B-LUNCH", etc.)
 *   - CSV list: "ROOM,SPA,MINIBAR"
 */
function matchesChargeCodePattern(pattern: string, chargeCode: string): boolean {
  const code = chargeCode.toUpperCase();

  // CSV list
  if (pattern.includes(",")) {
    const codes = pattern.split(",").map((s) => s.trim().toUpperCase());
    return codes.includes(code);
  }

  const p = pattern.toUpperCase();

  // Wildcard suffix
  if (p.endsWith("*")) {
    const prefix = p.slice(0, -1);
    return code.startsWith(prefix);
  }

  // Exact match
  return code === p;
}

/* ── Amount calculation ── */

function calculateRoutedCents(
  rule: RuleRow,
  remainingCents: number,
  originalAmount: number,
): number {
  switch (rule.routing_type) {
    case "FULL":
      return remainingCents;

    case "PERCENTAGE": {
      const pct = Number(rule.routing_percentage ?? 0);
      if (pct <= 0 || pct > 100) return 0;
      // Percentage is applied to original amount, not remaining
      const calculated = Math.round(toCents(originalAmount) * (pct / 100));
      return Math.min(calculated, remainingCents);
    }

    case "FIXED_AMOUNT": {
      const fixed = toCents(Number(rule.routing_fixed_amount ?? 0));
      if (fixed <= 0) return 0;
      return Math.min(fixed, remainingCents);
    }

    case "REMAINDER":
      return remainingCents;

    default:
      return 0;
  }
}
