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
WHERE sh.handover_id = $1
  AND sh.tenant_id = $2
  AND COALESCE(sh.is_deleted, false) = false
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
    beo.created_at,
    -- A BEO is superseded when a later revision points back at it. Derived
    -- rather than stored: beo_status has no SUPERSEDED value in its CHECK, and
    -- the revision chain already carries the fact.
    EXISTS (
        SELECT 1 FROM banquet_event_orders newer
        WHERE newer.previous_beo_id = beo.beo_id
          AND COALESCE(newer.is_deleted, false) = false
    ) AS is_superseded
FROM banquet_event_orders beo
LEFT JOIN properties p ON p.id = beo.property_id
LEFT JOIN meeting_rooms mr ON mr.room_id = beo.meeting_room_id
WHERE beo.tenant_id = $2
  AND ($3::UUID IS NULL OR beo.property_id = $3)
  AND ($4::VARCHAR IS NULL OR beo.beo_status = $4)
  AND ($5::DATE IS NULL OR beo.event_date = $5)
  AND ($6::UUID IS NULL OR beo.meeting_room_id = $6)
  AND ($8::UUID IS NULL OR beo.event_booking_id = $8)
  AND COALESCE(beo.is_deleted, false) = false
-- Version ascending within a document so a revision history reads in order.
ORDER BY beo.event_date ASC, beo.event_start_time ASC, beo.beo_number ASC, beo.beo_version ASC
LIMIT $1
OFFSET $7
`;

/**
 * Every column the BEO detail read model carries, with its joins — shared by the
 * by-id read and the day sheet.
 *
 * Extracted rather than copied: this list is 141 of the table's 146 columns, and
 * a second hand-maintained copy would stop carrying any column added later. The
 * two queries differ only in their WHERE clause.
 */
const BANQUET_ORDER_DETAIL_SELECT = `
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
    beo.revision_date,
    beo.revision_reason,
    beo.previous_beo_id,
    beo.event_date,
    beo.setup_start_time::TEXT,
    beo.event_start_time::TEXT,
    beo.event_end_time::TEXT,
    beo.teardown_end_time::TEXT,
    beo.room_release_time::TEXT,
    beo.meeting_room_id,
    mr.room_name as meeting_room_name,
    beo.room_setup,
    INITCAP(REPLACE(beo.room_setup, '_', ' ')) as room_setup_display,
    beo.tables_count,
    beo.chairs_count,
    beo.table_configuration,
    beo.seating_chart_layout_url,
    beo.guaranteed_count,
    beo.expected_count,
    beo.over_set_percentage::TEXT,
    beo.actual_count,
    beo.menu_type,
    beo.menu_items,
    beo.service_style,
    beo.courses_count,
    beo.meal_service_start_time::TEXT,
    beo.meal_service_duration_minutes,
    beo.appetizers,
    beo.salads,
    beo.entrees,
    beo.sides,
    beo.desserts,
    beo.stations,
    beo.bar_type,
    beo.bar_start_time::TEXT,
    beo.bar_end_time::TEXT,
    beo.bar_setup_location,
    beo.beverages,
    beo.wine_service,
    beo.coffee_tea_service,
    beo.water_service,
    beo.vegetarian_count,
    beo.vegan_count,
    beo.gluten_free_count,
    beo.dairy_free_count,
    beo.nut_free_count,
    beo.kosher_count,
    beo.halal_count,
    beo.special_diets,
    beo.linen_color,
    beo.linen_type,
    beo.napkin_color,
    beo.napkin_fold,
    beo.table_skirting,
    beo.centerpieces,
    beo.decor_description,
    beo.candles,
    beo.floral_arrangements,
    beo.equipment_list,
    beo.av_equipment,
    beo.stage_required,
    beo.stage_dimensions,
    beo.podium_required,
    beo.dance_floor_required,
    beo.special_lighting,
    beo.lighting_notes,
    beo.servers_count,
    beo.bartenders_count,
    beo.chefs_count,
    beo.captains_count,
    beo.coat_check_attendants,
    beo.valet_attendants,
    beo.security_guards,
    beo.staff_arrival_time::TEXT,
    beo.staff_meal_time::TEXT,
    beo.staff_break_schedule,
    beo.overtime_authorized,
    beo.food_subtotal::TEXT,
    beo.beverage_subtotal::TEXT,
    beo.equipment_rental_total::TEXT,
    beo.labor_charges::TEXT,
    beo.service_charge_percent::TEXT,
    beo.service_charge_amount::TEXT,
    beo.gratuity_percent::TEXT,
    beo.gratuity_amount::TEXT,
    beo.tax_percent::TEXT,
    beo.tax_amount::TEXT,
    beo.total_estimated::TEXT,
    beo.total_actual::TEXT,
    beo.currency_code,
    beo.billing_type,
    beo.price_per_person::TEXT,
    beo.children_price::TEXT,
    beo.children_count,
    beo.kitchen_instructions,
    beo.service_instructions,
    beo.setup_instructions,
    beo.cleanup_instructions,
    beo.audio_visual_instructions,
    beo.client_approved,
    beo.client_approved_date,
    beo.client_approved_by,
    beo.client_signature_url,
    beo.chef_approved,
    beo.chef_approved_date,
    beo.chef_approved_by,
    beo.manager_approved,
    beo.manager_approved_date,
    beo.manager_approved_by,
    beo.setup_completed,
    beo.setup_completed_time,
    beo.event_started,
    beo.event_started_time,
    beo.event_ended,
    beo.event_ended_time,
    beo.teardown_completed,
    beo.teardown_completed_time,
    beo.post_event_notes,
    beo.issues_encountered,
    beo.client_satisfaction_rating,
    beo.photos,
    beo.last_sent_to_client,
    beo.last_sent_to_kitchen,
    beo.last_sent_to_setup,
    beo.distribution_list,
    beo.signed_beo_url,
    beo.floor_plan_url,
    beo.seating_chart_document_url,
    beo.menu_card_url,
    beo.internal_notes,
    beo.client_notes,
    beo.allergy_warnings,
    beo.metadata,
    beo.created_at,
    beo.updated_at,
    EXISTS (
        SELECT 1 FROM banquet_event_orders newer
        WHERE newer.previous_beo_id = beo.beo_id
          AND COALESCE(newer.is_deleted, false) = false
    ) AS is_superseded,
    -- The booking the BEO details. A day sheet that cannot say "Smith Wedding"
    -- is a list of room numbers, and the kitchen and the captain both work from
    -- the name; the phone number is who to call when something is wrong on the
    -- day. Carried on the detail rather than the day sheet alone so the BEO
    -- editor names its booking too.
    eb.event_name,
    eb.organizer_name AS event_organizer_name,
    eb.contact_person AS event_contact_person,
    eb.contact_phone AS event_contact_phone
