-- =====================================================
-- 23_performance_reporting_fk.sql
-- Foreign Key Constraints for performance reporting tables
-- 
-- Note: These are system-level tables with no tenant/property
-- relationships. Minimal constraints.
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
-- ALTER TABLE performance_reports DROP CONSTRAINT IF EXISTS fk_performance_reports_xxx;
-- ALTER TABLE report_schedules DROP CONSTRAINT IF EXISTS fk_report_schedules_xxx;
-- ALTER TABLE performance_thresholds DROP CONSTRAINT IF EXISTS fk_performance_thresholds_xxx;

-- Note: performance_reports, report_schedules, and performance_thresholds
-- are system-level monitoring tables that do not have foreign key 
-- relationships to other tables. They operate independently for 
-- database performance monitoring.

-- Success message
\echo '✓ Constraints created: performance_reporting tables (23/37)'
\echo '  - System-level tables (no FK constraints)'
\echo '  - Independent monitoring tables'
\echo ''
