-- =====================================================
-- 03_enforce_tenant_isolation.sql
-- Enforce Tenant Isolation in Queries
-- Date: 2025-10-15
--
-- Purpose: Ensure all queries on multi-tenant tables
--          include tenant_id filter to prevent data leaks
-- =====================================================

\c tartware

-- =====================================================
-- Function: validate_tenant_isolation
-- Purpose: Check if query properly filters by tenant_id
-- =====================================================

CREATE OR REPLACE FUNCTION validate_tenant_isolation(
    p_query TEXT,
    p_expected_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
    is_safe BOOLEAN,
    risk_level TEXT,
    message TEXT,
    affected_tables TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_normalized_query TEXT;
    v_multi_tenant_tables TEXT[] := ARRAY[
        'properties', 'guests', 'room_types', 'rooms', 'rates',
        'reservations', 'reservation_status_history', 'payments',
        'invoices', 'invoice_items', 'services', 'reservation_services',
        'housekeeping_tasks', 'channel_mappings', 'analytics_metrics',
        'analytics_metric_dimensions', 'analytics_reports', 'report_property_ids',
        'user_tenant_associations', 'room_availability'
    ];
    v_table TEXT;
    v_found_tables TEXT[] := '{}';
    v_has_tenant_filter BOOLEAN;
BEGIN
    v_normalized_query := LOWER(REGEXP_REPLACE(p_query, '\s+', ' ', 'g'));

    -- Check which multi-tenant tables are referenced
    FOREACH v_table IN ARRAY v_multi_tenant_tables
    LOOP
        IF v_normalized_query ~ format('from\s+%s|join\s+%s', v_table, v_table) THEN
            v_found_tables := array_append(v_found_tables, v_table);
        END IF;
    END LOOP;

    -- If no multi-tenant tables found, query is safe
    IF array_length(v_found_tables, 1) IS NULL THEN
        RETURN QUERY SELECT
            TRUE,
            'SAFE'::TEXT,
            'Query does not access multi-tenant tables'::TEXT,
            '{}'::TEXT[];
        RETURN;
    END IF;

    -- Check if query has tenant_id filter
    v_has_tenant_filter := v_normalized_query ~ 'tenant_id\s*=';

    -- Validate based on findings
    IF NOT v_has_tenant_filter THEN
        RETURN QUERY SELECT
            FALSE,
            'CRITICAL'::TEXT,
            format('SECURITY RISK: Query accesses multi-tenant tables without tenant_id filter! This could expose data from other tenants.')::TEXT,
            v_found_tables;
    ELSIF p_expected_tenant_id IS NOT NULL AND v_normalized_query !~ p_expected_tenant_id::TEXT THEN
        RETURN QUERY SELECT
            FALSE,
            'HIGH'::TEXT,
            format('Tenant ID mismatch: Query uses different tenant_id than expected')::TEXT,
            v_found_tables;
    ELSE
        RETURN QUERY SELECT
            TRUE,
            'SAFE'::TEXT,
            'Query properly filters by tenant_id'::TEXT,
            v_found_tables;
    END IF;
END;
$$;

COMMENT ON FUNCTION validate_tenant_isolation(TEXT, UUID) IS
'Validate that queries on multi-tenant tables properly filter by tenant_id';

-- =====================================================
-- Function: build_safe_tenant_query
-- Purpose: Generate query with tenant isolation enforced
-- =====================================================

CREATE OR REPLACE FUNCTION build_safe_tenant_query(
    p_base_query TEXT,
    p_tenant_id UUID,
    p_include_soft_delete BOOLEAN DEFAULT TRUE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_query TEXT;
    v_where_clause TEXT := '';
    v_has_where BOOLEAN;
BEGIN
    -- Validate tenant_id
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id cannot be NULL for multi-tenant queries';
    END IF;

    v_query := p_base_query;
    v_has_where := LOWER(p_base_query) ~ 'where';

    -- Build WHERE clause additions
    IF NOT v_has_where THEN
        v_where_clause := format(' WHERE tenant_id = ''%s''', p_tenant_id);
    ELSE
        v_where_clause := format(' AND tenant_id = ''%s''', p_tenant_id);
    END IF;

    -- Add soft delete filter if requested
    IF p_include_soft_delete THEN
        v_where_clause := v_where_clause || ' AND deleted_at IS NULL';
    END IF;

    -- Insert WHERE clause before ORDER BY, GROUP BY, or LIMIT
    IF v_query ~* '(order by|group by|limit|offset)' THEN
        v_query := REGEXP_REPLACE(
            v_query,
            '(order by|group by|limit|offset)',
            v_where_clause || ' \1',
            'i'
        );
    ELSE
        v_query := v_query || v_where_clause;
    END IF;

    RETURN v_query;
END;
$$;

COMMENT ON FUNCTION build_safe_tenant_query(TEXT, UUID, BOOLEAN) IS
'Build query with automatic tenant_id and soft delete filters';

-- =====================================================
-- Function: audit_tenant_access
-- Purpose: Log tenant data access for security auditing
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_access_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    accessed_by VARCHAR(100) NOT NULL,
    query_pattern TEXT NOT NULL,
    accessed_tables TEXT[] NOT NULL,
    record_count INTEGER,
    access_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    session_id VARCHAR(100),
    was_suspicious BOOLEAN DEFAULT FALSE,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_access_audit_tenant
    ON tenant_access_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_access_audit_timestamp
    ON tenant_access_audit(access_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_access_audit_suspicious
    ON tenant_access_audit(was_suspicious) WHERE was_suspicious = TRUE;

COMMENT ON TABLE tenant_access_audit IS
'Audit log for tenant data access - tracks who accessed what data and when';

CREATE OR REPLACE FUNCTION log_tenant_access(
    p_tenant_id UUID,
    p_accessed_by VARCHAR(100),
    p_query TEXT,
    p_record_count INTEGER DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_session_id VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_audit_id UUID;
    v_normalized_query TEXT;
    v_accessed_tables TEXT[];
    v_is_suspicious BOOLEAN := FALSE;
    v_multi_tenant_tables TEXT[] := ARRAY[
        'properties', 'guests', 'room_types', 'rooms', 'rates',
        'reservations', 'payments', 'invoices'
    ];
    v_table TEXT;
BEGIN
    v_normalized_query := LOWER(REGEXP_REPLACE(p_query, '\s+', ' ', 'g'));

    -- Extract accessed tables
    FOREACH v_table IN ARRAY v_multi_tenant_tables
    LOOP
        IF v_normalized_query ~ format('from\s+%s|join\s+%s', v_table, v_table) THEN
            v_accessed_tables := array_append(v_accessed_tables, v_table);
        END IF;
    END LOOP;

    -- Check for suspicious patterns
    IF v_normalized_query ~ 'select\s+\*' THEN
        v_is_suspicious := TRUE;
    END IF;

    IF v_normalized_query !~ 'tenant_id' AND array_length(v_accessed_tables, 1) > 0 THEN
        v_is_suspicious := TRUE;
    END IF;

    IF v_normalized_query !~ 'where' AND array_length(v_accessed_tables, 1) > 0 THEN
        v_is_suspicious := TRUE;
    END IF;

    -- Insert audit record
    INSERT INTO tenant_access_audit (
        tenant_id,
        accessed_by,
        query_pattern,
        accessed_tables,
        record_count,
        ip_address,
        session_id,
        was_suspicious
    ) VALUES (
        p_tenant_id,
        p_accessed_by,
        LEFT(p_query, 500),
        v_accessed_tables,
        p_record_count,
        p_ip_address,
        p_session_id,
        v_is_suspicious
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION log_tenant_access IS
'Log tenant data access for security auditing and compliance';

-- =====================================================
-- View: Suspicious Access Patterns
-- =====================================================

CREATE OR REPLACE VIEW v_suspicious_access_patterns AS
SELECT
    tenant_id,
    accessed_by,
    COUNT(*) as suspicious_access_count,
    array_agg(DISTINCT query_pattern) as query_patterns,
    array_agg(DISTINCT unnest(accessed_tables)) as all_tables_accessed,
    MIN(access_timestamp) as first_suspicious_access,
    MAX(access_timestamp) as last_suspicious_access
FROM tenant_access_audit
WHERE was_suspicious = TRUE
    AND access_timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY tenant_id, accessed_by
HAVING COUNT(*) > 5
ORDER BY COUNT(*) DESC;

COMMENT ON VIEW v_suspicious_access_patterns IS
'Monitor users with multiple suspicious access patterns in the last 7 days';

-- =====================================================
-- Example Usage
-- =====================================================

\echo ''
\echo '======================================================'
\echo '  TENANT ISOLATION ENFORCEMENT - EXAMPLES'
\echo '======================================================'
\echo ''
\echo 'Example 1: Validate query has tenant isolation'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM validate_tenant_isolation('
\echo '    ''SELECT id, name FROM guests WHERE tenant_id = ''''uuid-here'''' AND deleted_at IS NULL'''
\echo ');'
\echo ''
\echo 'Example 2: Build safe query with tenant filter'
\echo '----------------------------------------------------'
\echo 'SELECT build_safe_tenant_query('
\echo '    ''SELECT id, name FROM guests'','
\echo '    ''uuid-here''::UUID,'
\echo '    TRUE'
\echo ');'
\echo ''
\echo 'Example 3: Log tenant access for auditing'
\echo '----------------------------------------------------'
\echo 'SELECT log_tenant_access('
\echo '    ''tenant-uuid''::UUID,'
\echo '    ''user@example.com'','
\echo '    ''SELECT id FROM reservations WHERE tenant_id = ?'','
\echo '    150,'
\echo '    ''192.168.1.1''::INET,'
\echo '    ''session-12345'''
\echo ');'
\echo ''
\echo 'Example 4: Monitor suspicious access'
\echo '----------------------------------------------------'
\echo 'SELECT * FROM v_suspicious_access_patterns;'
\echo ''

\echo ''
\echo '✅ Tenant isolation enforcement installed successfully!'
\echo ''
