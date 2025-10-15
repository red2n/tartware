# Query Efficiency & Security Triggers

This folder contains scripts for **query efficiency monitoring**, **performance optimization**, and **security enforcement**.

## 🎯 Purpose

Prevent inefficient queries and security vulnerabilities by:
- ❌ **Blocking `SELECT *` queries** (except `COUNT(*)`)
- ⚠️ **Warning about full table scans** on large tables
- 🔒 **Enforcing tenant isolation** in multi-tenant queries
- 📊 **Monitoring query performance** patterns
- 🔍 **Auditing data access** for compliance

## 📁 Contents

```
triggers/
├── 00-create-all-efficiency-triggers.sql  # Master installation script
├── 01_prevent_select_star.sql             # SELECT * prevention
├── 02_prevent_full_table_scans.sql        # Full scan detection
├── 03_enforce_tenant_isolation.sql        # Multi-tenancy security
├── verify-triggers.sql                    # Verification script
└── README.md                              # This file
```

## 🚀 Installation

### Quick Install (All Scripts)

```bash
cd /home/navin/tartware/scripts/triggers
psql -U postgres -d tartware -f 00-create-all-efficiency-triggers.sql
```

### Individual Installation

```bash
# Install SELECT * prevention
psql -U postgres -d tartware -f 01_prevent_select_star.sql

# Install full scan prevention
psql -U postgres -d tartware -f 02_prevent_full_table_scans.sql

# Install tenant isolation enforcement
psql -U postgres -d tartware -f 03_enforce_tenant_isolation.sql
```

### Verification

```bash
psql -U postgres -d tartware -f verify-triggers.sql
```

**Expected Result:** Grade A+ (100/100) ✅

## 📚 What Gets Installed

### Functions (9)

| Function | Purpose |
|----------|---------|
| `validate_query_pattern()` | Validates query efficiency before execution |
| `safe_select()` | Generate safe SELECT queries with column specification |
| `estimate_query_cost()` | Estimate query execution cost |
| `check_full_table_scan()` | Detect if query will perform full table scan |
| `suggest_query_optimization()` | Provide optimization suggestions |
| `validate_tenant_isolation()` | Check tenant_id filter presence |
| `build_safe_tenant_query()` | Auto-inject tenant_id and soft delete filters |
| `log_tenant_access()` | Audit tenant data access |
| `check_query_efficiency()` | Runtime query pattern checking |

### Views (3)

| View | Purpose |
|------|---------|
| `v_query_efficiency_monitor` | Monitor query efficiency patterns |
| `v_large_tables_monitor` | Track large tables requiring special care |
| `v_suspicious_access_patterns` | Detect suspicious data access patterns |

### Tables (1)

| Table | Purpose |
|-------|---------|
| `tenant_access_audit` | Audit log for tenant data access |

### Extensions (1)

| Extension | Purpose |
|-----------|---------|
| `pg_stat_statements` | Track query execution statistics |

## 💡 Usage Examples

### 1. Validate Query Before Execution

```sql
-- Check if query is efficient
SELECT * FROM validate_query_pattern(
    'SELECT id, name, email FROM guests
     WHERE tenant_id = ''uuid-here''
     AND deleted_at IS NULL
     LIMIT 100'
);

-- Result:
-- is_valid | error_message | suggestion
-- true     | null          | Query pattern appears efficient
```

### 2. Detect SELECT * Queries

```sql
-- This will be flagged as inefficient
SELECT * FROM validate_query_pattern('SELECT * FROM guests');

-- Result:
-- is_valid | error_message                              | suggestion
-- false    | SELECT * is not allowed for performance... | Specify exact columns: SELECT col1...
```

### 3. Check for Full Table Scans

```sql
-- Detect if query will do full table scan
SELECT * FROM check_full_table_scan(
    'SELECT id, name FROM guests WHERE email = ''test@example.com'''
);

-- Result shows if index is being used or not
```

### 4. Get Optimization Suggestions

```sql
-- Get suggestions for improving a query
SELECT * FROM suggest_query_optimization(
    'SELECT * FROM reservations WHERE status = ''confirmed'''
);

-- Returns multiple suggestions:
-- - Replace SELECT * with specific columns
-- - Add tenant_id filter
-- - Add deleted_at IS NULL filter
-- - Add LIMIT clause
```

### 5. Estimate Query Cost

```sql
-- Check how expensive a query will be
SELECT * FROM estimate_query_cost(
    'SELECT id FROM reservations
     WHERE property_id = ''uuid-here''
     LIMIT 100'
);

-- Result:
-- estimated_cost | estimated_rows | is_efficient | warning_message
-- 125.5          | 100            | true         | Query appears efficient
```

### 6. Validate Tenant Isolation

```sql
-- Check if query properly filters by tenant
SELECT * FROM validate_tenant_isolation(
    'SELECT id FROM guests WHERE tenant_id = ''uuid-here'''
);

-- Result:
-- is_safe | risk_level | message                              | affected_tables
-- true    | SAFE       | Query properly filters by tenant_id  | {guests}
```

