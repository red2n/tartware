-- =============================================
-- Asset Inventory Table
-- =============================================
-- Description: Physical asset tracking and inventory management
-- Dependencies: properties, rooms
-- Category: Maintenance & Asset Management
-- =============================================

CREATE TABLE IF NOT EXISTS asset_inventory (
    -- Primary Key
    asset_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Asset Identification
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN (
        'furniture',
        'appliance',
        'hvac_equipment',
        'electronics',
        'kitchen_equipment',
        'laundry_equipment',
        'fitness_equipment',
        'pool_equipment',
        'vehicle',
        'it_equipment',
        'lighting_fixture',
        'plumbing_fixture',
        'artwork',
        'other'
    )),

    asset_category VARCHAR(50) CHECK (asset_category IN (
        'guest_room',
        'public_area',
        'back_of_house',
        'facility',
        'grounds',
        'vehicle_fleet'
    )),

    -- Location
    location_type VARCHAR(50) CHECK (location_type IN (
        'room',
        'public_space',
        'storage',
        'maintenance_area',
        'kitchen',
        'laundry',
        'pool',
        'gym',
        'parking',
        'office',
        'other'
    )),

    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    location_description TEXT,

    -- Equipment Details
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    barcode VARCHAR(100),

    -- Acquisition
    purchase_date DATE,
    purchase_price DECIMAL(12,2),
    vendor_name VARCHAR(255),
    vendor_contact TEXT,

    invoice_number VARCHAR(100),
    purchase_order_number VARCHAR(100),

    -- Warranty
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_provider VARCHAR(255),
    warranty_terms TEXT,
    warranty_status VARCHAR(50) GENERATED ALWAYS AS (
        CASE
            WHEN warranty_end_date IS NULL THEN 'no_warranty'
            WHEN warranty_end_date >= CURRENT_DATE THEN 'active'
            ELSE 'expired'
        END
    ) STORED,

    -- Depreciation
    depreciation_method VARCHAR(50) CHECK (depreciation_method IN (
        'straight_line',
        'declining_balance',
        'sum_of_years_digits',
        'none'
    )),
    useful_life_years INTEGER,
    salvage_value DECIMAL(12,2),
    current_book_value DECIMAL(12,2),

    -- Condition
    condition VARCHAR(50) DEFAULT 'good' CHECK (condition IN (
        'excellent',
        'good',
        'fair',
        'poor',
        'broken',
        'decommissioned'
    )),

    last_inspection_date DATE,
    next_inspection_date DATE,
    inspection_frequency_days INTEGER,

    -- Maintenance
    maintenance_schedule VARCHAR(50) CHECK (maintenance_schedule IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'semi_annual',
        'annual',
        'as_needed'
    )),

    last_maintenance_date DATE,
    next_maintenance_date DATE,
    last_maintenance_cost DECIMAL(10,2),
    total_maintenance_cost DECIMAL(12,2) DEFAULT 0.00,

    maintenance_notes TEXT,

    -- Performance Metrics
    uptime_percentage DECIMAL(5,2),
    failure_count INTEGER DEFAULT 0,
    mean_time_between_failures INTEGER, -- Hours
    mean_time_to_repair INTEGER, -- Hours

    -- Energy Consumption (for applicable assets)
    energy_consumption_kwh DECIMAL(10,2),
    energy_efficiency_rating VARCHAR(50),

    -- Critical Asset
    is_critical BOOLEAN DEFAULT FALSE,
    criticality_level VARCHAR(50) CHECK (criticality_level IN (
        'low',
        'medium',
        'high',
        'critical'
    )),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active',
        'inactive',
        'in_maintenance',
        'out_of_service',
        'disposed',
        'lost',
        'stolen'
    )),

    operational_status VARCHAR(50) CHECK (operational_status IN (
        'operational',
        'degraded',
        'failed',
        'under_repair'
    )),

    -- Insurance
    insured BOOLEAN DEFAULT FALSE,
    insurance_policy_number VARCHAR(100),
    insurance_value DECIMAL(12,2),

    -- Compliance
    requires_certification BOOLEAN DEFAULT FALSE,
    certification_number VARCHAR(100),
    certification_expiry_date DATE,

    -- IoT Integration
    iot_enabled BOOLEAN DEFAULT FALSE,
    smart_device_id UUID REFERENCES smart_room_devices(device_id),
    sensor_data_available BOOLEAN DEFAULT FALSE,

    -- Disposal
    disposal_date DATE,
    disposal_method VARCHAR(50) CHECK (disposal_method IN (
        'sold',
        'donated',
        'recycled',
        'trashed',
        'returned_to_vendor'
    )),
    disposal_value DECIMAL(10,2),
    disposal_notes TEXT,

    -- Documentation
    manual_url TEXT,
    specification_url TEXT,
    photo_urls TEXT[],

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0
);

