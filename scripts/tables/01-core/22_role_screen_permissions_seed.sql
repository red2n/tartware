-- =====================================================
-- 22_role_screen_permissions_seed.sql
-- Default screen permissions per role
-- Inserts default visibility for all defined screens
-- Safe to re-run (ON CONFLICT DO NOTHING)
-- Date: 2026-03-11
-- =====================================================

\echo 'Seeding default role_screen_permissions...'

-- Default screen visibility per role.
-- Screen keys match UI route identifiers.
-- OWNER/ADMIN see everything, MANAGER/STAFF/VIEWER get progressively fewer screens.
-- Admins can update these per-tenant through the UI.

DO $$
DECLARE
    v_tenant RECORD;
    v_screens TEXT[] := ARRAY[
        'dashboard',
        'reservations',
        'groups',
        'guests',
        'rooms',
        'room-types',
        'buildings',
        'rates',
        'rate-calendar',
        'packages',
        'housekeeping',
        'billing',
        'accounts-receivable',
        'cashiering',
        'night-audit',
        'tax-config',
        'reports',
        'settings',
        'command-management',
        'users'
    ];
    v_screen TEXT;
    v_role tenant_role;
    v_visible BOOLEAN;
BEGIN
    FOR v_tenant IN SELECT id FROM tenants WHERE COALESCE(is_deleted, false) = false
    LOOP
        FOREACH v_screen IN ARRAY v_screens
        LOOP
            -- For each role, determine default visibility
            FOREACH v_role IN ARRAY ARRAY['OWNER','ADMIN','MANAGER','STAFF','VIEWER']::tenant_role[]
            LOOP
                v_visible := CASE
                    -- OWNER and ADMIN see everything
                    WHEN v_role IN ('OWNER', 'ADMIN') THEN true
                    -- MANAGER sees most screens except admin-only
                    WHEN v_role = 'MANAGER' THEN v_screen NOT IN ('settings', 'command-management', 'users', 'tax-config')
                    -- STAFF sees operational screens
                    WHEN v_role = 'STAFF' THEN v_screen IN ('dashboard', 'reservations', 'guests', 'rooms', 'housekeeping')
                    -- VIEWER sees read-only screens
                    WHEN v_role = 'VIEWER' THEN v_screen IN ('dashboard', 'guests')
                    ELSE false
                END;

                INSERT INTO role_screen_permissions (tenant_id, role, screen_key, is_visible)
                VALUES (v_tenant.id, v_role, v_screen, v_visible)
                ON CONFLICT (tenant_id, role, screen_key) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

\echo 'Default role_screen_permissions seeded successfully!'
