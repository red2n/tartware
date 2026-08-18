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
        'loyalty',
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
        'invoices',
        'fiscal-periods',
        'commissions',
        'reports',
        'settings',
        'command-management',
        'users',
        'modules',
        'webhooks',
        -- Data breach register (GDPR Art. 33). Statutory filings, so it is not a
        -- general-staff screen: OWNER/ADMIN only by default, like 'settings'.
        'compliance',
        -- OTA / channel-manager health and recovery actions. Its actions dispatch
        -- commands that require MANAGER, so it follows the default MANAGER-and-above
        -- rule rather than being listed as admin-only.
        'channels',
        -- Sales & catering (ui-gaps/13). Two keys, because the two screens sit at
        -- different privilege levels and the backend already draws that line:
        -- POST /v1/event-bookings requires STAFF, POST /v1/meeting-rooms requires
        -- MANAGER. 'events' is therefore in the STAFF list below; 'meeting-rooms',
        -- which is function-space reference data, is not.
        'events',
        'meeting-rooms'
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
                    WHEN v_role = 'MANAGER' THEN v_screen NOT IN ('settings', 'command-management', 'users', 'tax-config', 'compliance')
                    -- STAFF sees operational screens
                    WHEN v_role = 'STAFF' THEN v_screen IN ('dashboard', 'reservations', 'guests', 'rooms', 'housekeeping', 'rates', 'events')
                    -- VIEWER sees read-only screens
                    WHEN v_role = 'VIEWER' THEN v_screen IN ('dashboard', 'guests')
                    ELSE false
                END;

                INSERT INTO role_screen_permissions (tenant_id, role, screen_key, is_visible)
                VALUES (v_tenant.id, v_role, v_screen, v_visible)
                ON CONFLICT (tenant_id, role, screen_key) 
                DO UPDATE SET is_visible = EXCLUDED.is_visible;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

\echo 'Default role_screen_permissions seeded successfully!'
