/**
 * Operations SQL Queries
 * Purpose: Queries for cashier sessions, shift handovers, lost & found, banquet orders, guest feedback, police reports
 */

// =====================================================
// CASHIER SESSIONS
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
    u.email as cashier_name,
    cs.terminal_id,
    cs.terminal_name,
    cs.location,
    cs.session_status,
    INITCAP(REPLACE(cs.session_status, '_', ' ')) as session_status_display,
    cs.opened_at,
    cs.closed_at,
    cs.business_date,
    cs.shift_type,
    cs.opening_float_declared::TEXT,
    cs.total_transactions,
    cs.total_revenue::TEXT,
    cs.total_refunds::TEXT,
    cs.net_revenue::TEXT,
    cs.expected_cash_balance::TEXT,
    cs.closing_cash_counted::TEXT,
    cs.cash_variance::TEXT,
    cs.has_variance,
    cs.reconciled,
    cs.approved,
    cs.created_at
FROM cashier_sessions cs
LEFT JOIN properties p ON p.id = cs.property_id
LEFT JOIN users u ON u.id = cs.cashier_id
WHERE cs.tenant_id = $2
  AND ($3::UUID IS NULL OR cs.property_id = $3)
  AND ($4::VARCHAR IS NULL OR cs.session_status = $4)
  AND ($5::DATE IS NULL OR cs.business_date = $5)
  AND ($6::UUID IS NULL OR cs.cashier_id = $6)
  AND COALESCE(cs.is_deleted, false) = false
ORDER BY cs.opened_at DESC
LIMIT $1
OFFSET $7
`;

export const CASHIER_SESSION_BY_ID_SQL = `
SELECT
    cs.*,
    p.property_name,
    u.email as cashier_name
FROM cashier_sessions cs
LEFT JOIN properties p ON p.id = cs.property_id
LEFT JOIN users u ON u.id = cs.cashier_id
WHERE cs.session_id = $1
  AND cs.tenant_id = $2
  AND COALESCE(cs.is_deleted, false) = false
`;

// =====================================================
// SHIFT HANDOVERS
// =====================================================

export const SHIFT_HANDOVER_LIST_SQL = `
SELECT
    sh.handover_id,
    sh.tenant_id,
    sh.property_id,
    p.property_name,
    sh.handover_number,
    sh.handover_title,
    sh.shift_date,
    sh.outgoing_shift,
    sh.outgoing_user_id,
    ou.email as outgoing_user_name,
    sh.incoming_shift,
    sh.incoming_user_id,
    iu.email as incoming_user_name,
    sh.department,
    INITCAP(REPLACE(sh.department, '_', ' ')) as department_display,
    sh.handover_status,
    INITCAP(REPLACE(sh.handover_status, '_', ' ')) as handover_status_display,
    sh.handover_started_at,
    sh.handover_completed_at,
    sh.current_occupancy_percent::TEXT,
    sh.expected_arrivals_count,
    sh.expected_departures_count,
    sh.tasks_pending,
    sh.tasks_urgent,
    sh.key_points,
    sh.requires_follow_up,
    sh.acknowledged,
    sh.created_at
FROM shift_handovers sh
LEFT JOIN properties p ON p.id = sh.property_id
LEFT JOIN users ou ON ou.id = sh.outgoing_user_id
LEFT JOIN users iu ON iu.id = sh.incoming_user_id
WHERE sh.tenant_id = $2
  AND ($3::UUID IS NULL OR sh.property_id = $3)
  AND ($4::VARCHAR IS NULL OR sh.handover_status = $4)
  AND ($5::DATE IS NULL OR sh.shift_date = $5)
  AND ($6::VARCHAR IS NULL OR sh.department = $6)
  AND COALESCE(sh.is_deleted, false) = false
ORDER BY sh.shift_date DESC, sh.handover_started_at DESC
LIMIT $1
OFFSET $7
`;

export const SHIFT_HANDOVER_BY_ID_SQL = `
SELECT
    sh.*,
    p.property_name,
    ou.email as outgoing_user_name,
    iu.email as incoming_user_name
FROM shift_handovers sh
LEFT JOIN properties p ON p.id = sh.property_id
LEFT JOIN users ou ON ou.id = sh.outgoing_user_id
LEFT JOIN users iu ON iu.id = sh.incoming_user_id
WHERE sh.handover_id = $1
  AND sh.tenant_id = $2
  AND COALESCE(sh.is_deleted, false) = false