**CRITICAL - Query without tenant_id:**

```sql
SELECT * FROM validate_tenant_isolation(
    'SELECT id FROM guests WHERE email = ''test@example.com'''
);

-- Result:
-- is_safe | risk_level | message                                    | affected_tables
-- false   | CRITICAL   | SECURITY RISK: Query accesses multi-te...  | {guests}
```

### 7. Build Safe Query Automatically

```sql
-- Automatically add tenant_id and soft delete filters
SELECT build_safe_tenant_query(
    'SELECT id, name FROM guests ORDER BY created_at DESC LIMIT 10',
    '123e4567-e89b-12d3-a456-426614174000'::uuid,
    TRUE  -- include soft delete filter
);

-- Result:
-- SELECT id, name FROM guests
-- WHERE tenant_id = '123e4567...' AND deleted_at IS NULL
-- ORDER BY created_at DESC LIMIT 10
```

### 8. Generate Safe SELECT Query

```sql
-- Use safe_select wrapper to enforce column specification
SELECT safe_select(
    'guests',                              -- table name
    ARRAY['id', 'name', 'email'],         -- columns (SELECT * not allowed)
    'tenant_id = ''uuid-here''',          -- WHERE clause
    100                                    -- LIMIT
);

-- Result: Properly formatted safe SELECT query
```

### 9. Log Tenant Access for Auditing

```sql
-- Log when a user accesses tenant data
SELECT log_tenant_access(
    '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- tenant_id
    'user@example.com',                             -- accessed_by
    'SELECT id FROM reservations WHERE tenant_id = ?', -- query
    150,                                            -- record_count
    '192.168.1.1'::inet,                           -- ip_address
    'session-abc123'                                -- session_id
);

-- Returns audit_id for reference
```

### 10. Monitor Query Efficiency

```sql
-- View queries with efficiency issues
SELECT
    query,
    efficiency_status,
    recommendation
FROM v_query_efficiency_monitor
WHERE efficiency_status != 'OK'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Shows queries with SELECT *, slow queries, etc.
```

### 11. Check Large Tables

```sql
-- See which tables need special query patterns
SELECT * FROM v_large_tables_monitor
WHERE risk_level LIKE '%CRITICAL%';

-- Result shows tables and required query patterns
```

### 12. Monitor Suspicious Access

```sql
-- Detect users with suspicious access patterns
SELECT * FROM v_suspicious_access_patterns;

-- Shows users with multiple suspicious queries in last 7 days
```

## 🔒 Security Features

### Multi-Tenant Isolation

All queries on multi-tenant tables **MUST** include `tenant_id`:

```sql
-- ❌ BLOCKED: Missing tenant_id
SELECT * FROM guests WHERE email = 'test@example.com';

-- ✅ ALLOWED: Has tenant_id filter
SELECT id, name FROM guests
WHERE tenant_id = 'uuid-here'
AND email = 'test@example.com';
```

### Soft Delete Enforcement

Queries should filter out soft-deleted records:

```sql
-- ⚠️ WARNING: May include deleted records
SELECT id FROM guests WHERE tenant_id = 'uuid-here';

-- ✅ GOOD: Filters deleted records
SELECT id FROM guests
WHERE tenant_id = 'uuid-here'
AND deleted_at IS NULL;
```

### Access Auditing

All tenant data access is logged to `tenant_access_audit` table for:
- 📊 Compliance reporting
- 🔍 Security investigations
- 📈 Usage analytics
- ⚠️ Anomaly detection

## 📋 Best Practices Enforced

### ❌ What NOT to Do

```sql
-- DON'T: Use SELECT *
SELECT * FROM guests;

-- DON'T: Query without WHERE clause
SELECT id, name FROM reservations;

-- DON'T: Query without tenant_id
SELECT id FROM guests WHERE status = 'active';

-- DON'T: Query without soft delete filter
SELECT id FROM guests WHERE tenant_id = 'uuid';

-- DON'T: LIKE with leading wildcard
SELECT id FROM guests WHERE name LIKE '%smith';

-- DON'T: Functions in WHERE without index
SELECT id FROM guests WHERE LOWER(email) = 'test@example.com';
```

### ✅ What TO Do

```sql
-- DO: Specify exact columns
SELECT id, name, email FROM guests;

-- DO: Always use WHERE clause on large tables
SELECT id, name FROM reservations
WHERE property_id = 'uuid'
LIMIT 100;

-- DO: Always filter by tenant_id
SELECT id FROM guests
WHERE tenant_id = 'uuid'
AND status = 'active';

-- DO: Include soft delete filter
SELECT id FROM guests
WHERE tenant_id = 'uuid'
AND deleted_at IS NULL;

-- DO: Use trailing wildcard for LIKE
SELECT id FROM guests WHERE name LIKE 'smith%';

-- DO: Create functional index or use exact match
SELECT id FROM guests WHERE email = 'test@example.com';
```

## 🎯 Integration with Application

