-- =============================================
-- Indexes for 98_sustainability_metrics
-- =============================================

CREATE INDEX idx_sustainability_metrics_property ON sustainability_metrics(property_id);
CREATE INDEX idx_sustainability_metrics_period ON sustainability_metrics(period_start_date, period_end_date);
CREATE INDEX idx_sustainability_metrics_date ON sustainability_metrics(period_start_date DESC);
CREATE INDEX idx_green_certifications_property ON green_certifications(property_id);
CREATE INDEX idx_green_certifications_status ON green_certifications(status);
CREATE INDEX idx_green_certifications_type ON green_certifications(certification_type);
CREATE INDEX idx_green_certifications_expiry ON green_certifications(expiry_date) WHERE status = 'certified';
CREATE INDEX idx_carbon_offset_programs_property ON carbon_offset_programs(property_id);
CREATE INDEX idx_carbon_offset_programs_active ON carbon_offset_programs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sustainability_initiatives_property ON sustainability_initiatives(property_id);
CREATE INDEX idx_sustainability_initiatives_status ON sustainability_initiatives(status);
CREATE INDEX idx_sustainability_initiatives_category ON sustainability_initiatives(category);
