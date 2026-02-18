-- =====================================================
-- 19_user_ui_preferences.sql
-- User UI Preferences Table
-- Industry Standard: Per-user interface customization
-- Pattern: Structured preferences for home page, profile
--          display, dashboard layout, and notification settings
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- USER_UI_PREFERENCES TABLE
-- Fast-access structured preferences for user interface:
-- home page, dashboard layout, profile display, and
-- notification delivery preferences.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_ui_preferences (
    -- Primary Key
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),     -- Unique preference record

    -- Identity
    tenant_id UUID NOT NULL,                                       -- FK tenants.id
    user_id UUID NOT NULL,                                         -- FK users.id

    -- Home Page
    home_page VARCHAR(200) DEFAULT '/dashboard',                   -- Preferred landing page path
    home_page_dashboard_layout JSONB DEFAULT '[]'::JSONB,          -- Dashboard widget arrangement [{widget, position, size}]

    -- Profile Display
    profile_display_fields JSONB DEFAULT '[]'::JSONB,              -- Which profile fields to show in list views
    profile_history_display VARCHAR(30) DEFAULT 'COMPACT',         -- Profile history view: COMPACT, DETAILED, TIMELINE
    default_profile_tab VARCHAR(50) DEFAULT 'OVERVIEW',            -- Default tab when opening a profile: OVERVIEW, STAYS, BILLING, PREFERENCES, NOTES

    -- List & Grid Preferences
    default_page_size INTEGER DEFAULT 25,                          -- Default rows per page in list views
    default_sort_field VARCHAR(100),                                -- Default sort column
    default_sort_direction VARCHAR(4) DEFAULT 'ASC',               -- ASC or DESC

    -- Notification Preferences
    notification_sound_enabled BOOLEAN DEFAULT TRUE,               -- Play sound for in-app notifications
    notification_desktop_enabled BOOLEAN DEFAULT TRUE,             -- Show desktop/browser notifications
    notification_email_digest VARCHAR(20) DEFAULT 'IMMEDIATE',     -- IMMEDIATE, HOURLY, DAILY, NONE

    -- Visual Preferences
    theme VARCHAR(20) DEFAULT 'SYSTEM',                            -- LIGHT, DARK, SYSTEM
    language VARCHAR(10) DEFAULT 'en',                             -- ISO 639-1 language code
    timezone VARCHAR(50),                                          -- IANA timezone (e.g., America/New_York)
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',                  -- Preferred date format
    time_format VARCHAR(10) DEFAULT '24H',                         -- 12H or 24H
    currency_display VARCHAR(10) DEFAULT 'SYMBOL',                 -- SYMBOL ($), CODE (USD), or BOTH ($USD)

    -- Quick Access
    pinned_reports JSONB DEFAULT '[]'::JSONB,                      -- Pinned report IDs for quick access
    recent_searches JSONB DEFAULT '[]'::JSONB,                     -- Recent search history (max 20)
    favorite_properties UUID[] DEFAULT '{}',                       -- Favorite property IDs for multi-property users

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uq_user_ui_pref UNIQUE (tenant_id, user_id)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE user_ui_preferences IS 'Per-user UI preferences — home page, dashboard layout, profile display, theme, and notification settings';
COMMENT ON COLUMN user_ui_preferences.home_page IS 'Preferred landing page path after login (e.g., /dashboard, /reservations, /housekeeping)';
COMMENT ON COLUMN user_ui_preferences.profile_display_fields IS 'JSON array of field names to display in guest/company profile list views';
COMMENT ON COLUMN user_ui_preferences.profile_history_display IS 'How to render profile stay history: COMPACT (summary), DETAILED (full), TIMELINE (chronological)';
COMMENT ON COLUMN user_ui_preferences.home_page_dashboard_layout IS 'Widget arrangement: [{widget: "occupancy", position: {x:0,y:0}, size: {w:2,h:1}}]';
COMMENT ON COLUMN user_ui_preferences.pinned_reports IS 'JSON array of report IDs for quick-access sidebar';

\echo 'user_ui_preferences table created successfully!'
