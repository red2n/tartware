# GAP-16: USALI Chart of Accounts & GL Code Mapping

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §2, §9.1, §16 (Principle 6)

## Current State
- `general_ledger_entries.gl_account_code` exists
- `general_ledger_entries.usali_category` exists
- **No reference table mapping charge_codes to GL accounts**
- No USALI chart of accounts in the system
- Late checkout fee goes to generic charge — not GL 4030 (Miscellaneous Revenue)
- Comp posting doesn't post to GL 5100 (Comp Expense)

## What the Doc Requires (USALI 12th Edition)
| GL Code | Account Name | Use |
|---------|-------------|-----|
| 1100 | Cash/Bank | Cash receipts, bank deposits |
| 1200 | Guest Ledger (AR-Guest) | In-house guest charges |
| 1300 | City Ledger (AR-Company) | Direct billing, post-checkout |
| 2100 | Tax Payable | Collected taxes |
| 2200 | Advance Deposits | Pre-arrival deposits (liability) |
| 2300 | Loyalty Liability | Unredeemed loyalty points |
| 4000 | Rooms Revenue | Room charges |
| 4010 | F&B Revenue | Food & beverage |
| 4020 | Other Operating Revenue | Spa, parking, etc. |
| 4030 | Miscellaneous Revenue | Late checkout, early departure |
| 5100 | Comp Expense | Complimentary offset |
| 6100 | FX Gain/Loss | Currency conversion variance |

## Work Required

### SQL
1. Create `scripts/tables/09-reference-data/08_gl_chart_of_accounts.sql`:
   - `gl_account_code`, `account_name`, `account_type` (ASSET/LIABILITY/REVENUE/EXPENSE), `usali_category`, `is_active`
2. Create `scripts/tables/09-reference-data/09_charge_code_gl_mapping.sql`:
   - `charge_code` → `debit_gl_account`, `credit_gl_account`
   - Per tenant/property override capability
3. Seed with USALI 12th Edition standard chart

### Backend
1. GL mapping lookup in charge posting pipeline
2. Late checkout → GL 4030 (not 4000)
3. Comp → GL 5100 (expense) + GL 4000 (revenue, gross)

### Schema
- `schema/src/schemas/09-reference-data/gl-chart-of-accounts.ts`
- `schema/src/schemas/09-reference-data/charge-code-gl-mapping.ts`
