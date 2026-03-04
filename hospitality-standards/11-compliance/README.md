# Compliance & Data Privacy

## GDPR (EU General Data Protection Regulation)

### Core Principles

| Principle | Application |
|-----------|-------------|
| Lawfulness | Legal basis for processing |
| Purpose limitation | Use data only for stated purpose |
| Data minimization | Collect only what's needed |
| Accuracy | Keep data correct and current |
| Storage limitation | Delete when no longer needed |
| Integrity & confidentiality | Secure processing |
| Accountability | Demonstrate compliance |

### Legal Bases for Processing

| Basis | Hotel Use Case |
|-------|----------------|
| **Contract** | Reservation fulfillment |
| **Consent** | Marketing communications |
| **Legal obligation** | Tax records, police reports |
| **Legitimate interest** | Fraud prevention, security |

### Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Access | Guest can request all data held |
| Rectification | Guest can correct inaccurate data |
| Erasure | "Right to be forgotten" |
| Restriction | Limit processing |
| Portability | Export in machine-readable format |
| Object | Stop processing, especially marketing |

### GDPR Compliance Checklist

| Requirement | Action |
|-------------|--------|
| Privacy policy | Display at booking, on-site |
| Consent capture | Opt-in for marketing |
| Data inventory | Know what data, where stored |
| Retention policy | Define and enforce periods |
| Breach notification | 72 hours to authority |
| DPO appointment | If large-scale processing |
| DPIA | For high-risk processing |

## CPRA / CCPA (California Privacy Rights Act, amending CCPA)

> **Update**: CPRA took full effect **January 1, 2023**, and enforcement by the California Privacy Protection Agency (CPPA) began **July 1, 2023**. CPRA significantly strengthened CCPA.

### Consumer Rights (CPRA-Enhanced)

| Right | Description | CPRA Enhancement |
|-------|-------------|------------------|
| Know | What PI is collected, used, shared | Expanded to include **Sensitive Personal Information (SPI)** |
| Delete | Request deletion of PI | Extends to third-party recipients |
| Opt-out | Stop sale **or sharing** of PI | "Sharing" now includes cross-context behavioral advertising |
| Correct | Request correction of inaccurate PI | **New right under CPRA** |
| Limit use of SPI | Restrict processing of sensitive data | **New right under CPRA** |
| Non-discrimination | Equal service regardless of choices | Unchanged |

### CPRA Key Changes from CCPA

| Change | Impact for Hotels |
|--------|-------------------|
| California Privacy Protection Agency (CPPA) | Dedicated enforcement body (replaces AG-only) |
| Sensitive Personal Information (SPI) | Race, religion, biometrics, precise geolocation — hotels must offer opt-out of use |
| Purpose limitation | PI use restricted to disclosed purposes (GDPR-like) |
| Data minimization | Collection must be reasonably necessary and proportionate |
| Storage limitation | Must disclose retention periods |
| Contractor obligations | Stricter requirements for service providers and contractors |
| Audit rights | CPPA can order risk assessments for high-risk processing |

### CPRA vs. GDPR

| Aspect | CPRA (California) | GDPR (EU) |
|--------|-------------------|-----------|
| Scope | California residents | EU residents + data subjects |
| Threshold | Businesses >$25M revenue, >100K consumers, or >50% revenue from sale | Any org processing EU resident data |
| Consent model | Opt-out (sale/sharing) | Opt-in (consent) |
| Sensitive data | Limit use of SPI | Explicit consent for special categories |
| Private action | Data breach only | Limited (member state law) |
| Enforcement | CPPA + AG | Supervisory authorities |
| Fines | $2,500-$7,500 per violation | Up to 4% global revenue or €20M |
| Children's data | Opt-in for under 16 | Parental consent under 16 (varies by state) |

## PCI DSS (Payment Card Industry Data Security Standard)

> **CRITICAL UPDATE**: PCI DSS v4.0 became mandatory **March 31, 2025**, replacing v3.2.1. All hotels must comply with the new requirements.

### PCI DSS v4.0 Key Changes

| Change | Impact for Hotels |
|--------|-------------------|
| Customized approach validation | Alternative to defined approach (more flexibility) |
| Multi-factor authentication (MFA) | Required for ALL access to cardholder data environment (not just remote) |
| Targeted risk analysis | Annual for each flexible requirement |
| Enhanced password requirements | Minimum 12 characters (was 7) |
| Automated log review | Automated mechanisms to detect anomalies |
| Client-side security | Protect payment pages from script attacks (e.g., Magecart) |
| Service provider accountability | Stronger third-party risk management |

### Requirements (v4.0)

| Requirement | Description |
|-------------|-------------|
| 1 | Install and maintain network security controls |
| 2 | Apply secure configurations to all system components |
| 3 | Protect stored account data |
| 4 | Protect cardholder data with strong cryptography during transmission |
| 5 | Protect all systems and networks from malicious software |
| 6 | Develop and maintain secure systems and software |
| 7 | Restrict access to system components and cardholder data by business need-to-know |
| 8 | Identify users and authenticate access to system components |
| 9 | Restrict physical access to cardholder data |
| 10 | Log and monitor all access to system components and cardholder data |
| 11 | Test security of systems and networks regularly |
| 12 | Support information security with organizational policies and programs |

