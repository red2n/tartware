export interface Room {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  room_type_id?: string;
  room_type_name?: string;
  room_number: string;
  room_name?: string;
  floor?: string;
  building?: string;
  wing?: string;
  status: string;
  status_display: string;
  housekeeping_status: string;
  housekeeping_display: string;
  maintenance_status: string;
  maintenance_display: string;
  is_blocked: boolean;
  block_reason?: string;
  is_out_of_order: boolean;
  out_of_order_reason?: string;
  expected_ready_date?: string;
  housekeeping_notes?: string;
  updated_at?: string;
  version: string;
}
