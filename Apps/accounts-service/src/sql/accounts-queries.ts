export const INVOICE_LIST_SQL = `
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    prop.property_name,
    i.reservation_id,
    r.confirmation_number,
    i.guest_id,
    COALESCE(g.first_name || ' ' || g.last_name, r.guest_name) AS guest_name,
    i.invoice_number,
    i.invoice_type,
    i.invoice_date,
    i.due_date,
    i.subtotal,
    i.tax_amount,
    i.discount_amount,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    i.currency,
    i.status,
    i.sent_at,
    i.pdf_url,
    i.created_at,
    i.updated_at,
    i.version
  FROM public.invoices i
  LEFT JOIN public.reservations r ON i.reservation_id = r.id
  LEFT JOIN public.guests g ON i.guest_id = g.id
  LEFT JOIN public.properties prop ON i.property_id = prop.id
  WHERE COALESCE(i.is_deleted, false) = false
    AND i.deleted_at IS NULL
    AND ($2::uuid IS NULL OR i.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR i.property_id = $3::uuid)
    AND ($4::text IS NULL OR i.status = UPPER($4::text)::invoice_status)
    AND ($5::uuid IS NULL OR i.reservation_id = $5::uuid)
    AND ($6::uuid IS NULL OR i.guest_id = $6::uuid)
  ORDER BY i.invoice_date DESC, i.created_at DESC
  LIMIT $1
  OFFSET $7
`;

export const INVOICE_BY_ID_SQL = `
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    prop.property_name,
    i.reservation_id,
    r.confirmation_number,
    i.guest_id,
    COALESCE(g.first_name || ' ' || g.last_name, r.guest_name) AS guest_name,
    i.invoice_number,
    i.invoice_type,
    i.invoice_date,
    i.due_date,
    i.billing_from,
    i.billing_to,
    i.subtotal,
    i.tax_amount,
    i.discount_amount,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    i.currency,
    i.tax_breakdown,
    i.status,
    i.payment_terms,
    i.payment_instructions,
    i.billing_address,
    i.notes,
    i.footer_text,
    i.pdf_url,
    i.pdf_generated_at,
    i.sent_at,
    i.sent_to,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.created_by,
    i.version
  FROM public.invoices i
  LEFT JOIN public.reservations r ON i.reservation_id = r.id
  LEFT JOIN public.guests g ON i.guest_id = g.id
  LEFT JOIN public.properties prop ON i.property_id = prop.id
  WHERE i.id = $1::uuid
    AND i.tenant_id = $2::uuid
    AND COALESCE(i.is_deleted, false) = false
    AND i.deleted_at IS NULL
`;

export const AR_LIST_SQL = `
  SELECT
    ar.ar_id,
    ar.tenant_id,
    ar.property_id,
    p.property_name,
    ar.ar_number,
    ar.ar_reference,
    ar.account_type,
    ar.account_name,
    ar.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    ar.company_id,
    ar.source_type,
    ar.source_reference,
    ar.reservation_id,
    ar.invoice_id,
    ar.folio_id,
    ar.transaction_date,
    ar.due_date,
    ar.original_amount,
    ar.outstanding_balance,
    ar.paid_amount,
    ar.currency,
    ar.ar_status,
    ar.aging_bucket,
    ar.aging_days,
    ar.is_overdue,
    ar.payment_terms,
    ar.payment_count,
    ar.last_payment_date,
    ar.priority,
    ar.created_at
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  LEFT JOIN public.guests g ON ar.guest_id = g.id
  WHERE ar.tenant_id = $2
    AND ($3::UUID IS NULL OR ar.property_id = $3)
    AND ($4::VARCHAR IS NULL OR ar.ar_status = $4)
    AND ($5::VARCHAR IS NULL OR ar.account_type = $5)
    AND ($6::VARCHAR IS NULL OR ar.aging_bucket = $6)
    AND COALESCE(ar.is_deleted, false) = false
  ORDER BY ar.created_at DESC
  LIMIT $1
  OFFSET $7
`;

export const AR_BY_ID_SQL = `
  SELECT
    ar.ar_id,
    ar.tenant_id,
    ar.property_id,
    p.property_name,
    ar.ar_number,
    ar.ar_reference,
    ar.account_type,
    ar.account_name,
    ar.account_id,
    ar.account_code,
    ar.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    ar.company_id,
    ar.contact_name,
    ar.contact_email,
    ar.contact_phone,
    ar.billing_address,
    ar.source_type,
    ar.source_reference,
    ar.reservation_id,
    ar.invoice_id,
    ar.folio_id,
    ar.transaction_date,
    ar.due_date,
    ar.original_amount,
    ar.outstanding_balance,
    ar.paid_amount,
    ar.currency,
    ar.ar_status,
    ar.aging_bucket,
    ar.aging_days,
    ar.days_overdue,
    ar.is_overdue,
    ar.payment_terms,
    ar.payment_terms_days,
    ar.early_payment_discount_percent,
    ar.early_payment_discount_days,
    ar.discount_deadline,
    ar.late_fee_applicable,
    ar.late_fees_charged,
    ar.interest_applicable,
    ar.interest_accrued,
    ar.payment_count,
    ar.last_payment_date,
    ar.last_payment_amount,
    ar.payments,
    ar.in_collection,
    ar.collection_notes,
    ar.disputed,
    ar.dispute_reason,
    ar.dispute_amount,
    ar.written_off,
    ar.write_off_amount,
    ar.write_off_reason,
    ar.write_off_date,
    ar.is_bad_debt,
    ar.has_payment_plan,
    ar.installment_count,
    ar.next_installment_due_date,
    ar.priority,
    ar.notes,
    ar.internal_notes,
    ar.tags,
    ar.created_at,
    ar.updated_at
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  LEFT JOIN public.guests g ON ar.guest_id = g.id
  WHERE ar.ar_id = $1
    AND ar.tenant_id = $2
    AND COALESCE(ar.is_deleted, false) = false
`;

export const AR_AGING_SUMMARY_SQL = `
  SELECT
    ar.property_id,
    p.property_name,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = 'current' THEN ar.outstanding_balance END), 0) AS current_amount,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '1_30_days' THEN ar.outstanding_balance END), 0) AS days_1_30,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '31_60_days' THEN ar.outstanding_balance END), 0) AS days_31_60,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '61_90_days' THEN ar.outstanding_balance END), 0) AS days_61_90,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = '91_120_days' THEN ar.outstanding_balance END), 0) AS days_91_120,
    COALESCE(SUM(CASE WHEN ar.aging_bucket = 'over_120_days' THEN ar.outstanding_balance END), 0) AS over_120,
    COALESCE(SUM(ar.outstanding_balance), 0) AS total_outstanding,
    COUNT(*) AS total_accounts,
    COALESCE(MIN(ar.currency), 'USD') AS currency
  FROM public.accounts_receivable ar
  LEFT JOIN public.properties p ON ar.property_id = p.id
  WHERE ar.tenant_id = $1
    AND ($2::UUID IS NULL OR ar.property_id = $2)
    AND ar.ar_status IN ('open', 'partial', 'overdue')
    AND COALESCE(ar.is_deleted, false) = false
  GROUP BY ar.property_id, p.property_name
`;
