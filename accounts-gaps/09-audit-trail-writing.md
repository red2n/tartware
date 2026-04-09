# GAP-09: Financial Audit Trail — Not Written By Billing Service

**Priority:** P0 | **Risk:** 🔴 HIGH | **Ref:** BA §12.1

## Current State
- `audit_logs` table exists with comprehensive schema (scripts/tables/07-analytics/27)
- Schema includes PCI-DSS, SOC 2, GDPR compliance fields
- `night_audit_log` table is written to (night audit runs are logged)
- **billing-service does NOT write to `audit_logs`** for any financial operation
- Only structured logging (Pino) exists — not a compliance audit trail

## What the Doc Requires
Every financial operation must create an immutable audit record:
- **Never deleted** (table has no `is_deleted` column — by design)
- **Append-only** — no UPDATE, no DELETE on audit_logs
- Fields: who, what, when, old_values, new_values, changed_fields
- `is_pci_relevant = true` for payment operations
- `action_category = 'FINANCIAL'` for all billing operations

### Operations That Must Be Audited
| Operation | Severity | PCI Relevant |
|-----------|----------|-------------|
| Payment capture | INFO | Yes |
| Payment refund | WARNING | Yes |
| Payment void | WARNING | Yes |
| Charge post | INFO | No |
| Charge void | WARNING | No |
| Invoice finalize | INFO | No |
| Invoice void | CRITICAL | No |
| Folio close | INFO | No |
| Folio reopen | WARNING | No |
| Write-off | CRITICAL | No |
| Fiscal period close/lock | INFO | No |
| Night audit | INFO | No |
| Comp post | WARNING | No |
| Chargeback | CRITICAL | Yes |

## Work Required

### Backend
1. Create `billing-service/src/lib/audit-logger.ts` — utility to INSERT audit_logs
2. Call from every command handler after successful operation
3. Include old_values/new_values for update operations
4. Set PCI/GDPR flags based on operation type
5. Wrap in separate try/catch — audit failure must not block the operation
6. Add route: `GET /v1/billing/audit-trail` — query audit_logs for financial operations

### UI
- Audit trail viewer in accounts section (filterable by entity, user, date, severity)
- Detail view showing old/new values diff

## Impact
Without audit trail, SOC 2 / PCI-DSS compliance is not achievable. Financial forensics and dispute resolution have no evidence trail.
