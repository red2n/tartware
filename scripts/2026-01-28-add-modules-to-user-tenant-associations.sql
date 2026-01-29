-- Add modules column to user_tenant_associations for tenant module scoping
-- Schema-first: keep in sync with schema/src/schemas/01-core/user-tenant-associations.ts

ALTER TABLE public.user_tenant_associations
  ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '[]'::jsonb;