`;

// =====================================================
// LOST AND FOUND
// =====================================================

export const LOST_FOUND_LIST_SQL = `
SELECT
    lf.item_id,
    lf.tenant_id,
    lf.property_id,
    p.property_name,
    lf.item_number,
    lf.item_name,
    lf.item_description,
    lf.item_category,
    INITCAP(REPLACE(lf.item_category, '_', ' ')) as item_category_display,
    lf.color,
    lf.estimated_value::TEXT,
    lf.is_valuable,
    lf.found_date,
    lf.found_by_name,
    lf.found_location,
    lf.room_number,
    g.first_name || ' ' || g.last_name as guest_name,
    lf.item_status,
    INITCAP(REPLACE(lf.item_status, '_', ' ')) as item_status_display,
    lf.storage_location,
    EXTRACT(DAY FROM AGE(CURRENT_DATE, lf.found_date))::INTEGER as days_in_storage,
    lf.claimed,
    lf.returned,
    lf.disposed,
    lf.hold_until_date,
    lf.has_photos,
    lf.created_at
FROM lost_and_found lf
LEFT JOIN properties p ON p.id = lf.property_id
LEFT JOIN guests g ON g.id = lf.guest_id AND g.tenant_id = lf.tenant_id
WHERE lf.tenant_id = $2
  AND ($3::UUID IS NULL OR lf.property_id = $3)
  AND ($4::VARCHAR IS NULL OR lf.item_status = $4)
  AND ($5::VARCHAR IS NULL OR lf.item_category = $5)
  AND ($6::DATE IS NULL OR lf.found_date >= $6)
  AND COALESCE(lf.is_deleted, false) = false
ORDER BY lf.found_date DESC
LIMIT $1
OFFSET $7
`;

export const LOST_FOUND_BY_ID_SQL = `
SELECT
    lf.*,
    p.property_name,
    g.first_name || ' ' || g.last_name as guest_name
FROM lost_and_found lf
LEFT JOIN properties p ON p.id = lf.property_id
LEFT JOIN guests g ON g.id = lf.guest_id AND g.tenant_id = lf.tenant_id
WHERE lf.item_id = $1
  AND lf.tenant_id = $2
  AND COALESCE(lf.is_deleted, false) = false
`;

// =====================================================
// BANQUET EVENT ORDERS
// =====================================================

export const BANQUET_ORDER_LIST_SQL = `
SELECT
    beo.beo_id,
    beo.tenant_id,
    beo.property_id,
    p.property_name,
    beo.event_booking_id,
    beo.beo_number,
    beo.beo_version,
    beo.beo_status,
    INITCAP(REPLACE(beo.beo_status, '_', ' ')) as beo_status_display,
    beo.event_date,
    beo.event_start_time::TEXT,
    beo.event_end_time::TEXT,
    beo.meeting_room_id,
    mr.room_name as meeting_room_name,
    beo.room_setup,
    INITCAP(REPLACE(beo.room_setup, '_', ' ')) as room_setup_display,
    beo.guaranteed_count,
    beo.expected_count,
    beo.actual_count,
    beo.menu_type,
    beo.service_style,
    beo.bar_type,
    beo.food_subtotal::TEXT,
    beo.beverage_subtotal::TEXT,
    beo.total_estimated::TEXT,
    beo.total_actual::TEXT,
    beo.client_approved,
    beo.chef_approved,
    beo.manager_approved,
    beo.setup_completed,
    beo.event_started,
    beo.event_ended,
    beo.created_at
FROM banquet_event_orders beo
LEFT JOIN properties p ON p.id = beo.property_id
LEFT JOIN meeting_rooms mr ON mr.room_id = beo.meeting_room_id
WHERE beo.tenant_id = $2
  AND ($3::UUID IS NULL OR beo.property_id = $3)
  AND ($4::VARCHAR IS NULL OR beo.beo_status = $4)
  AND ($5::DATE IS NULL OR beo.event_date = $5)
  AND ($6::UUID IS NULL OR beo.meeting_room_id = $6)
  AND COALESCE(beo.is_deleted, false) = false
ORDER BY beo.event_date ASC, beo.event_start_time ASC
LIMIT $1
OFFSET $7
`;

export const BANQUET_ORDER_BY_ID_SQL = `
SELECT
    beo.*,
    p.property_name,
    mr.room_name as meeting_room_name
