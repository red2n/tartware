-- =====================================================
-- 24_performance_alerting_fk.sql
-- Foreign Key Constraints for performance alerting tables
-- 
-- Note: These are system-level tables with no tenant/property
-- relationships. Minimal constraints.
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
-- ALTER TABLE performance_baselines DROP CONSTRAINT IF EXISTS fk_performance_baselines_xxx;
-- ALTER TABLE performance_alerts DROP CONSTRAINT IF EXISTS fk_performance_alerts_xxx;
-- ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS fk_alert_rules_xxx;

-- Note: performance_baselines, performance_alerts, and alert_rules
-- are system-level monitoring tables that do not have foreign key 
-- relationships to other tables. They operate independently for 
-- database performance alerting and baseline tracking.

-- Success message
\echo '✓ Constraints created: performance_alerting tables (24/37)'
\echo '  - System-level tables (no FK constraints)'
\echo '  - Independent alerting tables'
\echo ''
