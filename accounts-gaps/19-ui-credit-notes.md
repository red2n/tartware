# GAP-19: UI — Credit Note Management

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §5.3

## Current State (Backend ✅ → UI ❌)
- Backend has `billing.credit_note.create` command
- Credit notes create a new invoice with `invoice_type = 'CREDIT_NOTE'`
- Cross-referenced to original invoice
- **No dedicated credit note view in invoices UI**
- `canCreditNote()` utility exists in billing-utils.ts but no button wired

## Work Required

### UI Changes
1. In `accounts/invoices/`: add "Issue Credit Note" action button (for ISSUED/PAID invoices)
2. Credit note issuance form: original invoice ref, amount, reason, line items
3. Filter/tab for credit notes in invoice list (invoice_type = CREDIT_NOTE)
4. Credit note detail view showing linked original invoice
5. Credit note in billing page invoices tab

### Backend Route Needed
- `GET /v1/billing/invoices?invoice_type=CREDIT_NOTE` — already supported if filter exists
- Verify invoice list route supports `invoice_type` filter
