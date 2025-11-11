export type ModuleId =
  | 'core'
  | 'finance-automation'
  | 'tenant-owner-portal'
  | 'facility-maintenance'
  | 'analytics-bi'
  | 'marketing-channel'
  | 'enterprise-api';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  tier: 'base' | 'add-on' | 'enterprise';
  category: string;
  features: string[];
}

export interface TenantModules {
  tenantId: string;
  modules: ModuleId[];
}
