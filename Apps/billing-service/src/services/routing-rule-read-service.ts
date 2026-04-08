import type { RoutingRuleListItem } from "@tartware/schemas";

import { query } from "../lib/db.js";

const ROUTING_RULE_LIST_SQL = `
  SELECT
    rule_id,
    tenant_id,
    property_id,
    rule_name,
    rule_code,
    description,
    is_template,
    template_id,
    source_folio_id,
    source_reservation_id,
    destination_folio_id,
    destination_folio_type,
    charge_code_pattern,
    transaction_type,
    charge_category,
    min_amount,
    max_amount,
    routing_type,
    routing_percentage,
    routing_fixed_amount,
    priority,
    stop_on_match,
    effective_from::text AS effective_from,
    effective_until::text AS effective_until,
    auto_apply_to_group,
    auto_apply_to_company,
    company_id,
    group_booking_id,
    is_active,
    created_at::text AS created_at,
    updated_at::text AS updated_at
  FROM public.folio_routing_rules
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
`;

export const listRoutingRules = async (params: {
  tenantId: string;
  propertyId?: string;
  folioId?: string;
  isTemplate?: boolean;
  isActive?: boolean;
  chargeCategory?: string;
  limit: number;
  offset: number;
}): Promise<RoutingRuleListItem[]> => {
  const conditions: string[] = [];
  const values: unknown[] = [params.tenantId];
  let idx = 2;

  if (params.propertyId) {
    conditions.push(`AND property_id = $${idx}::uuid`);
    values.push(params.propertyId);
    idx++;
  }

  if (params.folioId) {
    conditions.push(`AND source_folio_id = $${idx}::uuid`);
    values.push(params.folioId);
    idx++;
  }

  if (params.isTemplate !== undefined) {
    conditions.push(`AND is_template = $${idx}`);
    values.push(params.isTemplate);
    idx++;
  }

  if (params.isActive !== undefined) {
    conditions.push(`AND is_active = $${idx}`);
    values.push(params.isActive);
    idx++;
  }

  if (params.chargeCategory) {
    conditions.push(`AND charge_category = $${idx}`);
    values.push(params.chargeCategory);
    idx++;
  }

  conditions.push(`ORDER BY priority ASC, created_at DESC`);
  conditions.push(`LIMIT $${idx} OFFSET $${idx + 1}`);
  values.push(params.limit, params.offset);

  const sql = `${ROUTING_RULE_LIST_SQL} ${conditions.join(" ")}`;
  const { rows } = await query(sql, values);
  return rows as RoutingRuleListItem[];
};

export const getRoutingRuleById = async (
  ruleId: string,
  tenantId: string,
): Promise<RoutingRuleListItem | null> => {
  const { rows } = await query(`${ROUTING_RULE_LIST_SQL} AND rule_id = $2::uuid`, [
    tenantId,
    ruleId,
  ]);
  return (rows[0] as RoutingRuleListItem) ?? null;
};
