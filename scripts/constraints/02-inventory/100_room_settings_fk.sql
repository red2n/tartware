-- =====================================================
-- 100_room_settings_fk.sql
-- Foreign key linking room_settings to rooms inventory
-- Date: 2025-11-12
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for room_settings...'

ALTER TABLE room_settings
    ADD CONSTRAINT fk_room_settings_room
    FOREIGN KEY (room_id)
    REFERENCES rooms(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

\echo '✓ Room settings foreign key created successfully!'