FROM banquet_event_orders beo
LEFT JOIN properties p ON p.id = beo.property_id
LEFT JOIN meeting_rooms mr ON mr.room_id = beo.meeting_room_id
LEFT JOIN event_bookings eb
       ON eb.event_id = beo.event_booking_id
      AND eb.tenant_id = beo.tenant_id
`;

export const BANQUET_ORDER_BY_ID_SQL = `${BANQUET_ORDER_DETAIL_SELECT}
WHERE beo.beo_id = $1
  AND beo.tenant_id = $2
  AND COALESCE(beo.is_deleted, false) = false
`;

/**
 * The day sheet — every BEO the operation works from on one date.
 *
 * Current versions only: a superseded revision is paperwork the kitchen has
 * already replaced, and printing both is how the wrong menu reaches the pass.
 * Cancelled BEOs are dropped; drafts are *kept*, because a function whose BEO
 * has not been issued is exactly what the morning meeting needs to catch.
 *
 * Ordered by the time the room is first touched, not by the event start: the
 * sheet is read top to bottom as the day happens, and setup comes first.
 *
 * `property_id` is required rather than optional: a day sheet is one property's
 * day, and `idx_beo_event_date` leads with `property_id`, so an optional filter
 * would have made the common call the one that cannot use the index.
 */
export const BANQUET_ORDER_DAY_SHEET_SQL = `${BANQUET_ORDER_DETAIL_SELECT}
WHERE beo.tenant_id = $1
  AND beo.property_id = $3::uuid
  AND beo.event_date = $2::date
  AND COALESCE(beo.is_deleted, false) = false
  AND beo.beo_status <> 'CANCELLED'
  AND NOT EXISTS (
      SELECT 1 FROM banquet_event_orders newer
      WHERE newer.previous_beo_id = beo.beo_id
        AND COALESCE(newer.is_deleted, false) = false
  )
ORDER BY COALESCE(beo.setup_start_time, beo.event_start_time), beo.event_start_time, mr.room_name
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
    gf.feedback_status,
    INITCAP(REPLACE(COALESCE(gf.feedback_status, ''), '_', ' ')) as feedback_status_display,
    gf.feedback_category,
    gf.assigned_to,
    gf.assigned_at,
    gf.resolution_notes,
    gf.resolved_at,
    gf.service_recovery_reference,
    gf.created_at
FROM guest_feedback gf
LEFT JOIN properties p ON p.id = gf.property_id
LEFT JOIN guests g ON g.id = gf.guest_id AND g.tenant_id = gf.tenant_id
WHERE gf.tenant_id = $2
  AND ($3::UUID IS NULL OR gf.property_id = $3)
  AND ($4::VARCHAR IS NULL OR gf.sentiment_label = $4)
  AND ($5::BOOLEAN IS NULL OR gf.is_public = $5)
  AND ($6::BOOLEAN IS NULL OR (gf.response_text IS NOT NULL) = $6)
  AND ($8::VARCHAR IS NULL OR gf.feedback_status = $8)
  AND ($9::VARCHAR IS NULL OR gf.feedback_category = $9)
ORDER BY gf.created_at DESC
LIMIT $1
OFFSET $7
`;

export const GUEST_FEEDBACK_BY_ID_SQL = `
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
    gf.feedback_status,
    INITCAP(REPLACE(COALESCE(gf.feedback_status, ''), '_', ' ')) as feedback_status_display,
    gf.feedback_category,
    gf.assigned_to,
    gf.assigned_at,
    gf.resolution_notes,
    gf.resolved_at,
    gf.service_recovery_reference,
    gf.created_at
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
WHERE pr.report_id = $1
  AND pr.tenant_id = $2
  AND COALESCE(pr.is_deleted, false) = false
`;
