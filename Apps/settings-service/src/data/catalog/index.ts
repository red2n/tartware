import type { RawCategory } from "../catalog-types.js";

import { ADMIN_USER_MANAGEMENT } from "./admin-user-management.js";
import { ADVANCED_TRENDING } from "./advanced-trending.js";
import { APPROVAL_WORKFLOWS } from "./approval-workflows.js";
import { BOOKING_ENGINE_GUEST } from "./booking-engine-guest.js";
import { COMMUNICATION_NOTIFICATIONS } from "./communication-notifications.js";
import { HOUSEKEEPING_MAINTENANCE_OPERATIONS } from "./housekeeping-maintenance-operations.js";
import { INTEGRATION_CHANNEL_MANAGEMENT } from "./integration-channel-management.js";
import { PROPERTY_TENANT_PROFILE } from "./property-tenant-profile.js";
import { RATE_PRICING_FINANCIAL } from "./rate-pricing-financial.js";
import { REPORTING_ANALYTICS_NIGHT_AUDIT } from "./reporting-analytics-night-audit.js";
import { ROOM_UNIT_INVENTORY } from "./room-unit-inventory.js";
import { SECURITY_COMPLIANCE_BACKUP } from "./security-compliance-backup.js";
import { UI_LOCALIZATION_CUSTOM } from "./ui-localization-custom.js";

export const catalogCategories: RawCategory[] = [
  ADMIN_USER_MANAGEMENT,
  PROPERTY_TENANT_PROFILE,
  ROOM_UNIT_INVENTORY,
  RATE_PRICING_FINANCIAL,
  APPROVAL_WORKFLOWS,
  INTEGRATION_CHANNEL_MANAGEMENT,
  BOOKING_ENGINE_GUEST,
  HOUSEKEEPING_MAINTENANCE_OPERATIONS,
  REPORTING_ANALYTICS_NIGHT_AUDIT,
  COMMUNICATION_NOTIFICATIONS,
  SECURITY_COMPLIANCE_BACKUP,
  UI_LOCALIZATION_CUSTOM,
  ADVANCED_TRENDING,
];
