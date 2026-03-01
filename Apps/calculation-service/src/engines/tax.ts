/**
 * DEV DOC
 * Module: engines/tax.ts
 * Purpose: Tax calculation formulas from CORE.md §1.
 * Ownership: calculation-service
 *
 * All monetary arithmetic uses Decimal.js to avoid floating-point errors.
 * Formulas: taxableAmount, reverseTax, inclusiveTaxExtract, bulkTax.
 */

import type {
  BulkTaxInput,
  BulkTaxOutput,
  InclusiveTaxExtractInput,
  InclusiveTaxExtractOutput,
  ReverseTaxInput,
  ReverseTaxOutput,
  TaxableAmountInput,
  TaxableAmountOutput,
} from "@tartware/schemas";
import Decimal from "decimal.js";

/**
 * Calculates taxable amount from unit price and quantity.
 * CORE.md §1.1: taxableAmount = amount × quantity (negated if refund).
 */
export function calculateTaxableAmount(input: TaxableAmountInput): TaxableAmountOutput {
  const base = new Decimal(input.amount).times(input.quantity);
  const result = input.negate ? base.negated() : base;
  return {
    taxable_amount: result.toDecimalPlaces(2).toNumber(),
    negated: input.negate,
    formula: `${input.amount} × ${input.quantity}${input.negate ? " (negated)" : ""} = ${result.toDecimalPlaces(2)}`,
  };
}

/**
 * Reverses tax to find a per-unit amount from total taxable.
 * CORE.md §1.2: unitAmount = taxableAmount / quantity.
 */
export function calculateReverseTax(input: ReverseTaxInput): ReverseTaxOutput {
  const unitAmount = new Decimal(input.taxable_amount).div(input.quantity);
  const afterExemption = unitAmount.minus(input.exempted_tax_amount);
  return {
    unit_amount: unitAmount.toDecimalPlaces(2).toNumber(),
    unit_amount_after_exemption: Decimal.max(afterExemption, 0).toDecimalPlaces(2).toNumber(),
    formula: `${input.taxable_amount} / ${input.quantity} = ${unitAmount.toDecimalPlaces(2)}; after exemption: ${afterExemption.toDecimalPlaces(2)}`,
  };
}

/**
 * Extracts inclusive taxes from a gross amount.
 * CORE.md §1.3+: Handles both simple and compound tax rules.
 * Simple: net = gross / (1 + sumOfRates); each tax = net × rate.
 * Compound: applied in order; each compound tax is on (net + prior taxes).
 */
export function extractInclusiveTax(input: InclusiveTaxExtractInput): InclusiveTaxExtractOutput {
  const gross = new Decimal(input.gross_amount);
  const sortedRules = [...input.tax_rules].sort(
    (a, b) => (a.compound_order ?? 0) - (b.compound_order ?? 0),
  );

  const hasCompound = sortedRules.some((r) => r.is_compound);

  if (!hasCompound) {
    const totalRate = sortedRules.reduce(
      (acc, r) => acc.plus(new Decimal(r.rate).div(100)),
      new Decimal(0),
    );
    const net = gross.div(totalRate.plus(1));
    const taxes = sortedRules.map((r) => {
      const taxAmt = net.times(new Decimal(r.rate).div(100));
      return { code: r.code, amount: taxAmt.toDecimalPlaces(2).toNumber() };
    });
    const totalTax = taxes.reduce((s, t) => s.plus(t.amount), new Decimal(0));
    return {
      net_amount: net.toDecimalPlaces(2).toNumber(),
      taxes,
      total_tax: totalTax.toDecimalPlaces(2).toNumber(),
      formula: `net = ${gross} / (1 + ${totalRate}) = ${net.toDecimalPlaces(2)}`,
    };
  }

  // Compound: iterative back-calculation
  const simpleRules = sortedRules.filter((r) => !r.is_compound);
  const compoundRules = sortedRules.filter((r) => r.is_compound);

  let remaining = gross;
  const taxes: { code: string; amount: number }[] = [];

  // Remove compound taxes in reverse order
  for (const rule of [...compoundRules].reverse()) {
    const rate = new Decimal(rule.rate).div(100);
    const taxAmt = remaining.times(rate).div(rate.plus(1));
    taxes.unshift({ code: rule.code, amount: taxAmt.toDecimalPlaces(2).toNumber() });
    remaining = remaining.minus(taxAmt);
  }

  // Remove simple taxes from remaining
  const simpleRate = simpleRules.reduce(
    (acc, r) => acc.plus(new Decimal(r.rate).div(100)),
    new Decimal(0),
  );
  const net = remaining.div(simpleRate.plus(1));

  for (const rule of simpleRules) {
    const taxAmt = net.times(new Decimal(rule.rate).div(100));
    taxes.push({ code: rule.code, amount: taxAmt.toDecimalPlaces(2).toNumber() });
  }

  const totalTax = taxes.reduce((s, t) => s.plus(t.amount), new Decimal(0));
  return {
    net_amount: net.toDecimalPlaces(2).toNumber(),
    taxes,
    total_tax: totalTax.toDecimalPlaces(2).toNumber(),
    formula: `compound back-calculation from gross ${gross}`,
  };
}

/**
 * Bulk tax calculation across multiple line items.
 * CORE.md §1.4: Applies tax rules to each line item.
 */
export function calculateBulkTax(input: BulkTaxInput): BulkTaxOutput {
  let grandTotal = new Decimal(0);
  let totalTax = new Decimal(0);

  const lineItems = input.line_items.map((item) => {
    const subtotal = new Decimal(item.amount).times(item.quantity);
    const taxes = input.tax_rules.map((rule) => {
      const taxAmt = subtotal.times(new Decimal(rule.rate).div(100));
      return { code: rule.code, amount: taxAmt.toDecimalPlaces(2).toNumber() };
    });
    const lineTax = taxes.reduce((s, t) => s.plus(t.amount), new Decimal(0));
    const lineTotal = subtotal.plus(lineTax);
    grandTotal = grandTotal.plus(lineTotal);
    totalTax = totalTax.plus(lineTax);
    return {
      charge_code: item.charge_code,
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      taxes,
      total: lineTotal.toDecimalPlaces(2).toNumber(),
    };
  });

  return {
    line_items: lineItems,
    grand_total: grandTotal.toDecimalPlaces(2).toNumber(),
    total_tax: totalTax.toDecimalPlaces(2).toNumber(),
  };
}
