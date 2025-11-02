-- =====================================================
-- Indexes for minibar_consumption table
-- =====================================================

\c tartware

\echo 'Creating indexes for minibar_consumption...'

-- Primary lookup indexes
CREATE INDEX idx_minibar_consumption_tenant_property ON minibar_consumption(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_reservation ON minibar_consumption(reservation_id, consumption_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_guest ON minibar_consumption(guest_id, consumption_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_room ON minibar_consumption(room_id, consumption_date) WHERE is_deleted = FALSE;

-- Item tracking
CREATE INDEX idx_minibar_consumption_item ON minibar_consumption(item_id, consumption_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_item_code ON minibar_consumption(item_code, property_id, consumption_date) WHERE is_deleted = FALSE;

-- Date-based indexes
CREATE INDEX idx_minibar_consumption_date ON minibar_consumption(property_id, consumption_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_timestamp ON minibar_consumption(property_id, consumption_timestamp) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_today ON minibar_consumption(property_id, room_number) WHERE is_deleted = FALSE AND consumption_date IS NOT NULL;

-- Posting status indexes
CREATE INDEX idx_minibar_consumption_pending ON minibar_consumption(property_id, posting_status) WHERE is_deleted = FALSE AND posting_status = 'PENDING';
CREATE INDEX idx_minibar_consumption_failed ON minibar_consumption(property_id, posting_status) WHERE is_deleted = FALSE AND posting_status = 'FAILED';
CREATE INDEX idx_minibar_consumption_folio_pending ON minibar_consumption(property_id, posted_to_folio, consumption_date) WHERE is_deleted = FALSE AND posted_to_folio = FALSE;

-- Folio linkage
CREATE INDEX idx_minibar_consumption_folio ON minibar_consumption(folio_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_folio_txn ON minibar_consumption(folio_transaction_id) WHERE is_deleted = FALSE;

-- Detection method indexes
CREATE INDEX idx_minibar_consumption_detection ON minibar_consumption(property_id, detection_method, consumption_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_detector ON minibar_consumption(detected_by, consumption_date) WHERE is_deleted = FALSE;

-- Housekeeping context
CREATE INDEX idx_minibar_consumption_hk_date ON minibar_consumption(property_id, housekeeping_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_hk_report ON minibar_consumption(hk_report_id) WHERE is_deleted = FALSE;

-- Verification status
CREATE INDEX idx_minibar_consumption_unverified ON minibar_consumption(property_id, verified, consumption_date) WHERE is_deleted = FALSE AND verified = FALSE;
CREATE INDEX idx_minibar_consumption_verification_pending ON minibar_consumption(property_id, consumption_date) WHERE is_deleted = FALSE AND verified = FALSE AND consumption_date IS NOT NULL;

-- Dispute tracking
CREATE INDEX idx_minibar_consumption_disputed ON minibar_consumption(property_id, disputed, dispute_resolved) WHERE is_deleted = FALSE AND disputed = TRUE;
CREATE INDEX idx_minibar_consumption_dispute_unresolved ON minibar_consumption(property_id, dispute_date) WHERE is_deleted = FALSE AND disputed = TRUE AND dispute_resolved = FALSE;

-- Adjustment tracking
CREATE INDEX idx_minibar_consumption_adjusted ON minibar_consumption(property_id, adjustment_applied, consumption_date) WHERE is_deleted = FALSE AND adjustment_applied = TRUE;

-- Replenishment tracking
CREATE INDEX idx_minibar_consumption_replenish ON minibar_consumption(property_id, room_id, replenishment_required, replenished) WHERE is_deleted = FALSE AND replenishment_required = TRUE AND replenished = FALSE;

-- Alcohol compliance
CREATE INDEX idx_minibar_consumption_alcohol ON minibar_consumption(property_id, is_alcoholic, age_verified) WHERE is_deleted = FALSE AND is_alcoholic = TRUE;
CREATE INDEX idx_minibar_consumption_age_unverified ON minibar_consumption(property_id, consumption_date) WHERE is_deleted = FALSE AND is_alcoholic = TRUE AND age_verified = FALSE;

-- Complimentary items
CREATE INDEX idx_minibar_consumption_complimentary ON minibar_consumption(property_id, complimentary, consumption_date) WHERE is_deleted = FALSE AND complimentary = TRUE;

-- Settlement status
CREATE INDEX idx_minibar_consumption_unsettled ON minibar_consumption(property_id, settled, consumption_date) WHERE is_deleted = FALSE AND settled = FALSE;

-- Accounting integration
CREATE INDEX idx_minibar_consumption_accounting ON minibar_consumption(property_id, accounting_posted, revenue_date) WHERE is_deleted = FALSE AND accounting_posted = FALSE;

-- Revenue reporting
CREATE INDEX idx_minibar_consumption_revenue ON minibar_consumption(property_id, revenue_date, revenue_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_gl ON minibar_consumption(gl_account, revenue_date) WHERE is_deleted = FALSE;

-- Batch processing
CREATE INDEX idx_minibar_consumption_batch ON minibar_consumption(batch_id, batch_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_bulk_pending ON minibar_consumption(property_id, bulk_posted, batch_date) WHERE is_deleted = FALSE AND bulk_posted = FALSE;

-- Integration indexes
CREATE INDEX idx_minibar_consumption_pos ON minibar_consumption(pos_transaction_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_consumption_external ON minibar_consumption(external_system_id) WHERE is_deleted = FALSE;

-- Quality issues
CREATE INDEX idx_minibar_consumption_quality ON minibar_consumption(property_id, quality_issue, consumption_date) WHERE is_deleted = FALSE AND quality_issue = TRUE;

-- JSONB indexes (GIN)
CREATE INDEX idx_minibar_consumption_metadata_gin ON minibar_consumption USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_minibar_consumption_created ON minibar_consumption(created_at);
CREATE INDEX idx_minibar_consumption_updated ON minibar_consumption(updated_at);

\echo 'Indexes for minibar_consumption created successfully!'