-- =============================================
-- Predictive Maintenance Alerts
-- =============================================

CREATE TABLE IF NOT EXISTS predictive_maintenance_alerts (
    -- Primary Key
    alert_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Asset
    asset_id UUID NOT NULL REFERENCES asset_inventory(asset_id) ON DELETE CASCADE,

    -- Alert Details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'predictive_failure',
        'performance_degradation',
        'anomaly_detected',
        'maintenance_due',
        'warranty_expiring',
        'certification_expiring',
        'end_of_life',
        'excessive_usage'
    )),

    severity VARCHAR(50) NOT NULL CHECK (severity IN (
        'info',
        'low',
        'medium',
        'high',
        'critical'
    )),

    alert_title VARCHAR(255) NOT NULL,
    alert_description TEXT,

    -- Prediction Details
    predicted_failure_date DATE,
    confidence_level DECIMAL(5,2), -- 0-100

    failure_mode VARCHAR(100), -- What is likely to fail
    root_cause TEXT, -- Predicted root cause

    -- ML Model
    ml_model_name VARCHAR(100),
    ml_model_version VARCHAR(50),
    prediction_factors JSONB, -- What factors led to this prediction

    -- Sensor Data
    sensor_readings JSONB, -- Current sensor readings
    historical_pattern JSONB, -- Historical data pattern
    threshold_exceeded VARCHAR(100),

    -- Impact Assessment
    impact_level VARCHAR(50) CHECK (impact_level IN (
        'low',
        'medium',
        'high',
        'critical'
    )),

    affects_guest_experience BOOLEAN DEFAULT FALSE,
    affects_operations BOOLEAN DEFAULT FALSE,
    affects_safety BOOLEAN DEFAULT FALSE,

    estimated_downtime_hours INTEGER,
    estimated_repair_cost DECIMAL(10,2),

    -- Recommended Action
    recommended_action TEXT NOT NULL,
    action_urgency VARCHAR(50) CHECK (action_urgency IN (
        'immediate',
        'within_24_hours',
        'within_week',
        'within_month',
        'monitor'
    )),

    recommended_service_provider VARCHAR(255),
    estimated_repair_duration_hours INTEGER,

    -- Alternative Actions
    alternative_actions JSONB, -- Array of alternative solutions

    -- Work Order
    work_order_created BOOLEAN DEFAULT FALSE,
    work_order_id UUID,
    work_order_created_at TIMESTAMP WITHOUT TIME ZONE,

    -- Status
    alert_status VARCHAR(50) DEFAULT 'active' CHECK (alert_status IN (
        'active',
        'acknowledged',
        'scheduled',
        'in_progress',
        'resolved',
        'false_positive',
        'dismissed'
    )),

    -- Workflow
    triggered_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),

    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Outcome
    actual_failure_date DATE,
    prediction_accuracy VARCHAR(50) CHECK (prediction_accuracy IN (
        'accurate',
        'early',
        'late',
        'false_positive'
    )),

    actual_repair_cost DECIMAL(10,2),
    actual_downtime_hours INTEGER,

    -- Cost Savings
    prevented_failure BOOLEAN DEFAULT FALSE,
    cost_savings DECIMAL(10,2), -- Cost saved by preventive action

    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notified_users UUID[],
    notification_sent_at TIMESTAMP WITHOUT TIME ZONE,

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- =============================================
-- Maintenance History
-- =============================================

