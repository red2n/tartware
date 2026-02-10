-- S18: Early Check-In / Late Check-Out Fees
-- Adds fee columns to rates table and EARLY_CHECKIN charge code

-- 1. Add fee columns to rates
ALTER TABLE rates
  ADD COLUMN IF NOT EXISTS early_checkin_fee DECIMAL(15, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS late_checkout_fee DECIMAL(15, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS early_checkin_cutoff_hour INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS late_checkout_cutoff_hour INTEGER DEFAULT 11;

COMMENT ON COLUMN rates.early_checkin_fee IS 'Fee charged for early check-in before cutoff hour';
COMMENT ON COLUMN rates.late_checkout_fee IS 'Fee charged for late check-out after cutoff hour';
COMMENT ON COLUMN rates.early_checkin_cutoff_hour IS 'Hour of day (0-23) before which early check-in fee applies (default 14 = 2 PM)';
COMMENT ON COLUMN rates.late_checkout_cutoff_hour IS 'Hour of day (0-23) after which late check-out fee applies (default 11 = 11 AM)';

-- 2. Add CHECK constraints
ALTER TABLE rates
  ADD CONSTRAINT chk_rates_early_checkin_fee CHECK (early_checkin_fee >= 0),
  ADD CONSTRAINT chk_rates_late_checkout_fee CHECK (late_checkout_fee >= 0),
  ADD CONSTRAINT chk_rates_early_checkin_cutoff CHECK (early_checkin_cutoff_hour BETWEEN 0 AND 23),
  ADD CONSTRAINT chk_rates_late_checkout_cutoff CHECK (late_checkout_cutoff_hour BETWEEN 0 AND 23);

-- 3. Add EARLY_CHECKIN charge code
INSERT INTO charge_codes (code, description, department_code, department_name, revenue_group, is_taxable, display_order)
VALUES ('EARLY_CHECKIN', 'Early Check-In Fee', 'ADJ', 'Adjustments', 'FEES', FALSE, 63)
ON CONFLICT (code) DO NOTHING;
