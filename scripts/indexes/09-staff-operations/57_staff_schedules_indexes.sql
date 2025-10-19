-- =====================================================
-- 57_staff_schedules_indexes.sql
-- Staff Schedules Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating staff_schedules indexes...'

CREATE INDEX idx_staff_schedules_tenant ON staff_schedules(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_property ON staff_schedules(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_user ON staff_schedules(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_department ON staff_schedules(department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_date ON staff_schedules(schedule_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_week ON staff_schedules(week_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_shift_type ON staff_schedules(shift_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_status ON staff_schedules(schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_checked_in ON staff_schedules(checked_in, check_in_time) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_checked_out ON staff_schedules(checked_out) WHERE checked_out = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_overtime ON staff_schedules(is_overtime, overtime_approved) WHERE is_overtime = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_late ON staff_schedules(is_late) WHERE is_late = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_swap ON staff_schedules(is_swap_request, swap_status) WHERE is_swap_request = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_conflicts ON staff_schedules(has_conflicts, conflict_resolved) WHERE has_conflicts = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_leave ON staff_schedules(is_leave, leave_type) WHERE is_leave = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_published ON staff_schedules(is_published, published_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_approval ON staff_schedules(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_assigned_tasks ON staff_schedules USING gin(assigned_tasks) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_metadata ON staff_schedules USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_tags ON staff_schedules USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_staff_schedules_property_date ON staff_schedules(property_id, schedule_date, department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_user_date ON staff_schedules(user_id, schedule_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_department_date ON staff_schedules(department, schedule_date, shift_type) WHERE is_deleted = FALSE;
-- Simplified index without CURRENT_DATE (not immutable)
-- Applications can filter by schedule_date >= CURRENT_DATE at query time using this index
CREATE INDEX idx_staff_schedules_upcoming ON staff_schedules(property_id, schedule_date, scheduled_start_time)
WHERE schedule_date IS NOT NULL AND is_deleted = FALSE;

-- Simplified index without CURRENT_DATE (not immutable)
-- Applications can filter by schedule_date = CURRENT_DATE at query time using this index
CREATE INDEX idx_staff_schedules_current_shift ON staff_schedules(property_id, schedule_date, checked_in)
WHERE schedule_date IS NOT NULL AND checked_in = TRUE AND checked_out = FALSE AND is_deleted = FALSE;

\echo 'Staff Schedules indexes created successfully!'
