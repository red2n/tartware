# GAP-17: Group Master Billing Management

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Ref:** BA §7.1

## Current State
- Folio routing rules support group billing (auto_apply_to_group, group_booking_id fields)
- Folio types include MASTER
- Clone template for routing rules exists
- **No dedicated group master billing workflow**:
  - No auto-creation of master folio for group bookings
  - No auto-routing rule setup for group room charges → master folio
  - No group billing summary/split view
  - No group checkout workflow

## What the Doc Requires
When a group booking is created:
1. Auto-create master folio (folio_type = MASTER, linked to group_booking_id)
2. Auto-create routing rules: room charges for all group members → master folio
3. Incidentals stay on individual folios (configurable per group)
4. Group billing summary: total by category (rooms, F&B, taxes)
5. At group checkout: settle master folio first, then individual folios
6. Support split: X% to master (company), remainder to guest
7. Direct billing: master folio → city ledger → AR invoice

## Work Required

### Backend
1. Listen for group booking creation event → auto-create master folio
2. Auto-create routing rules for group members
3. Add route: `GET /v1/billing/groups/:groupId/summary` — group billing summary
4. Add command: `billing.group.checkout` — orchestrated group checkout
5. Group folio split configuration (company % vs guest %)

### UI
- Group billing tab in billing page
- Master folio management view
- Group checkout wizard

## Impact
Without group billing automation, front desk must manually create master folios and routing rules for every group — error-prone and time-consuming for large groups (100+ rooms).