FROM banquet_event_orders beo
LEFT JOIN properties p ON p.id = beo.property_id
LEFT JOIN meeting_rooms mr ON mr.room_id = beo.meeting_room_id
WHERE beo.beo_id = $1
  AND beo.tenant_id = $2
  AND COALESCE(beo.is_deleted, false) = false
`;

// =====================================================
// GUEST FEEDBACK
// =====================================================

export const GUEST_FEEDBACK_LIST_SQL = `
SELECT
    gf.id,
    gf.tenant_id,
    gf.property_id,
    p.property_name,
    gf.guest_id,
    g.first_name || ' ' || g.last_name as guest_name,
    gf.reservation_id,
    gf.feedback_source,
    INITCAP(REPLACE(COALESCE(gf.feedback_source, ''), '_', ' ')) as feedback_source_display,
    gf.overall_rating::TEXT,
    gf.rating_scale,
    gf.cleanliness_rating::TEXT,
    gf.staff_rating::TEXT,
    gf.location_rating::TEXT,
    gf.value_rating::TEXT,
    gf.review_title,
    gf.review_text,
    gf.would_recommend,
    gf.would_return,
    gf.sentiment_label,
    gf.is_verified,
    gf.is_public,
    gf.is_featured,
    gf.response_text,
    gf.responded_at,
    gf.created_at
FROM guest_feedback gf
LEFT JOIN properties p ON p.id = gf.property_id
LEFT JOIN guests g ON g.id = gf.guest_id AND g.tenant_id = gf.tenant_id
WHERE gf.tenant_id = $2
  AND ($3::UUID IS NULL OR gf.property_id = $3)
  AND ($4::VARCHAR IS NULL OR gf.sentiment_label = $4)
  AND ($5::BOOLEAN IS NULL OR gf.is_public = $5)
  AND ($6::BOOLEAN IS NULL OR (gf.response_text IS NOT NULL) = $6)
ORDER BY gf.created_at DESC
LIMIT $1
OFFSET $7
`;

export const GUEST_FEEDBACK_BY_ID_SQL = `
SELECT
    gf.*,
    p.property_name,
    g.first_name || ' ' || g.last_name as guest_name
FROM guest_feedback gf
LEFT JOIN properties p ON p.id = gf.property_id
LEFT JOIN guests g ON g.id = gf.guest_id AND g.tenant_id = gf.tenant_id
WHERE gf.id = $1
  AND gf.tenant_id = $2
`;

// =====================================================
// POLICE REPORTS
// =====================================================

export const POLICE_REPORT_LIST_SQL = `
SELECT
    pr.report_id,
    pr.tenant_id,
    pr.property_id,
    p.property_name,
    pr.report_number,
    pr.police_case_number,
    pr.incident_id,
    pr.incident_date,
    pr.incident_time::TEXT,
    pr.reported_date,
    pr.incident_type,
    INITCAP(REPLACE(COALESCE(pr.incident_type, ''), '_', ' ')) as incident_type_display,
    pr.incident_description,
    pr.incident_location,
    pr.room_number,
    pr.agency_name,
    pr.responding_officer_name,
    pr.report_status,
    INITCAP(REPLACE(pr.report_status, '_', ' ')) as report_status_display,
    pr.suspect_count,
    pr.victim_count,
    pr.guest_involved,
    pr.staff_involved,
    pr.property_stolen,
    pr.total_loss_value::TEXT,
    pr.arrests_made,
    pr.investigation_ongoing,
    pr.resolved,
    pr.confidential,
    pr.created_at
FROM police_reports pr
LEFT JOIN properties p ON p.id = pr.property_id
WHERE pr.tenant_id = $2
  AND ($3::UUID IS NULL OR pr.property_id = $3)
  AND ($4::VARCHAR IS NULL OR pr.report_status = $4)
  AND ($5::VARCHAR IS NULL OR pr.incident_type = $5)
  AND ($6::DATE IS NULL OR pr.incident_date >= $6)
  AND COALESCE(pr.is_deleted, false) = false
ORDER BY pr.incident_date DESC
LIMIT $1
OFFSET $7
`;

export const POLICE_REPORT_BY_ID_SQL = `
SELECT
    pr.*,
    p.property_name
FROM police_reports pr
LEFT JOIN properties p ON p.id = pr.property_id
WHERE pr.report_id = $1
  AND pr.tenant_id = $2
  AND COALESCE(pr.is_deleted, false) = false
`;