### Method 1: Validate Before Execution

```javascript
// Node.js example
async function executeQuery(sql) {
    // Validate query first
    const validation = await pool.query(
        'SELECT * FROM validate_query_pattern($1)',
        [sql]
    );

    if (!validation.rows[0].is_valid) {
        throw new Error(validation.rows[0].error_message);
    }

    // Execute if valid
    return await pool.query(sql);
}
```

### Method 2: Use Safe Query Builder

```javascript
// Build safe query with automatic tenant isolation
async function safeQuery(tableName, columns, whereClause, tenantId) {
    const safeSql = await pool.query(
        'SELECT build_safe_tenant_query($1, $2, $3)',
        [`SELECT ${columns.join(', ')} FROM ${tableName} ${whereClause}`, tenantId, true]
    );

    return await pool.query(safeSql.rows[0].build_safe_tenant_query);
}
```

### Method 3: Log All Access

```javascript
// Log tenant data access
async function logAccess(tenantId, userId, query, resultCount, req) {
    await pool.query(
        'SELECT log_tenant_access($1, $2, $3, $4, $5, $6)',
        [tenantId, userId, query, resultCount, req.ip, req.sessionID]
    );
}
```

## 📊 Monitoring & Maintenance

### Daily Checks

```sql
-- Check for queries with efficiency issues
SELECT COUNT(*) as inefficient_queries
FROM v_query_efficiency_monitor
WHERE efficiency_status != 'OK';

-- Monitor suspicious access
SELECT COUNT(*) as suspicious_access_count
FROM v_suspicious_access_patterns;
```

### Weekly Reports

```sql
-- Top slow queries
SELECT
    query,
    mean_exec_time,
    calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Audit summary by user
SELECT
    accessed_by,
    COUNT(*) as access_count,
    COUNT(*) FILTER (WHERE was_suspicious) as suspicious_count
FROM tenant_access_audit
WHERE access_timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY accessed_by
ORDER BY suspicious_count DESC;
```

## 🔧 Configuration

### Adjust Query Logging

```sql
-- Log queries slower than 100ms
ALTER DATABASE tartware SET log_min_duration_statement = 100;

-- Log all queries (high overhead)
ALTER DATABASE tartware SET log_statement = 'all';

-- Log only DDL changes
ALTER DATABASE tartware SET log_statement = 'ddl';
```

### Adjust Cost Thresholds

Edit functions to change thresholds:
- `estimate_query_cost()` - default cost threshold: 10,000
- `estimate_query_cost()` - default rows threshold: 100,000

## 🧪 Testing

Run verification script to ensure everything works:

```bash
psql -U postgres -d tartware -f verify-triggers.sql
```

**Tests performed:**
- ✅ All 9 functions installed
- ✅ All 3 views created
- ✅ Audit table exists
- ✅ Extensions enabled
- ✅ Query validation works
- ✅ Tenant isolation works
- ✅ Safe query builder works

## ⚠️ Important Notes

### PostgreSQL Limitations

**Event triggers cannot intercept SELECT statements** in PostgreSQL. This is a platform limitation.

**Solution:** Use application-layer validation by calling `validate_query_pattern()` before executing queries.

### Performance Impact

- ✅ Validation functions: **Minimal overhead** (milliseconds)
- ✅ Query monitoring: **Low overhead** with pg_stat_statements
- ⚠️ Access logging: **Medium overhead** (use selectively)

### Production Recommendations

1. **Always** validate queries in application layer
2. **Enable** pg_stat_statements for monitoring
3. **Log** tenant access for compliance (configurable)
4. **Review** v_query_efficiency_monitor weekly
5. **Alert** on suspicious_access_patterns

## 📚 Related Documentation

- [Main Scripts README](../README.md)
- [Soft Delete Policy](../SOFT_DELETE_POLICY.md)
- [Verification Guide](../VERIFICATION_GUIDE.md)

## 🆘 Troubleshooting

### Issue: pg_stat_statements not available

```sql
-- Install extension
CREATE EXTENSION pg_stat_statements;

-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'

-- Restart PostgreSQL
sudo systemctl restart postgresql
```

### Issue: Functions not working

```bash
# Re-run installation
psql -U postgres -d tartware -f 00-create-all-efficiency-triggers.sql

# Verify installation
psql -U postgres -d tartware -f verify-triggers.sql
```

### Issue: Too many audit records

```sql
-- Clean old audit records (keep last 90 days)
DELETE FROM tenant_access_audit
WHERE access_timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- Or disable auditing for non-critical queries
-- Modify log_tenant_access() to filter by query type
```

## 📈 Future Enhancements

Planned improvements:
- [ ] Query rewrite engine for automatic optimization
- [ ] Machine learning for anomaly detection
- [ ] Real-time alerting for security violations
- [ ] Query performance baselines and regression detection
- [ ] Integration with application metrics (Prometheus/Grafana)

---

**Created:** 2025-10-15
**Last Updated:** 2025-10-15
**Version:** 1.0
