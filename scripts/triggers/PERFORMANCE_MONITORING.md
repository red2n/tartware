# Performance Monitoring & Alerting System

Comprehensive performance monitoring, automated reporting, and real-time alerting for Tartware PMS.

## 🎯 Overview

This system provides:
- **pg_qualstats Integration** - WHERE clause analysis for missing indexes
- **HypoPG Integration** - Zero-cost hypothetical index testing
- **Automated Reporting** - Daily/hourly performance reports
- **Anomaly Detection** - Baseline-based performance degradation detection
- **Real-time Alerting** - Immediate alerts for critical issues

## 📁 File Structure

```
scripts/
├── triggers/
│   ├── 11_install_performance_extensions.sql      # Extension installation
│   └── 12_install_all_performance_monitoring.sql  # Master installer
│
├── tables/
│   ├── 23_performance_reporting_tables.sql        # Reporting tables
│   └── 24_performance_alerting_tables.sql         # Alerting tables
│
└── procedures/
    ├── 15_performance_reporting_procedures.sql    # Reporting functions
    └── 16_performance_alerting_procedures.sql     # Alerting functions
```

## 🚀 Installation

### Prerequisites

Install PostgreSQL extensions at OS level:

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-16-pg-qualstats
sudo apt-get install postgresql-16-hypopg
sudo apt-get install postgresql-16-pg-cron  # Optional
```

**RHEL/CentOS:**
```bash
sudo yum install pg_qualstats_16
sudo yum install hypopg_16
sudo yum install pg_cron_16  # Optional
```

### Add to postgresql.conf:
```ini
shared_preload_libraries = 'pg_stat_statements,pg_qualstats'
```

Then restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Install All Components

```bash
cd /home/navin/tartware/scripts/triggers
psql -U postgres -d tartware -f 12_install_all_performance_monitoring.sql
```

This installs:
- ✅ 4 extensions (pg_stat_statements, pg_qualstats, hypopg, pg_cron)
- ✅ 6 tables (reports, schedules, thresholds, baselines, alerts, rules)
- ✅ 17 functions (reporting, alerting, recommendations)
- ✅ 7 views (dashboards, alerts, trends)

## 📊 Components

### 1. Extension Support

#### Check Extension Status
```sql
SELECT * FROM v_extension_status;
```

**Output:**
```
extension_name        | version | status          | description
---------------------+---------+-----------------+---------------------------
pg_stat_statements    | 1.10    | ✅ Installed    | Query performance statistics
pg_qualstats          | 2.1     | ✅ Installed    | WHERE clause analysis
hypopg                | 1.4     | ✅ Installed    | Hypothetical index testing
pg_cron               | 1.6     | ✅ Installed    | Scheduled job automation
```

### 2. Index Recommendations

#### Get Automated Recommendations
```sql
SELECT * FROM v_index_recommendations;
```

**Example Output:**
```
priority | table_name        | index_definition                              | reason                           | estimated_benefit
---------+-------------------+-----------------------------------------------+----------------------------------+------------------
1        | public.guests     | CREATE INDEX idx_guests_email ON guests(email)| Column email filtered 1523 times | ⚡ VERY HIGH (10x+)
2        | public.properties | CREATE INDEX idx_properties_type ON ...       | Column property_type filtered... | 🔥 HIGH (5x+)
```

#### Analyze Missing Indexes (pg_qualstats)
```sql
SELECT * FROM analyze_missing_indexes_qualstats();
```

**Shows:**
- Frequently filtered columns without indexes
- Execution time impact
- Recommended index creation commands

#### Test Hypothetical Index (HypoPG)
```sql
SELECT * FROM test_hypothetical_index(
    'CREATE INDEX ON reservations(guest_id, check_in_date)',
    'SELECT * FROM reservations WHERE guest_id = ''uuid'' AND check_in_date > CURRENT_DATE'
);
```

**Output:**
```
index_name                | cost_before | cost_after | cost_reduction_percent | recommendation
-------------------------+-------------+------------+------------------------+--------------------------------
<hypothetical index>      | 1250.50     | 125.25     | 90.0                   | ⚡ HIGHLY RECOMMENDED - Over 50% improvement
```

**Key Benefits:**
- ✅ **Zero Cost** - No disk space or CPU used
- ✅ **Instant Testing** - Test multiple index strategies quickly
- ✅ **Query-Specific** - See exact benefit for your workload

### 3. Performance Reporting

#### Generate Daily Performance Report
```sql
SELECT generate_daily_performance_report();
-- Returns: report_id UUID

-- View the report
SELECT * FROM get_latest_report('DAILY_PERFORMANCE');
```

**Report Contains:**
- Database info (size, version, uptime)
- Table statistics (rows, bloat, vacuum status)
- Slow queries (top 10)
- Unused indexes
- Connection statistics
- Cache hit rates
- Index recommendations

#### Generate Health Check
```sql
SELECT generate_health_check_report();
-- Returns: report_id UUID