### PCI Scope Reduction

| Strategy | Benefit | Oracle Solution |
|----------|---------|-----------------|
| Tokenization | Replace PAN with token | Oracle Payment Interface (OPI) |
| P2PE | Point-to-point encryption | OPI with certified devices |
| Outsource payment | Reduce cardholder data environment | Oracle Payment Cloud Service |
| Segmentation | Isolate payment systems | Network architecture best practice |

### Compliance Levels

| Level | Criteria | Validation |
|-------|----------|------------|
| 1 | > 6M transactions/year | On-site audit |
| 2 | 1-6M transactions | SAQ |
| 3 | 20K-1M e-commerce | SAQ |
| 4 | < 20K e-commerce, < 1M other | SAQ |

## Regional Regulations

### USA

| Regulation | Scope | Status (2025-2026) |
|------------|-------|---------------------|
| State breach notification | All 50 states + territories | Increasingly strict timelines (e.g., 72h in many states) |
| CPRA/CCPA | California residents (see above) | Full enforcement underway |
| State privacy laws | CO, CT, VA, UT, TX, OR, MT, DE, IA, NE, NH, NJ, TN | **14+ states** enacted comprehensive privacy laws by 2025 |
| HIPAA | If health/wellness spa services | Unchanged |
| ADA | Accessibility (physical + digital) | DOJ: websites must meet WCAG 2.1 AA |
| FCRA | Background checks (employees) | Unchanged |

### Europe

| Regulation | Scope | Status (2025-2026) |
|------------|-------|---------------------|
| GDPR | EU-wide data protection | Fully enforced; cumulative fines >€4.5B |
| ePrivacy | Cookies, electronic marketing | ePrivacy Regulation still pending |
| DSA (Digital Services Act) | Platform accountability, content moderation | Fully applicable Feb 2024 |
| DMA (Digital Markets Act) | Gatekeepers (Booking.com designated) | Enforced; impacts OTA parity/self-preferencing |
| Country-specific | National DPA enforcement varies | Germany, France, Italy most active |

### Asia-Pacific

| Country | Regulation | Status (2025-2026) |
|---------|------------|---------------------|
| China | PIPL (Personal Information Protection Law) | Fully enforced since Nov 2021; cross-border transfer rules tightened 2024 |
| Japan | APPI (amended 2022) | Enhanced extraterritorial reach; pseudonymized data rules |
| Australia | Privacy Act (reform underway) | 2024-2025 reform: new right to erasure, children's privacy code, statutory tort |
| Singapore | PDPA (amended 2021) | Mandatory breach notification; consent framework enhanced |
| India | **DPDP Act 2023** (Digital Personal Data Protection) | **Enacted August 2023**; phased enforcement 2025-2026; consent-based, fiduciary model, up to ₹250 crore (~$30M) fines |
| South Korea | PIPA (amended 2023) | Strengthened cross-border transfer rules, new PIPC enforcement |
| Thailand | PDPA | Fully enforced since Jun 2022; modeled on GDPR |

### Latin America

| Country | Regulation | Status (2025-2026) |
|---------|------------|---------------------|
| Brazil | LGPD | Fully enforced; ANPD issuing administrative sanctions since 2023 |
| Argentina | PDPA (Law 25,326) | Reform bill under consideration; adequacy status with EU maintained |
| Mexico | LFPDPPP | Stable; privacy notice (Aviso de Privacidad) required |
| Colombia | Law 1581 of 2012 | Stable; SIC enforcement active |

## Guest Registration Requirements

### Police Registration

| Country | Requirement |
|---------|-------------|
| Spain | Part.de viajeros within 24h |
| Italy | Schedina within 48h |
| Portugal | SEF registration |
| India | Form C for foreigners |
| Japan | Guest record keeping |
| UAE | GDRFA registration |

### Data Elements Typically Required

| Element | Requirement |
|---------|-------------|
| Full name | Universal |
| Nationality | Most countries |
| Passport/ID number | Most countries |
| Date of birth | Common |
| Permanent address | Some countries |
| Arrival/departure dates | Universal |
| Vehicle registration | Some countries |

## Data Retention

### Retention Periods

| Data Type | Retention | Basis |
|-----------|-----------|-------|
| Financial records | 7 years | Tax law |
| Guest folios | 7 years | Financial |
| Reservation data | 3-7 years | Business/legal |
| Police registration | Per country law | Legal |
| Marketing consent | Until withdrawn | GDPR |
| CCTV | 30-90 days | Security |
| Access logs | 1-2 years | Security |

### Secure Disposal

| Method | Use Case |
|--------|----------|
| Shredding | Physical documents |
| Secure delete | Digital records |
| Degaussing | Magnetic media |
| Physical destruction | Hardware |

---

[← Back to Overview](../README.md)
