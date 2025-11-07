import type { TenantWithRelations } from '@tartware/schemas';

// Tenant type with version as string (for JSON serialization)
export type Tenant = Omit<TenantWithRelations, 'version' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  version: string;
  created_at: string | Date;
  updated_at?: string | Date;
  deleted_at?: string | Date | null;
};
