/**
 * Night Audit SQL Queries
 * Purpose: Queries for night audit status, history, and OTA connections
 */

// =====================================================
// BUSINESS DATE STATUS
// =====================================================

export const BUSINESS_DATE_STATUS_SQL = `
SELECT
    bd.business_date_id,
    bd.tenant_id,
    bd.property_id,
    p.property_name,
    bd.business_date,
    bd.system_date,
    bd.date_status,
    bd.night_audit_status,
    bd.night_audit_started_at,
    bd.night_audit_completed_at,
    bd.is_locked,
    bd.allow_postings,
    bd.allow_check_ins,
    bd.allow_check_outs,
    bd.arrivals_count,
    bd.departures_count,
    bd.stayovers_count,
    bd.total_revenue,
    bd.audit_errors,
    bd.audit_warnings,
    bd.is_reconciled,
    bd.notes
FROM business_dates bd
LEFT JOIN properties p ON p.id = bd.property_id
WHERE bd.tenant_id = $1
  AND bd.property_id = $2
  AND bd.date_status = 'OPEN'
ORDER BY bd.business_date DESC
LIMIT 1
`;

// =====================================================
// NIGHT AUDIT HISTORY
// =====================================================

export const NIGHT_AUDIT_HISTORY_SQL = `
WITH audit_runs AS (
    SELECT
        nal.audit_run_id,
        nal.tenant_id,
        nal.property_id,
        nal.business_date,
        nal.next_business_date,
        nal.execution_mode,
        nal.is_test_run,
        nal.initiated_by,
        MIN(nal.started_at) as started_at,
        MAX(nal.completed_at) as completed_at,
        MAX(nal.duration_seconds) as duration_seconds,
        MAX(CASE WHEN nal.step_number = 1 THEN nal.audit_status END) as audit_status,
        COUNT(*) as total_steps,
        SUM(CASE WHEN nal.step_status = 'COMPLETED' THEN 1 ELSE 0 END) as steps_completed,
        SUM(CASE WHEN nal.step_status = 'FAILED' THEN 1 ELSE 0 END) as steps_failed,
        SUM(COALESCE(nal.error_count, 0)) as error_count,
        SUM(COALESCE(nal.warning_count, 0)) as warning_count,
        BOOL_AND(COALESCE(nal.is_successful, true)) as is_successful,
        BOOL_OR(COALESCE(nal.requires_attention, false)) as requires_attention,
        BOOL_AND(COALESCE(nal.is_acknowledged, false)) as is_acknowledged,
        MAX(nal.occupancy_percent) as occupancy_percent,
        MAX(nal.adr) as adr,
        MAX(nal.revpar) as revpar,
        MAX(nal.total_revenue) as total_revenue,
        MAX(nal.total_rooms_sold) as total_rooms_sold
    FROM night_audit_log nal
    WHERE nal.tenant_id = $2
      AND ($3::UUID IS NULL OR nal.property_id = $3)
      AND COALESCE(nal.is_deleted, false) = false
    GROUP BY nal.audit_run_id, nal.tenant_id, nal.property_id,
             nal.business_date, nal.next_business_date,
             nal.execution_mode, nal.is_test_run, nal.initiated_by
)
SELECT
    ar.audit_run_id,
    ar.tenant_id,
    ar.property_id,
    p.property_name,
    ar.business_date,
    ar.next_business_date,
    ar.audit_status,
    ar.execution_mode,
    ar.is_test_run,
    ar.started_at,
    ar.completed_at,
    ar.duration_seconds,
    ar.total_steps::INTEGER,
    ar.steps_completed::INTEGER,
    ar.steps_failed::INTEGER,
    ar.error_count::INTEGER,
    ar.warning_count::INTEGER,
    ar.is_successful,
    ar.requires_attention,
    ar.is_acknowledged,
    ar.initiated_by,
    u.email as initiated_by_name,
    ar.occupancy_percent,
    ar.adr,
    ar.revpar,
    ar.total_revenue,
    ar.total_rooms_sold
FROM audit_runs ar
LEFT JOIN properties p ON p.id = ar.property_id
LEFT JOIN users u ON u.id = ar.initiated_by
ORDER BY ar.started_at DESC
LIMIT $1
OFFSET $4
`;

