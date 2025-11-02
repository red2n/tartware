-- =============================================
-- Indexes for 101_asset_inventory
-- =============================================

CREATE INDEX idx_asset_inventory_tenant ON asset_inventory(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_property ON asset_inventory(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_room ON asset_inventory(room_id);
CREATE INDEX idx_asset_inventory_type ON asset_inventory(asset_type);
CREATE INDEX idx_asset_inventory_tag ON asset_inventory(asset_tag) WHERE is_deleted = FALSE;
CREATE INDEX idx_asset_inventory_status ON asset_inventory(status, operational_status);
CREATE INDEX idx_asset_inventory_critical ON asset_inventory(is_critical, criticality_level) WHERE is_critical = TRUE;
CREATE INDEX idx_asset_inventory_warranty ON asset_inventory(warranty_end_date) WHERE is_deleted = FALSE AND warranty_end_date IS NOT NULL;
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