-- View the report
SELECT * FROM get_latest_report('HEALTH_CHECK');
```

**Health Check Monitors:**
- Connection pool saturation
- Long-running queries (>5 minutes)
- Table bloat levels
- Cache hit rate degradation

#### View Recent Reports
```sql
SELECT * FROM v_recent_reports;
```

#### Check Current Alerts
```sql
SELECT * FROM v_current_alerts;
```

**Example Output:**
```
metric_name            | current_value | severity | threshold_value | alert_message
-----------------------+---------------+----------+-----------------+--------------------------------------
connection_saturation  | 85.5          | WARNING  | 75.0            | Connection usage at 85.5% (171 of 200)
cache_hit_rate         | 87.3          | WARNING  | 90.0            | Cache hit rate is 87.3% (should be > 90%)
```

### 4. Performance Alerting

#### Update Performance Baselines
```sql
SELECT update_performance_baselines();
```

**Establishes baselines for:**
- Query execution time (hourly average)
- Connection count (rolling average)
- Cache hit rate (daily)
- Sequential scan rate (daily)

#### Monitor for Degradation
```sql
SELECT * FROM monitor_performance_degradation();
```

**Detects:**
- Query performance degradation (>50% slower than baseline)
- Connection spikes (>50% above baseline)
- Cache hit rate drops (>5% below baseline)

**Example Output:**
```
alert_type          | severity | message                                      | current_value | baseline_value | action_required
--------------------+----------+----------------------------------------------+---------------+----------------+----------------------------------
QUERY_DEGRADATION   | WARNING  | Query slower by 87%: SELECT * FROM reserva...| 450.25        | 240.50         | Analyze query execution plan
CONNECTION_SPIKE    | WARNING  | Connection spike detected: 180 connections...| 180           | 100            | Check application connection pooling
```

#### View Active Alerts
```sql
SELECT * FROM v_active_performance_alerts;
```

#### Acknowledge Alerts
```sql
-- Acknowledge specific alert
SELECT acknowledge_alert('alert-uuid', 'username');

-- Acknowledge all alerts of a type
SELECT acknowledge_alerts_by_type('QUERY_DEGRADATION', 'dba');
```

#### View Performance Trends
```sql
SELECT * FROM v_performance_trends;
```

**Shows:**
- Current value vs baseline
- Status (Normal/Degraded/Spike)
- Last updated timestamp

### 5. Alert Summary
```sql
SELECT * FROM v_alert_summary;
```

**Output:**
```
alert_type          | severity | alert_count | first_occurrence        | last_occurrence
--------------------+----------+-------------+-------------------------+-------------------------
QUERY_DEGRADATION   | WARNING  | 15          | 2025-10-15 08:00:00     | 2025-10-15 14:30:00
CONNECTION_SPIKE    | CRITICAL | 3           | 2025-10-15 12:00:00     | 2025-10-15 13:15:00
```

## 📅 Automated Monitoring Setup

### Option 1: System Cron

Add to crontab (`crontab -e`):

```bash
# Update baselines every hour
0 * * * * psql -U postgres -d tartware -c "SELECT update_performance_baselines();"

# Check for degradation every 5 minutes
*/5 * * * * psql -U postgres -d tartware -c "SELECT * FROM monitor_performance_degradation();"

# Generate hourly health check
0 * * * * psql -U postgres -d tartware -c "SELECT generate_health_check_report();"

# Generate daily performance report at 2 AM
0 2 * * * psql -U postgres -d tartware -c "SELECT generate_daily_performance_report();"
```

### Option 2: pg_cron (Recommended)

```sql
-- Update baselines every hour
SELECT cron.schedule(
    'update-baselines',
    '0 * * * *',
    $$SELECT update_performance_baselines();$$
);

-- Monitor performance every 5 minutes
SELECT cron.schedule(
    'monitor-performance',
    '*/5 * * * *',
    $$SELECT monitor_performance_degradation();$$
);

-- Health check every hour
SELECT cron.schedule(
    'health-check',
    '0 * * * *',
    $$SELECT generate_health_check_report();$$
);