// =====================================================
// NIGHT AUDIT RUN DETAIL
// =====================================================

export const NIGHT_AUDIT_RUN_DETAIL_SQL = `
SELECT
    nal.audit_log_id,
    nal.audit_run_id,
    nal.tenant_id,
    nal.property_id,
    p.property_name,
    nal.business_date,
    nal.next_business_date,
    nal.started_at,
    nal.completed_at,
    nal.duration_seconds,
    nal.audit_status,
    nal.step_number,
    nal.step_name,
    nal.step_category,
    nal.step_status,
    nal.step_started_at,
    nal.step_completed_at,
    nal.step_duration_ms,
    nal.records_processed,
    nal.records_succeeded,
    nal.records_failed,
    nal.records_skipped,
    nal.amount_posted,
    nal.transactions_created,
    nal.error_count,
    nal.warning_count,
    nal.error_message,
    nal.initiated_by,
    u.email as initiated_by_name,
    nal.execution_mode,
    nal.is_test_run,
    nal.occupancy_percent,
    nal.adr,
    nal.revpar,
    nal.total_revenue,
    nal.total_rooms_sold,
    nal.is_successful,
    nal.requires_attention,
    nal.is_acknowledged,
    nal.reports_generated,
    nal.actions_taken,
    nal.notes,
    nal.resolution_notes
FROM night_audit_log nal
LEFT JOIN properties p ON p.id = nal.property_id
LEFT JOIN users u ON u.id = nal.initiated_by
WHERE nal.audit_run_id = $1
  AND nal.tenant_id = $2
  AND COALESCE(nal.is_deleted, false) = false
ORDER BY nal.step_number ASC
`;

// =====================================================
// OTA CONNECTIONS
// =====================================================

export const OTA_CONNECTION_LIST_SQL = `
SELECT
    cm.id as ota_connection_id,
    cm.tenant_id,
    cm.property_id,
    p.property_name,
    cm.channel_code,
    cm.channel_name,
    cm.entity_type as channel_type,
    cm.last_sync_status as connection_status,
    cm.is_active,
    COALESCE(
      (cm.mapping_config->>'pushRates')::boolean AND (cm.mapping_config->>'pushAvailability')::boolean,
      false
    ) as is_two_way_sync,
    cm.last_sync_at,
    cm.last_sync_status,
    cm.last_sync_error as last_error_message,
    cm.mapping_config,
    cm.external_id,
    cm.external_code,
    cm.created_at,
    cm.updated_at
FROM channel_mappings cm
LEFT JOIN properties p ON p.id = cm.property_id
WHERE cm.tenant_id = $2
  AND ($3::UUID IS NULL OR cm.property_id = $3)
  AND ($4::VARCHAR IS NULL OR cm.last_sync_status = $4)
  AND ($5::BOOLEAN IS NULL OR cm.is_active = $5)
  AND COALESCE(cm.is_deleted, false) = false
ORDER BY cm.channel_name ASC
LIMIT $1
OFFSET $6
`;

// =====================================================
// OTA SYNC HISTORY
// =====================================================

export const OTA_SYNC_LOG_SQL = `
SELECT
    csl.sync_log_id,
    csl.channel_mapping_id as ota_connection_id,
    csl.sync_type,
    csl.sync_direction,
    csl.sync_status,
    csl.started_at,
    csl.completed_at,
    csl.duration_ms,
    csl.records_processed,
    csl.records_created,
    csl.records_updated,
    csl.records_failed,
    csl.error_message,
    csl.triggered_by
FROM channel_sync_logs csl
WHERE csl.channel_mapping_id = $1
  AND csl.tenant_id = $2
ORDER BY csl.started_at DESC
LIMIT $3
OFFSET $4
`;
