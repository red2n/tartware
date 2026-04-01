// =====================================================
// CASHIER SESSION QUERIES
// =====================================================

export const CASHIER_SESSION_LIST_SQL = `
  SELECT
    cs.session_id,
    cs.tenant_id,
    cs.property_id,
    p.property_name,
    cs.session_number,
    cs.session_name,
    cs.cashier_id,
    cs.cashier_name,
    cs.terminal_id,
    cs.terminal_name,
    cs.location,
    cs.session_status,
    cs.opened_at,
    cs.closed_at,
    cs.business_date,
    cs.shift_type,
    cs.opening_float_declared,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.expected_cash_balance,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.has_variance,
    cs.reconciled,
    cs.approved,
    cs.created_at
  FROM public.cashier_sessions cs
  LEFT JOIN public.properties p ON cs.property_id = p.id
  WHERE COALESCE(cs.is_deleted, false) = false
    AND cs.deleted_at IS NULL
    AND ($2::uuid IS NULL OR cs.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR cs.property_id = $3::uuid)
    AND ($4::text IS NULL OR cs.session_status = LOWER($4::text))
    AND ($5::text IS NULL OR cs.shift_type = LOWER($5::text))
    AND ($6::date IS NULL OR cs.business_date = $6::date)
  ORDER BY cs.opened_at DESC
  LIMIT $1
  OFFSET $7
`;

export const CASHIER_SESSION_BY_ID_SQL = `
  SELECT
    cs.session_id,
    cs.tenant_id,
    cs.property_id,
    p.property_name,
    cs.session_number,
    cs.session_name,
    cs.cashier_id,
    cs.cashier_name,
    cs.terminal_id,
    cs.terminal_name,
    cs.location,
    cs.session_status,
    cs.opened_at,
    cs.closed_at,
    cs.business_date,
    cs.shift_type,
    cs.opening_float_declared,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.expected_cash_balance,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.has_variance,
    cs.reconciled,
    cs.approved,
    cs.created_at
  FROM public.cashier_sessions cs
  LEFT JOIN public.properties p ON cs.property_id = p.id
  WHERE cs.session_id = $1::uuid
    AND cs.tenant_id = $2::uuid
    AND COALESCE(cs.is_deleted, false) = false
    AND cs.deleted_at IS NULL
`;

// =====================================================
// SHIFT HANDOVER / SUMMARY QUERIES
// =====================================================

/**
 * Aggregate transaction totals for a single cashier session.
 * $1 = session_id, $2 = tenant_id
 */
export const SHIFT_SUMMARY_SQL = `
  SELECT
    cs.session_id,
    cs.session_number,
    cs.cashier_name,
    cs.terminal_id,
    cs.shift_type,
    cs.session_status,
    cs.business_date,
    cs.opened_at,
    cs.closed_at,
    cs.opening_float_declared,
    cs.closing_cash_counted,
    cs.cash_variance,
    cs.total_transactions,
    cs.total_revenue,
    cs.total_refunds,
    cs.net_revenue,
    cs.has_variance,
    cs.reconciled,
    cs.metadata,
    COALESCE(
      (SELECT COUNT(*) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'CHARGE'
         AND cp.voided = false), 0
    )::int AS charge_count,
    COALESCE(
      (SELECT SUM(cp.total_amount) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'CHARGE'
         AND cp.voided = false), 0
    ) AS charge_total,
    COALESCE(
      (SELECT COUNT(*) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'PAYMENT'
         AND cp.voided = false), 0
    )::int AS payment_count,
    COALESCE(
      (SELECT SUM(ABS(cp.total_amount)) FROM charge_postings cp
       WHERE cp.tenant_id = cs.tenant_id
         AND cp.property_id = cs.property_id
         AND cp.business_date = cs.business_date
         AND cp.posting_type = 'PAYMENT'
         AND cp.voided = false), 0
    ) AS payment_total
  FROM cashier_sessions cs
  WHERE cs.session_id = $1::uuid
    AND cs.tenant_id = $2::uuid
    AND COALESCE(cs.is_deleted, false) = false
`;
