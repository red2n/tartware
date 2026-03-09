/**
 * DEV DOC
 * Module: api/revenue-rows.ts
 * Purpose: Raw PostgreSQL row shapes for revenue-service query results
 *          and Kafka event envelopes consumed by revenue/notification services.
 * Ownership: Schema package
 */

// =====================================================
// RESERVATION EVENT ENVELOPE (Kafka)
// =====================================================

/** Kafka envelope shape for `reservations.events` topic messages. */
export type ReservationEventEnvelope = {
    metadata: {
        type: string;
        tenantId: string;
        id: string;
        correlationId?: string;
        [key: string]: unknown;
    };
    payload: {
        id: string;
        property_id: string;
        guest_id?: string;
        confirmation_number?: string;
        check_in_date?: string;
        check_out_date?: string;
        room_number?: string;
        room_type_id?: string;
        total_amount?: number;
        currency?: string;
        tenant_id?: string;
        status?: string;
        actual_check_in?: string;
        actual_check_out?: string;
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
    };
};

// =====================================================
// PRICING ROW TYPES
// =====================================================

/** Raw row shape from pricing_rules table query. */
export type PricingRuleRow = {
    rule_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    rule_name: string;
    rule_description?: string | null;
    rule_type: string;
    priority: number;
    is_active: boolean;
    effective_from: string | Date | null;
    effective_to: string | Date | null;
    applies_to_room_types: string[] | null;
    applies_to_rate_plans: string[] | null;
    condition_type: string | null;
    condition_value: unknown;
    condition_operator?: string | null;
    adjustment_type: string | null;
    adjustment_value: number | string | null;
    min_rate: number | string | null;
    max_rate: number | string | null;
    compound_with?: string[] | null;
    metadata?: Record<string, unknown> | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

/** Raw row shape from rate_recommendations table query. */
export type RateRecommendationRow = {
    recommendation_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    room_type_id: string | null;
    room_type_name: string | null;
    rate_plan_id: string | null;
    recommendation_date: string | Date;
    current_rate: number | string;
    recommended_rate: number | string;
    confidence_score: number | string | null;
    recommendation_reason: string | null;
    status: string | null;
    applied_at: string | Date | null;
    created_at: string | Date;
};

/** Raw row shape from competitor_rates table query. */
export type CompetitorRateRow = {
    competitor_rate_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    competitor_name: string;
    competitor_property_name: string | null;
    room_type_category: string | null;
    rate_date: string | Date;
    rate_amount: number | string;
    currency: string | null;
    source: string | null;
    collected_at: string | Date | null;
    created_at: string | Date;
};

/** Raw row shape from demand_calendar table query. */
export type DemandCalendarRow = {
    calendar_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    calendar_date: string | Date;
    day_of_week: string | null;
    demand_level: string | null;
    occupancy_forecast: number | string | null;
    booking_pace: number | string | null;
    events: unknown;
    notes: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

/** Raw row shape from rate_restrictions table query. */
export type RateRestrictionRow = {
    restriction_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    room_type_id: string | null;
    room_type_name: string | null;
    rate_plan_id: string | null;
    restriction_date: string | Date;
    restriction_type: string;
    restriction_value: number;
    is_active: boolean;
    source: string | null;
    reason: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

/** Raw row shape from hurdle_rates table query. */
export type HurdleRateRow = {
    hurdle_rate_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    room_type_id: string;
    room_type_name: string | null;
    hurdle_date: string | Date;
    hurdle_rate: number | string;
    currency: string | null;
    segment: string | null;
    source: string | null;
    displacement_analysis: Record<string, unknown> | null;
    confidence_score: number | string | null;
    is_active: boolean;
    notes: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

// =====================================================
// REPORT ROW TYPES
// =====================================================

/** Raw row shape from revenue_forecasts table query. */
export type RevenueForecastRow = {
    forecast_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    forecast_date: string | Date;
    forecast_period: string | null;
    room_revenue_forecast: number | string | null;
    total_revenue_forecast: number | string | null;
    occupancy_forecast: number | string | null;
    adr_forecast: number | string | null;
    revpar_forecast: number | string | null;
    confidence_level: number | string | null;
    scenario_type: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

/** Raw row shape from revenue_goals table query. */
export type RevenueGoalRow = {
    goal_id: string;
    tenant_id: string;
    property_id: string;
    property_name: string | null;
    goal_name: string;
    goal_type: string | null;
    period_start_date: string | Date;
    period_end_date: string | Date;
    goal_amount: number | string;
    actual_amount: number | string | null;
    variance_amount: number | string | null;
    variance_percent: number | string | null;
    status: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
};

/** Raw row shape from revenue KPI aggregate query. */
export type KpiRow = {
    occupied_rooms: string | number;
    total_rooms: string | number;
    room_revenue: string | number;
    total_revenue: string | number;
};

/** Raw row shape from compset indices aggregate query. */
export type CompsetRow = {
    total_rooms: string | number;
    occupied_rooms: string | number;
    room_revenue: string | number;
    avg_compset_adr: string | number | null;
    compset_count: string | number;
};

/** Raw row shape from displacement analysis query. */
export type DisplacementRow = {
    group_id: string;
    group_name: string;
    group_rooms_booked: string | number;
    group_room_nights: string | number;
    group_total_revenue: string | number;
    group_adr: string | number;
    block_start: string | Date;
    block_end: string | Date;
    avg_transient_adr: string | number | null;
    displaced_transient_revenue: string | number | null;
    net_displacement_value: string | number | null;
    adr_differential_pct: string | number | null;
};

// =====================================================
// BUDGET & DAILY REPORT ROW TYPES
// =====================================================

/** Raw row shape from budget variance report query. */
export type BudgetVarianceRow = {
    goal_id: string;
    goal_name: string;
    goal_type: string;
    goal_period: string;
    goal_category: string | null;
    department: string | null;
    period_start_date: string | Date;
    period_end_date: string | Date;
    budgeted_amount: number | string | null;
    actual_amount: number | string | null;
    variance_amount: number | string | null;
    variance_percent: number | string | null;
    variance_status: string | null;
    progress_percent: number | string | null;
    last_year_actual: number | string | null;
    yoy_growth_actual_percent: number | string | null;
    segment_goals: unknown;
    channel_goals: unknown;
    room_type_goals: unknown;
    daily_run_rate_required: number | string | null;
    daily_run_rate_actual: number | string | null;
};

/** Raw row shape from manager's daily report main query. */
export type DailyReportRow = {
    total_rooms: string | number;
    rooms_sold: string | number;
    rooms_available: string | number;
    rooms_ooo: string | number;
    rooms_oos: string | number;
    room_revenue: string | number;
    fb_revenue: string | number;
    other_revenue: string | number;
    total_revenue: string | number;
    expected_arrivals: string | number;
    actual_arrivals: string | number;
    expected_departures: string | number;
    actual_departures: string | number;
    in_house_guests: string | number;
    no_shows: string | number;
    segment_mix: unknown;
    budget_comparison: unknown;
};

/** Raw row shape from manager's daily report forecast query. */
export type ForecastRow = {
    forecast_date: string | Date;
    occupancy_forecast: string | number | null;
    adr_forecast: string | number | null;
    revpar_forecast: string | number | null;
    room_revenue_forecast: string | number | null;
    confidence_level: string | number | null;
};

/** Raw row shape from manager's daily report last-year comparison query. */
export type LastYearRow = {
    ly_rooms_sold: string | number;
    ly_total_rooms: string | number;
    ly_room_revenue: string | number;
    ly_total_revenue: string | number;
};
