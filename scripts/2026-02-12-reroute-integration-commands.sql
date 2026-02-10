-- =============================================
-- Migration: Route integration commands to reservations-command-service
-- Purpose: Until a dedicated integrations-command-service is created,
--          handle OTA/GDS commands in the reservations service.
-- Date: 2026-02-12
-- =============================================

UPDATE command_routes
SET service_id = 'reservations-command-service',
    updated_at = NOW()
WHERE command_name IN (
  'integration.ota.sync_request',
  'integration.ota.rate_push',
  'integration.webhook.retry',
  'integration.mapping.update'
)
AND service_id = 'integrations-command-service';
