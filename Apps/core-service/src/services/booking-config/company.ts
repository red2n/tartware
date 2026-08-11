import {
  type CompanyListItem,
  CompanyListItemSchema,
  type CompanyRow,
  type GetCompanyInput,
  type ListCompaniesInput,
} from "@tartware/schemas";

import type { CompanyWriteInput } from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { COMPANY_BY_ID_SQL, COMPANY_LIST_SQL } from "../../sql/booking-config/company.js";

import { formatDisplayLabel, toIsoString, toNumber } from "./common.js";

// =====================================================
// COMPANY SERVICE
// =====================================================

const mapCompanyRow = (row: CompanyRow): CompanyListItem => {
  return CompanyListItemSchema.parse({
    company_id: row.company_id,
    tenant_id: row.tenant_id,
    company_name: row.company_name,
    legal_name: row.legal_name,
    company_code: row.company_code,
    company_type: row.company_type?.toLowerCase() ?? "corporate",
    company_type_display: formatDisplayLabel(row.company_type),
    primary_contact_name: row.primary_contact_name,
    primary_contact_email: row.primary_contact_email,
    primary_contact_phone: row.primary_contact_phone,
    billing_contact_name: row.billing_contact_name,
    billing_contact_email: row.billing_contact_email,
    city: row.city,
    state_province: row.state_province,
    country: row.country,
    credit_limit: toNumber(row.credit_limit) ?? 0,
    current_balance: toNumber(row.current_balance) ?? 0,
    payment_terms: row.payment_terms ?? 30,
    payment_terms_type: row.payment_terms_type ?? "net_30",
    credit_status: row.credit_status?.toLowerCase() ?? "active",
    credit_status_display: formatDisplayLabel(row.credit_status),
    commission_rate: toNumber(row.commission_rate) ?? 0,
    commission_type: row.commission_type,
    preferred_rate_code: row.preferred_rate_code,
    discount_percentage: toNumber(row.discount_percentage) ?? 0,
    tax_id: row.tax_id,
    tax_exempt: Boolean(row.tax_exempt),
    contract_number: row.contract_number,
    contract_start_date: row.contract_start_date
      ? (toIsoString(row.contract_start_date) ?? "").split("T")[0]
      : null,
    contract_end_date: row.contract_end_date
      ? (toIsoString(row.contract_end_date) ?? "").split("T")[0]
      : null,
    contract_status: row.contract_status,
    iata_number: row.iata_number,
    arc_number: row.arc_number,
    total_bookings: row.total_bookings ?? 0,
    total_revenue: toNumber(row.total_revenue) ?? 0,
    average_booking_value: toNumber(row.average_booking_value),
    last_booking_date: row.last_booking_date
      ? (toIsoString(row.last_booking_date) ?? "").split("T")[0]
      : null,
    is_active: Boolean(row.is_active),
    is_vip: Boolean(row.is_vip),
    is_blacklisted: Boolean(row.is_blacklisted),
    requires_approval: Boolean(row.requires_approval),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export const listCompanies = async (options: ListCompaniesInput): Promise<CompanyListItem[]> => {
  const { rows } = await query<CompanyRow>(COMPANY_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.companyType ?? null,
    options.isActive ?? null,
    options.creditStatus ?? null,
    options.isBlacklisted ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapCompanyRow);
};

export const getCompanyById = async (options: GetCompanyInput): Promise<CompanyListItem | null> => {
  const { rows } = await query<CompanyRow>(COMPANY_BY_ID_SQL, [
    options.companyId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapCompanyRow(row);
};


/**
 * Create a company.
 *
 * `/v1/companies` was read-only, which made COV-03's AR account management
 * unusable: `ar.account.create` requires a `company_id` and nothing could mint
 * one. Per ui-gaps/18-write-path-gap.md this is a single-service, single-table
 * write with no fan-out, so it is plain HTTP rather than a command.
 */
export const createCompany = async (
  tenantId: string,
  input: CompanyWriteInput,
  actorId?: string,
): Promise<CompanyListItem | null> => {
  const { rows } = await query<{ company_id: string }>(
    `
      INSERT INTO public.companies (
        tenant_id, company_name, company_type, legal_name, company_code,
        primary_contact_name, primary_contact_email, primary_contact_phone,
        billing_contact_name, billing_contact_email,
        address_line1, city, state_province, postal_code, country,
        credit_limit, payment_terms_type, credit_status,
        commission_rate, commission_type,
        is_active, created_by, updated_by
      ) VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, COALESCE($18, 'pending'),
        $19, $20,
        COALESCE($21, true), $22, $22
      )
      RETURNING company_id
    `,
    [
      tenantId,
      input.companyName,
      input.companyType,
      input.legalName ?? null,
      input.companyCode ?? null,
      input.primaryContactName ?? null,
      input.primaryContactEmail ?? null,
      input.primaryContactPhone ?? null,
      input.billingContactName ?? null,
      input.billingContactEmail ?? null,
      input.addressLine1 ?? null,
      input.city ?? null,
      input.stateProvince ?? null,
      input.postalCode ?? null,
      input.country ?? null,
      input.creditLimit ?? null,
      input.paymentTermsType ?? null,
      input.creditStatus ?? null,
      input.commissionRate ?? null,
      input.commissionType ?? null,
      input.isActive ?? null,
      actorId ?? null,
    ],
  );

  const companyId = rows[0]?.company_id;
  if (!companyId) return null;
  return getCompanyById({ companyId, tenantId });
};

/**
 * Update a company. Every field is optional and COALESCE keeps the stored value,
 * so a screen can send only what changed.
 */
export const updateCompany = async (
  tenantId: string,
  companyId: string,
  input: Partial<CompanyWriteInput>,
  actorId?: string,
): Promise<CompanyListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.companies
      SET
        company_name = COALESCE($3, company_name),
        company_type = COALESCE($4, company_type),
        legal_name = COALESCE($5, legal_name),
        company_code = COALESCE($6, company_code),
        primary_contact_name = COALESCE($7, primary_contact_name),
        primary_contact_email = COALESCE($8, primary_contact_email),
        primary_contact_phone = COALESCE($9, primary_contact_phone),
        billing_contact_name = COALESCE($10, billing_contact_name),
        billing_contact_email = COALESCE($11, billing_contact_email),
        address_line1 = COALESCE($12, address_line1),
        city = COALESCE($13, city),
        state_province = COALESCE($14, state_province),
        postal_code = COALESCE($15, postal_code),
        country = COALESCE($16, country),
        credit_limit = COALESCE($17, credit_limit),
        payment_terms_type = COALESCE($18, payment_terms_type),
        credit_status = COALESCE($19, credit_status),
        commission_rate = COALESCE($20, commission_rate),
        commission_type = COALESCE($21, commission_type),
        is_active = COALESCE($22, is_active),
        updated_at = NOW(),
        updated_by = $23
      WHERE tenant_id = $1::uuid
        AND company_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      companyId,
      input.companyName ?? null,
      input.companyType ?? null,
      input.legalName ?? null,
      input.companyCode ?? null,
      input.primaryContactName ?? null,
      input.primaryContactEmail ?? null,
      input.primaryContactPhone ?? null,
      input.billingContactName ?? null,
      input.billingContactEmail ?? null,
      input.addressLine1 ?? null,
      input.city ?? null,
      input.stateProvince ?? null,
      input.postalCode ?? null,
      input.country ?? null,
      input.creditLimit ?? null,
      input.paymentTermsType ?? null,
      input.creditStatus ?? null,
      input.commissionRate ?? null,
      input.commissionType ?? null,
      input.isActive ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;
  return getCompanyById({ companyId, tenantId });
};
