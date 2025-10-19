-- =====================================================
-- 58_staff_tasks_indexes.sql
-- Staff Tasks Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating staff_tasks indexes...'

CREATE INDEX idx_staff_tasks_tenant ON staff_tasks(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_property ON staff_tasks(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_number ON staff_tasks(task_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_type ON staff_tasks(task_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_to ON staff_tasks(assigned_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_department ON staff_tasks(assigned_department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_priority ON staff_tasks(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_status ON staff_tasks(task_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_pending ON staff_tasks(task_status) WHERE task_status IN ('pending', 'assigned') AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_urgent ON staff_tasks(is_urgent, priority) WHERE is_urgent = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_due_date ON staff_tasks(due_date) WHERE due_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_overdue ON staff_tasks(is_overdue) WHERE is_overdue = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_room ON staff_tasks(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_reservation ON staff_tasks(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_guest ON staff_tasks(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_completed ON staff_tasks(completed, completed_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_verification ON staff_tasks(requires_verification, verified) WHERE requires_verification = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_recurring ON staff_tasks(is_recurring, recurrence_pattern) WHERE is_recurring = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_blocked ON staff_tasks(is_blocked) WHERE is_blocked = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_sla ON staff_tasks(sla_breached) WHERE sla_breached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_checklist ON staff_tasks USING gin(checklist_items) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_issues ON staff_tasks USING gin(issues) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_metadata ON staff_tasks USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_tags ON staff_tasks USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_staff_tasks_property_status ON staff_tasks(property_id, task_status, priority DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_status ON staff_tasks(assigned_to, task_status, due_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_department_status ON staff_tasks(assigned_department, task_status, priority DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_due_today ON staff_tasks(property_id, due_date, task_status) WHERE due_date = CURRENT_DATE AND task_status NOT IN ('completed', 'cancelled') AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_in_progress ON staff_tasks(property_id, assigned_to, task_status) WHERE task_status = 'in_progress' AND is_deleted = FALSE;

\echo 'Staff Tasks indexes created successfully!'
