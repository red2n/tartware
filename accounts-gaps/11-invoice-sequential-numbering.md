# GAP-11: Invoice & Credit Note Sequential Numbering

**Priority:** P1 | **Risk:** 🟠 MEDIUM-HIGH | **Ref:** BA §5.1, §5.3

## Current State
- Invoice creation in `invoice.ts` generates invoice_number but likely not gap-free
- Credit note creation uses `CN-YYYY-XXXXX-{random}` format
- No sequence table or gap-free number generation
- Tax authorities in many jurisdictions require gap-free sequential invoice numbers

## What the Doc Requires

### Invoice Numbers
- Gap-free sequential per property: `INV-{property_code}-{YYYY}-{NNNNN}`
- No gaps allowed (tax authority requirement in EU, LATAM, Asia)
- Sequence stored in DB with row-level lock during generation
- Voided invoices keep their number (marked void, number not reused)

### Credit Note Numbers
- Separate sequential series: `CN-{property_code}-{YYYY}-{NNNNN}`
- Cross-referenced to original invoice
- Same gap-free requirement

## Work Required

### Backend
1. Create `invoice_sequences` table — per property, per year, per type (INVOICE, CREDIT_NOTE)
2. Create `billing-service/src/lib/sequence-generator.ts` — atomic gap-free number generation
3. Use `SELECT ... FOR UPDATE` + `UPDATE ... RETURNING` pattern for concurrency-safe generation
4. Update `createInvoice`: use sequence generator instead of ad-hoc numbering
5. Update `createCreditNote`: use separate CN sequence

### SQL
```sql
CREATE TABLE IF NOT EXISTS invoice_sequences (
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    document_type VARCHAR(20) NOT NULL, -- 'INVOICE', 'CREDIT_NOTE'
    fiscal_year INTEGER NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, property_id, document_type, fiscal_year)
);
```

## Impact
Non-sequential invoice numbers may cause tax audit failures in jurisdictions with strict invoicing requirements (EU VAT directive, Brazil NF-e, India GST).
