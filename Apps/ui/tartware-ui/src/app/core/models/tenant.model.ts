export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: 'INDEPENDENT' | 'CHAIN' | 'FRANCHISE' | 'MANAGEMENT_COMPANY';
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'CANCELLED';
  email?: string;
  phone?: string;
  country?: string;
  config?: any;
  subscription?: any;
  metadata?: any;
  created_at: string;
  deleted_at?: string | null;
  version: string;
  property_count?: number;
  user_count?: number;
  active_properties?: number;
}
