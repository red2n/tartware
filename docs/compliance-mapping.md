# Compliance Mapping

Traceability map between Tartware PMS tables and the external controls they satisfy. Use it during design reviews, audits, or when onboarding new engineers who need to see which schemas tie back to PCI DSS, GDPR, or SOX requirements.

## PCI DSS (Payments & Cardholder Data)

| Table | Control Focus | Notes |
| --- | --- | --- |
| `04-financial/12_payments.sql` | Req. 3.2 / 3.4 – protect stored cardholder data | Stores only tokens/last4 + references to external vaults; sensitive fields are nullable and constrained |
| `04-financial/69_payment_tokens.sql` | Req. 3.3 – PAN masking/tokenization | Token vault pointer, issuer metadata, and expiration tracking |
| `04-financial/66_cashier_sessions.sql` | Req. 10 – individual accountability | Session-scoped tills with cash drawer variance tracking |
| `04-financial/65_commission_tracking.sql` | Req. 10.2 – tamper evidence | Logs every commission payout that originates from card revenue |
| `04-financial/26_charge_postings.sql` | Req. 10.3 – transaction audit | Captures POS/PMS source, GL code, taxation, and void history |

**Implementation tips**
- Grant application roles read/write access only through stored procedures.
- Encrypt connections to payment gateways and OOB token vaults; no PAN or CVV is stored here.
- Use the `scripts/tools/table_lineage_report.sql` helper to show which upstream tables feed financial statements during assessments.

## GDPR & Privacy

| Table | Article / Control | Notes |
| --- | --- | --- |
| `01-core/05_guests.sql` | Art. 15/16 – right of access & rectification | Centralized profile; `metadata` column limited to tenant-scoped keys |
| `03-bookings/34_guest_preferences.sql` | Art. 5 – purpose limitation | Preferences flagged with `is_special_request` and `source` for consent tracing |
| `07-analytics/74_gdpr_consent_logs.sql` | Art. 7 – consent logging | Immutable consent ledger with purpose, channel, and revocation timestamp |
| `03-bookings/48_guest_documents.sql` | Art. 32 – secure processing | Document metadata only; binaries live in encrypted object storage |
| `07-analytics/98_sustainability_metrics.sql` (`green_certifications` subset) | Legitimate interest transparency | Captures sustainability badges per property without linking to PII |

**Implementation tips**
- Data subject deletion flows should cascade via `ON DELETE` constraints that originate at `guests`.
- Consent revocations are propagated via triggers that read `gdpr_consent_logs`.
- When exporting evidence, include column-level lineage using the new table lineage report.

## SOX / Platform Audit & Access

| Table | Control Focus | Notes |
| --- | --- | --- |
| `01-core/07_system_administrators.sql` | SOX 404 / privileged access | MFA flags, IP allow-lists, and locked-until timestamps prevent shared credentials |
| `01-core/08_system_admin_audit_log.sql` | SOX 302 / change tracking | Append-only audit of system-level actions with checksum column |
| `07-analytics/27_audit_logs.sql` | SOX 409 / incident response | Master audit table for tenant-facing activity, referenced in reports |
| `07-analytics/29_night_audit_log.sql` | Hospitality compliance | Night audit outcomes with reviewer + approval flow |
| `04-financial/71_general_ledger_entries.sql` | Financial integrity | Contains USALI category + locking to ensure journal immutability |

**Implementation tips**
- Tag schema changes with Jira ticket IDs via the `metadata` JSON and keep cross-references current in this document.
- Reference the exact section (e.g., `docs/compliance-mapping.md#sox--platform-audit--access`) from table comments so auditors can jump straight to evidence.

## Using This Map

1. Update this document whenever you add a table that stores regulated data.
2. Drop a short comment in the DDL referencing the relevant section.
3. During reviews, include both the DDL diff and the table’s row in this mapping to keep compliance, security, and engineering in sync.
