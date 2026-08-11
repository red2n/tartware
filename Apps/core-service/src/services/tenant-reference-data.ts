import type { PoolClient } from "pg";

/**
 * Reference data seeding for newly bootstrapped tenants.
 *
 * The canonical charge codes, GL mappings and market segments only exist in the
 * SQL reference-data seed, hardcoded to the seed tenant. Tenants created through
 * the bootstrap API therefore started life with none of it, which surfaced as
 * "Missing charge_code_gl_mapping — GL pair will be skipped for this posting"
 * on every posting for those tenants: their GL batches silently lost the
 * double-entry pairs.
 *
 * Rather than duplicating the canonical rows in TypeScript (which would drift
 * from the .sql seed), a new tenant copies them from a template tenant.
 */

/** Tenant whose reference data is cloned into every newly bootstrapped tenant. */
export const REFERENCE_DATA_TEMPLATE_TENANT_ID =
  process.env.REFERENCE_DATA_TEMPLATE_TENANT_ID ?? "11111111-1111-1111-1111-111111111111";

/**
 * These tables are under FORCE ROW LEVEL SECURITY keyed on
 * app.current_tenant_id, so the template's rows are invisible while the
 * bootstrap transaction is scoped to the new tenant. Each copy therefore
 * switches the tenant context to read, then switches back to write.
 *
 * set_config(..., true) is transaction-local, so both switches unwind with the
 * surrounding transaction.
 */
const withTenantScope = async <T>(
  client: PoolClient,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> => {
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
  return await fn();
};

export interface ReferenceDataSeedResult {
  chargeCodes: number;
  glMappings: number;
  marketSegments: number;
}

/**
 * Copy tenant-scoped reference data from the template tenant into a new tenant.
 *
 * Must be called inside the bootstrap transaction, after the tenant and its
 * first property exist. Restores the tenant context to `newTenantId` before
 * returning so the caller can continue writing as the new tenant.
 *
 * Statistics columns on market_segments (total_bookings, total_revenue, …) are
 * deliberately not copied — those accumulate per tenant and must start at zero.
 */
export const copyReferenceDataForTenant = async (
  client: PoolClient,
  params: {
    newTenantId: string;
    newPropertyId: string;
    actorId: string;
    templateTenantId?: string;
  },
): Promise<ReferenceDataSeedResult> => {
  const templateTenantId = params.templateTenantId ?? REFERENCE_DATA_TEMPLATE_TENANT_ID;
  const { newTenantId, newPropertyId, actorId } = params;

  // A tenant cloning itself would be a no-op at best and a duplicate-key error
  // at worst.
  if (templateTenantId === newTenantId) {
    return { chargeCodes: 0, glMappings: 0, marketSegments: 0 };
  }

  const source = await withTenantScope(client, templateTenantId, async () => {
    const chargeCodes = await client.query(
      `SELECT code, description, department_code, department_name, revenue_group,
              is_taxable, is_active, display_order
         FROM charge_codes
        WHERE tenant_id = $1::uuid
          AND COALESCE(is_deleted, false) = false`,
      [templateTenantId],
    );

    const glMappings = await client.query(
      `SELECT charge_code, debit_account, credit_account, usali_category,
              department_code, is_active
         FROM charge_code_gl_mapping
        WHERE tenant_id = $1::uuid
          AND COALESCE(is_deleted, false) = false`,
      [templateTenantId],
    );

    const marketSegments = await client.query(
      `SELECT segment_code, segment_name, segment_type, is_active, is_bookable,
              segment_level, rate_multiplier, discount_percentage, premium_percentage,
              pays_commission, commission_percentage, marketing_priority,
              is_target_segment, description, color_code, icon, ranking,
              requires_approval, tax_exempt, notes
         FROM market_segments
        WHERE tenant_id = $1::uuid
          AND COALESCE(is_deleted, false) = false`,
      [templateTenantId],
    );

    return {
      chargeCodes: chargeCodes.rows,
      glMappings: glMappings.rows,
      marketSegments: marketSegments.rows,
    };
  });

  return await withTenantScope(client, newTenantId, async () => {
    for (const row of source.chargeCodes) {
      await client.query(
        `INSERT INTO charge_codes
           (tenant_id, code, description, department_code, department_name,
            revenue_group, is_taxable, is_active, display_order)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        [
          newTenantId,
          row.code,
          row.description,
          row.department_code,
          row.department_name,
          row.revenue_group,
          row.is_taxable,
          row.is_active,
          row.display_order,
        ],
      );
    }

    for (const row of source.glMappings) {
      await client.query(
        `INSERT INTO charge_code_gl_mapping
           (tenant_id, charge_code, debit_account, credit_account,
            usali_category, department_code, is_active, created_by, updated_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, $8::uuid)
         ON CONFLICT DO NOTHING`,
        [
          newTenantId,
          row.charge_code,
          row.debit_account,
          row.credit_account,
          row.usali_category,
          row.department_code,
          row.is_active,
          actorId,
        ],
      );
    }

    for (const row of source.marketSegments) {
      // property_id is remapped to the tenant's own first property; copying the
      // template's would point the segment at another tenant's property.
      await client.query(
        `INSERT INTO market_segments
           (tenant_id, property_id, segment_code, segment_name, segment_type,
            is_active, is_bookable, segment_level, rate_multiplier,
            discount_percentage, premium_percentage, pays_commission,
            commission_percentage, marketing_priority, is_target_segment,
            description, color_code, icon, ranking, requires_approval,
            tax_exempt, notes, created_by, updated_by)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::uuid, $23::uuid)
         ON CONFLICT DO NOTHING`,
        [
          newTenantId,
          newPropertyId,
          row.segment_code,
          row.segment_name,
          row.segment_type,
          row.is_active,
          row.is_bookable,
          row.segment_level,
          row.rate_multiplier,
          row.discount_percentage,
          row.premium_percentage,
          row.pays_commission,
          row.commission_percentage,
          row.marketing_priority,
          row.is_target_segment,
          row.description,
          row.color_code,
          row.icon,
          row.ranking,
          row.requires_approval,
          row.tax_exempt,
          row.notes,
          actorId,
        ],
      );
    }

    return {
      chargeCodes: source.chargeCodes.length,
      glMappings: source.glMappings.length,
      marketSegments: source.marketSegments.length,
    };
  });
};
