# GAP-20: UI — Folio Detail View & Actions

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §3

## Current State
- Billing page has folio list with status, balance, guest name
- `BillingDataService` has `selectedFolioId` and `folioCharges` signals
- Backend has full folio CRUD: create, close, reopen, merge, transfer, split
- **Folio detail view is minimal** — no inline charge/payment drill-down
- **Folio actions limited** — only close folio is wired; no merge, reopen, transfer UI

## Work Required

### UI Enhancements
1. **Folio detail panel** (click folio row → expand or slide-out):
   - Charge postings for this folio (already fetched via folioCharges)
   - Payments applied to this folio
   - Routing rules active on this folio
   - Folio windows (if any)
   - Balance breakdown: charges - payments - credits = balance
2. **Folio actions**:
   - Reopen folio (for CLOSED/SETTLED folios)
   - Merge folios (select target folio)
   - Transfer folio to AR/city ledger
   - Create folio window (date-based split)
   - Add routing rule (charge code → destination folio)
3. **Post charge inline** — quick charge posting from folio detail
4. **Post payment inline** — quick payment from folio detail

### Backend Routes Already Available
- `GET /v1/billing/folios/:folioId` — folio detail
- `GET /v1/billing/charges?folio_id=X` — charges for folio
- `GET /v1/billing/payments?folio_id=X` — payments for folio (if filter exists)
- Commands: folio.close, folio.reopen, folio.merge, folio.transfer, folio_window.create
