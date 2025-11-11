export interface HousekeepingTask {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  room_number: string;
  task_type: string;
  priority?: string;
  status: string;
  status_display: string;
  assigned_to?: string;
  assigned_at?: string;
  scheduled_date: string;
  scheduled_time?: string;
  started_at?: string;
  completed_at?: string;
  inspected_by?: string;
  inspected_at?: string;
  inspection_passed?: boolean;
  is_guest_request: boolean;
  special_instructions?: string;
  notes?: string;
  issues_found?: string;
  credits?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  version: string;
}
