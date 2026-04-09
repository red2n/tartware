# GAP-23: UI — Financial Audit Log Viewer

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §12.1

## Current State
- `audit_logs` table exists with comprehensive schema
- **No billing-service route to query audit_logs** (see GAP-09)
- **No UI to view audit trail**

## Work Required (depends on GAP-09)

### UI — `accounts/audit-trail/`
1. Audit log list with filters: entity type, user, date range, severity, action category
2. Detail view: old/new values diff display
3. PCI-relevant flag indicator
4. Export to CSV for compliance review
5. Timeline view for a specific entity (all changes to folio X)
