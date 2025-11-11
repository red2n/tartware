export interface Guest {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  title?: string;
  email: string;
  phone?: string;
  secondary_phone?: string;
  address?: Record<string, unknown>;
  loyalty_tier?: string;
  loyalty_points?: number;
  vip_status: boolean;
  marketing_consent?: boolean;
  communication_preferences?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  total_bookings: number;
  total_nights: number;
  total_revenue: number;
  last_stay_date?: string;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  version: string;
}
