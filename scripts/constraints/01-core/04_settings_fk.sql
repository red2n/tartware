-- =====================================================
-- 04_settings_fk.sql
-- Foreign Key Constraints for settings tables
-- Date: 2025-11-12
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for settings tables...'

-- setting_categories ⇢ users (audit columns)
ALTER TABLE setting_categories
    ADD CONSTRAINT fk_setting_categories_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE setting_categories
    ADD CONSTRAINT fk_setting_categories_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- setting_definitions ⇢ setting_categories / users
ALTER TABLE setting_definitions
    ADD CONSTRAINT fk_setting_definitions_category
    FOREIGN KEY (category_id)
    REFERENCES setting_categories(category_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE setting_definitions
    ADD CONSTRAINT fk_setting_definitions_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE setting_definitions
    ADD CONSTRAINT fk_setting_definitions_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- tenant_settings ⇢ tenants / setting_definitions / users
ALTER TABLE tenant_settings
    ADD CONSTRAINT fk_tenant_settings_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE tenant_settings
    ADD CONSTRAINT fk_tenant_settings_definition
    FOREIGN KEY (setting_id)
    REFERENCES setting_definitions(setting_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE tenant_settings
    ADD CONSTRAINT fk_tenant_settings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE tenant_settings
    ADD CONSTRAINT fk_tenant_settings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- property_settings ⇢ properties / setting_definitions / users
ALTER TABLE property_settings
    ADD CONSTRAINT fk_property_settings_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE property_settings
    ADD CONSTRAINT fk_property_settings_definition
    FOREIGN KEY (setting_id)
    REFERENCES setting_definitions(setting_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE property_settings
    ADD CONSTRAINT fk_property_settings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE property_settings
    ADD CONSTRAINT fk_property_settings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- room_settings ⇢ setting_definitions / users
ALTER TABLE room_settings
    ADD CONSTRAINT fk_room_settings_definition
    FOREIGN KEY (setting_id)
    REFERENCES setting_definitions(setting_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE room_settings
    ADD CONSTRAINT fk_room_settings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE room_settings
    ADD CONSTRAINT fk_room_settings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- user_settings ⇢ users / setting_definitions / users (audit)
ALTER TABLE user_settings
    ADD CONSTRAINT fk_user_settings_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE user_settings
    ADD CONSTRAINT fk_user_settings_definition
    FOREIGN KEY (setting_id)
    REFERENCES setting_definitions(setting_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE user_settings
    ADD CONSTRAINT fk_user_settings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE user_settings
    ADD CONSTRAINT fk_user_settings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

\echo '✓ Settings foreign keys created successfully!'