-- Daily report at 2 AM
SELECT cron.schedule(
    'daily-report',
    '0 2 * * *',
    $$SELECT generate_daily_performance_report();$$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule a job (if needed)
SELECT cron.unschedule('monitor-performance');
```

## 💡 Usage Examples

### Example 1: Find and Fix Missing Indexes

```sql
-- Step 1: Get recommendations
SELECT * FROM v_index_recommendations LIMIT 5;

-- Step 2: Test a hypothetical index
SELECT * FROM test_hypothetical_index(
    'CREATE INDEX idx_guests_email ON guests(email)',
    'SELECT * FROM guests WHERE email = ''test@example.com'''
);

-- Step 3: If recommended, create the index
CREATE INDEX CONCURRENTLY idx_guests_email ON guests(email);

-- Step 4: Verify improvement
SELECT * FROM pg_stat_user_indexes WHERE indexrelname = 'idx_guests_email';
```

### Example 2: Investigate Slow Queries

```sql
-- Get latest performance report
SELECT * FROM get_latest_report('DAILY_PERFORMANCE');

-- Extract slow queries (from JSONB)
SELECT
    jsonb_array_elements(report_data->'slow_queries') as slow_query
FROM performance_reports
WHERE report_type = 'DAILY_PERFORMANCE'
ORDER BY generated_at DESC
LIMIT 1;

-- Check for query degradation
SELECT * FROM detect_query_degradation();
```

### Example 3: Monitor Connection Health

```sql
-- Check connection spike
SELECT * FROM detect_connection_spike();

-- View connection breakdown
SELECT
    state,
    COUNT(*) as connection_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM pg_stat_activity
GROUP BY state
ORDER BY connection_count DESC;

-- Find idle connections
SELECT
    pid,
    usename,
    application_name,
    state,
    AGE(NOW(), state_change) as idle_duration
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '10 minutes'
ORDER BY idle_duration DESC;
```

### Example 4: Cache Performance Analysis

```sql
-- Check cache degradation
SELECT * FROM detect_cache_degradation();

-- Detailed cache statistics by table
SELECT
    schemaname,
    tablename,
    ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) as cache_hit_rate,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY cache_hit_rate ASC
LIMIT 10;

-- Check shared_buffers usage
SELECT
    name,
    setting,
    unit,
    short_desc
FROM pg_settings
WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem');
```

## 🔔 Alert Notifications

### Email Integration (Example with pg_cron + notify)

```sql
-- Create notification function
CREATE OR REPLACE FUNCTION send_alert_notifications()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert RECORD;
    v_message TEXT;
BEGIN
    FOR v_alert IN
        SELECT * FROM v_active_performance_alerts
        WHERE severity IN ('CRITICAL', 'WARNING')
    LOOP
        v_message := FORMAT(
            'ALERT: %s - %s (Current: %s, Baseline: %s)',
            v_alert.alert_type,
            v_alert.alert_message,
            v_alert.current_value,
            v_alert.baseline_value
        );

        -- Use NOTIFY for application to pickup
        PERFORM pg_notify('performance_alert', v_message);

        -- Or log to syslog
        RAISE WARNING '%', v_message;
    END LOOP;
END $$;

-- Schedule notifications
SELECT cron.schedule(
    'alert-notifications',
    '*/5 * * * *',
    $$SELECT send_alert_notifications();$$
);
```

### Slack/Discord Webhooks (Application Layer)

Your application can listen to PostgreSQL NOTIFY and forward to webhooks:

```python
import psycopg2
import requests

conn = psycopg2.connect("dbname=tartware user=postgres")
conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute("LISTEN performance_alert;")

while True:
    conn.poll()
    while conn.notifies:
        notify = conn.notifies.pop(0)
        # Forward to Slack
        requests.post(
            'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
            json={'text': notify.payload}
        )
```

## 📈 Performance Impact

The monitoring system itself has minimal overhead:

- **Baselines Update**: ~100-500ms (hourly)
- **Degradation Check**: ~50-200ms (every 5 minutes)
- **Report Generation**: ~1-3 seconds (daily/hourly)
- **pg_qualstats**: <1% CPU overhead
- **HypoPG**: Zero overhead (only during testing)

## 🆘 Troubleshooting

### Extension Not Found

```sql
-- Check if extension files exist
SELECT * FROM pg_available_extensions WHERE name IN ('pg_qualstats', 'hypopg');

-- If not found, install at OS level first (see Installation section)
```

### pg_qualstats Not Tracking

```sql
-- Check if it's in shared_preload_libraries
SHOW shared_preload_libraries;

-- Check if it's enabled
SHOW pg_qualstats.enabled;

-- If not, add to postgresql.conf and restart:
-- shared_preload_libraries = 'pg_stat_statements,pg_qualstats'
-- pg_qualstats.enabled = on
```

### No Baseline Data

```sql
-- Manually establish baselines
SELECT update_performance_baselines();

-- Wait 1 hour for query statistics to accumulate
-- Then check:
SELECT * FROM performance_baselines;
```

### High Alert Volume

```sql
-- Adjust thresholds
UPDATE performance_thresholds
SET warning_threshold = 85,  -- was 75
    critical_threshold = 95  -- was 90
WHERE metric_name = 'connection_saturation';

-- Or acknowledge noisy alerts
SELECT acknowledge_alerts_by_type('QUERY_DEGRADATION', 'system');
```

## 📚 Related Documentation

- [Main Triggers README](./README.md) - Query efficiency monitoring
- [PostgreSQL Documentation - pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [pg_qualstats GitHub](https://github.com/powa-team/pg_qualstats)
- [HypoPG GitHub](https://github.com/HypoPG/hypopg)
- [pg_cron GitHub](https://github.com/citusdata/pg_cron)

---

**Created:** 2025-10-15
**Version:** 1.0
**Status:** Production Ready ✅