CREATE TABLE IF NOT EXISTS maintenance_history (
    -- Primary Key
    maintenance_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Asset
    asset_id UUID NOT NULL REFERENCES asset_inventory(asset_id) ON DELETE CASCADE,

    -- Maintenance Details
    maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN (
        'preventive',
        'corrective',
        'predictive',
        'emergency',
        'routine_inspection',
        'calibration',
        'upgrade',
        'replacement'
    )),

    work_order_number VARCHAR(100),

    maintenance_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_hours DECIMAL(5,2),

    -- Issue
    issue_description TEXT,
    issue_severity VARCHAR(50),

    -- Work Performed
    work_performed TEXT NOT NULL,
    parts_replaced TEXT[],

    -- Service Provider
    performed_by VARCHAR(50) CHECK (performed_by IN (
        'internal_staff',
        'external_vendor',
        'manufacturer',
        'warranty_service'
    )),

    technician_id UUID REFERENCES users(id),
    vendor_name VARCHAR(255),
    vendor_technician_name VARCHAR(255),

    -- Cost
    labor_cost DECIMAL(10,2),
    parts_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),

    covered_by_warranty BOOLEAN DEFAULT FALSE,

    -- Outcome
    issue_resolved BOOLEAN DEFAULT TRUE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Quality
    quality_check_performed BOOLEAN DEFAULT FALSE,
    quality_check_passed BOOLEAN,
    quality_notes TEXT,

    -- Downtime
    asset_downtime_hours DECIMAL(5,2),
    guest_impact BOOLEAN DEFAULT FALSE,

    -- Documentation
    before_photos TEXT[],
    after_photos TEXT[],
    documentation_urls TEXT[],

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_asset_inventory_tenant ON asset_inventory(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_property ON asset_inventory(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_room ON asset_inventory(room_id);
CREATE INDEX idx_asset_inventory_type ON asset_inventory(asset_type);
CREATE INDEX idx_asset_inventory_tag ON asset_inventory(asset_tag) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_status ON asset_inventory(status, operational_status);
CREATE INDEX idx_asset_inventory_critical ON asset_inventory(is_critical, criticality_level) WHERE is_critical = TRUE;
CREATE INDEX idx_asset_inventory_warranty ON asset_inventory(warranty_end_date) WHERE warranty_end_date >= CURRENT_DATE;
CREATE INDEX idx_asset_inventory_next_maintenance ON asset_inventory(next_maintenance_date) WHERE status = 'active';

CREATE INDEX idx_predictive_maintenance_alerts_asset ON predictive_maintenance_alerts(asset_id);
CREATE INDEX idx_predictive_maintenance_alerts_status ON predictive_maintenance_alerts(alert_status);
CREATE INDEX idx_predictive_maintenance_alerts_severity ON predictive_maintenance_alerts(severity) WHERE alert_status = 'active';
CREATE INDEX idx_predictive_maintenance_alerts_triggered ON predictive_maintenance_alerts(triggered_at DESC);
CREATE INDEX idx_predictive_maintenance_alerts_predicted ON predictive_maintenance_alerts(predicted_failure_date) WHERE alert_status IN ('active', 'acknowledged');

CREATE INDEX idx_maintenance_history_asset ON maintenance_history(asset_id);
CREATE INDEX idx_maintenance_history_date ON maintenance_history(maintenance_date DESC);
CREATE INDEX idx_maintenance_history_type ON maintenance_history(maintenance_type);
CREATE INDEX idx_maintenance_history_technician ON maintenance_history(technician_id);

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE asset_inventory IS 'Physical asset tracking with depreciation, maintenance scheduling, and lifecycle management';
COMMENT ON TABLE predictive_maintenance_alerts IS 'AI-powered predictive maintenance alerts with failure prediction and cost impact';
COMMENT ON TABLE maintenance_history IS 'Complete maintenance history log for all assets';
COMMENT ON COLUMN asset_inventory.warranty_status IS 'Computed warranty status (active/expired/no_warranty)';
COMMENT ON COLUMN predictive_maintenance_alerts.confidence_level IS 'ML model confidence in failure prediction (0-100)';
COMMENT ON COLUMN predictive_maintenance_alerts.prediction_factors IS 'JSON showing which factors (usage, age, sensor data) led to prediction';
