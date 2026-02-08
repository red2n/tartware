-- Migration: Register new PMS industry-standard commands
-- Date: 2026-02-08
-- Commands: billing.payment.authorize, billing.night_audit.execute, reservation.no_show

-- System actor user (FK target for created_by / updated_by audit fields)
INSERT INTO users (id, tenant_id, username, email, password_hash, first_name, last_name)
VALUES ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'system', 'system@tartware.local', 'NOLOGIN', 'System', 'Actor')
ON CONFLICT (id) DO NOTHING;

-- Add AUTHORIZED to payment_status enum (for pre-auth/deposit holds)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'AUTHORIZED';

-- Command templates (defines what commands exist, FK parent of command_routes)
INSERT INTO command_templates (command_name, default_target_service, tenant_id, description)
VALUES
  ('billing.payment.authorize', 'billing-service', '11111111-1111-1111-1111-111111111111', 'Pre-authorize a payment hold on a guest card'),
  ('billing.night_audit.execute', 'billing-service', '11111111-1111-1111-1111-111111111111', 'Execute nightly audit: post room charges, mark no-shows, advance business date'),
  ('reservation.no_show', 'reservations-command-service', '11111111-1111-1111-1111-111111111111', 'Mark a reservation as no-show and apply fee')
ON CONFLICT DO NOTHING;

-- Command routes (per-environment routing for command dispatch)
INSERT INTO command_routes (command_name, service_id, topic, environment)
VALUES
  ('billing.payment.authorize', 'billing-service', 'commands.primary', 'development'),
  ('billing.night_audit.execute', 'billing-service', 'commands.primary', 'development'),
  ('reservation.no_show', 'reservations-command-service', 'commands.primary', 'development')
ON CONFLICT DO NOTHING;
