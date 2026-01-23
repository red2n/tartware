-- =====================================================
-- setting_categories.sql
-- Top-level setting categories
-- =====================================================

\c tartware \echo 'Creating setting_categories table...'

CREATE TABLE IF NOT EXISTS setting_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique identifier
    category_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., ADMIN_USER_MGMT
    display_name VARCHAR(255) NOT NULL, -- e.g., "Admin and User Management"
    description TEXT NOT NULL, -- Short descriptor for navigation
    documentation TEXT, -- Full markdown sourced from TODO.md
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Audit fields
    created_by UUID, -- Audit fields
    updated_by UUID -- Audit fields
);

COMMENT ON TABLE setting_categories IS 'Top-level setting categories aligned with consolidated PMS admin sections.';

COMMENT ON COLUMN setting_categories.documentation IS 'Markdown payload preserving the detailed narrative from TODO.md.';

\echo '✓ setting_categories created.'
