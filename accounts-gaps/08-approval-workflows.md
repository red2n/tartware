# GAP-08: Financial Approval Workflows (Four-Eyes Principle)

**Priority:** P1 | **Risk:** 🔴 HIGH | **Ref:** BA §8.3, §9, §12.2

## Current State
- Write-off has `approved_by` field but no enforcement that approver ≠ requester
- Commission approval exists (PENDING → APPROVED → PAID) but single-user
- Fiscal period operations have no approval gate
- Invoice void has no approval requirement
- **No approval queue, no pending-approval state, no dual-authorization enforcement**

## What the Doc Requires

### High-Risk Operations Requiring Dual Approval
| Operation | Risk | Approval Level |
|-----------|------|----------------|
| Bad debt write-off | Fraud prevention | Manager + Finance Director |
| Comp > $500 | Budget control | GM approval |
| Invoice void (post-finalization) | Revenue integrity | Finance Manager |
| Fiscal period reopen | Compliance | Controller |
| Chargeback response > $1000 | Financial exposure | Revenue Manager |
| Folio reopen (post-checkout) | Audit trail | Finance Manager |
| Manual date roll (skip audit) | Process integrity | GM + Night Auditor |

### Four-Eyes Principle
- Requester ≠ Approver (enforced, not advisory)
- Approval must reference the request UUID
- Approval has expiry (24h default)
- Approval audit trail (who approved, when, what they saw)

## Work Required

### Backend
1. Create `approval_requests` table — generic approval queue
2. Create `billing-service/src/services/approval-service.ts`
3. Add approval gate to write-off, comp (>threshold), invoice void, fiscal reopen, folio reopen
4. Enforce requester ≠ approver in approval resolution
5. Add routes: `GET /v1/billing/approvals/pending`, `POST /v1/billing/approvals/:id/approve`, `POST /v1/billing/approvals/:id/reject`
6. Add commands: `billing.approval.request`, `billing.approval.approve`, `billing.approval.reject`

### Schema
- `scripts/tables/04-financial/79_approval_requests.sql`
- `schema/src/events/commands/billing.ts` — approval commands
- `schema/src/api/billing.ts` — approval response types

### UI
- Approval queue dashboard (badge count on nav)
- Approve/reject action with reason
- Notification to approver (if notification-service wired)

## Impact
Without approval workflows, a single user can write off bad debt, void invoices, and reopen periods — significant fraud and compliance risk.
