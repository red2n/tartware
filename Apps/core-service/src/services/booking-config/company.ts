import {
  type CompanyListItem,
  CompanyListItemSchema,
  type CompanyRow,
  type GetCompanyInput,
  type ListCompaniesInput,
} from "@tartware/schemas";

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
