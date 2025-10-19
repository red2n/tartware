-- =====================================================
-- 34_guest_preferences_indexes.sql
-- Indexes for guest_preferences table
--
-- Performance optimization for guest personalization
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_guest_preferences_guest;
DROP INDEX IF EXISTS idx_guest_preferences_property;
DROP INDEX IF EXISTS idx_guest_preferences_category;
DROP INDEX IF EXISTS idx_guest_preferences_active;
DROP INDEX IF EXISTS idx_guest_preferences_mandatory;

-- Guest preference lookup (most common query)
CREATE INDEX idx_guest_preferences_guest
    ON guest_preferences(guest_id, preference_category, is_active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_guest_preferences_guest IS 'Guest preference lookup';

-- Property-specific preferences
CREATE INDEX idx_guest_preferences_property
    ON guest_preferences(property_id, guest_id, is_active)
    WHERE deleted_at IS NULL AND property_id IS NOT NULL;

COMMENT ON INDEX idx_guest_preferences_property IS 'Property-specific guest preferences';

-- Category filtering
CREATE INDEX idx_guest_preferences_category
    ON guest_preferences(guest_id, preference_category, priority DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_guest_preferences_category IS 'Filter by preference category';

-- Active preferences
CREATE INDEX idx_guest_preferences_active
    ON guest_preferences(guest_id, is_active, priority DESC)
    WHERE deleted_at IS NULL AND is_active = TRUE;

COMMENT ON INDEX idx_guest_preferences_active IS 'Active preferences by priority';

-- Mandatory preferences (must honor)
CREATE INDEX idx_guest_preferences_mandatory
    ON guest_preferences(guest_id, is_mandatory, preference_category)
    WHERE deleted_at IS NULL AND is_mandatory = TRUE;

COMMENT ON INDEX idx_guest_preferences_mandatory IS 'Critical guest requirements';

-- Success message
\echo '✓ Indexes created: guest_preferences (34/37)'
\echo '  - 5 performance indexes'
\echo '  - Personalization optimized'
\echo ''
