# Hospitality Industry Standards

A comprehensive reference for Property Management Systems (PMS) in the hospitality industry. This documentation is designed for developers, architects, and AI systems implementing or maintaining hospitality software.

## Quick Navigation

### Core Concepts
- [Domain Overview](01-overview/README.md) - What is a PMS, stakeholders, market context
- [Property Types](01-overview/property-types.md) - Hotels, resorts, vacation rentals, hostels
- [Glossary](01-overview/glossary.md) - Industry terminology A-Z

### Operations
- [Reservation Management](02-reservations/README.md) - Booking lifecycle, types, sources
- [Front Desk Operations](03-front-desk/README.md) - Check-in/out, room moves
- [Housekeeping](04-housekeeping/README.md) - Room status, task management
- [Guest Profiles](05-guests/README.md) - Profiles, loyalty, VIP handling

### Revenue & Finance
- [Rate Management](06-rates/README.md) - Rate codes, restrictions, dynamic pricing
- [Revenue Management](06-rates/revenue-management.md) - KPIs, yield strategies
- [Financial Operations](07-financial/README.md) - Folios, payments, night audit
- [Accounts Receivable](07-financial/accounts-receivable.md) - AR, direct billing

### Distribution & Integration
- [Channel Distribution](08-distribution/README.md) - OTAs, GDS, channel managers
- [Integration Protocols](09-integrations/README.md) - API standards, webhooks
- [OTA Connectivity](09-integrations/ota-connectivity.md) - Booking.com, Expedia, Airbnb

### Compliance & Reporting
- [Reporting Standards](10-reporting/README.md) - Operational and financial reports
- [Security & Compliance](11-compliance/README.md) - GDPR, PCI DSS, accessibility
- [Regional Requirements](11-compliance/regional.md) - Police reports, tax by region

### Technical Reference
- [Performance Benchmarks](12-technical/benchmarks.md) - System targets, SLAs
- [Database Patterns](12-technical/database-patterns.md) - Schema conventions
- [Code Standards](12-technical/code-standards.md) - Naming, market segment codes

---

## Document Structure

```
hospitality-standards/
├── README.md                    # This file
├── 01-overview/                 # Domain fundamentals
│   ├── README.md
│   ├── property-types.md
│   └── glossary.md
├── 02-reservations/             # Booking lifecycle
│   ├── README.md
│   ├── booking-sources.md
│   └── group-bookings.md
├── 03-front-desk/               # Front office operations
│   ├── README.md
│   └── express-services.md
├── 04-housekeeping/             # Room operations
│   └── README.md
├── 05-guests/                   # Guest management
│   ├── README.md
│   └── loyalty-programs.md
├── 06-rates/                    # Pricing and revenue
│   ├── README.md
│   └── revenue-management.md
├── 07-financial/                # Billing and payments
│   ├── README.md
│   ├── night-audit.md
│   └── accounts-receivable.md
├── 08-distribution/             # Channel management
│   └── README.md
├── 09-integrations/             # Technical integrations
│   ├── README.md
│   └── ota-connectivity.md
├── 10-reporting/                # Analytics and reports
│   └── README.md
├── 11-compliance/               # Regulatory requirements
│   ├── README.md
│   └── regional.md
└── 12-technical/                # Technical reference
    ├── benchmarks.md
    ├── database-patterns.md
    └── code-standards.md
```

---

## Purpose

This documentation serves as:

1. **AI Reference** - Comprehensive context for AI systems implementing PMS features
2. **Developer Onboarding** - Quick education on hospitality domain concepts
3. **Architecture Guide** - Industry-standard patterns and best practices
4. **Compliance Checklist** - Regulatory requirements by region

---

## Industry Context

| Metric | Value (2025) |
|--------|--------------|
| Global hotel rooms | ~18.5 million |
| PMS market size | $8.5B (8% CAGR) |
| ADR (global average) | $120-150 USD |
| Occupancy (global average) | 65-72% |

---

## Maintenance Schedule

This documentation requires periodic updates to stay current with industry changes:

| Section | Review Frequency | Trigger Events |
|---------|------------------|----------------|
| **11-compliance** | Quarterly | GDPR/PCI version updates, new privacy laws (state/country) |
| **08-distribution** | Semi-annually | OTA mergers, new channels, commission changes |
| **09-integrations** | Semi-annually | New HTNG specs, protocol versions |
| **05-guests/loyalty** | Annually | Brand mergers, tier restructures, point devaluations |
| **06-rates** | Annually | New revenue management KPIs |
| **12-technical** | Annually | Performance benchmark updates |
| **01-overview/glossary** | As needed | New industry terminology |

### What Triggers Updates

- **Regulatory**: GDPR amendments, new PCI DSS versions, new regional privacy laws
- **Industry consolidation**: Hotel brand mergers (affecting loyalty docs), OTA acquisitions
- **Technology**: New integration protocols, mobile key standards, payment methods
- **Market shifts**: Commission structure changes, new distribution channels

---

## Contributing

See the main [Tartware repository](../) for contribution guidelines. This documentation is maintained alongside the codebase.

When updating:
1. Update the "Last Updated" date below
2. Add changelog entry if significant
3. Verify cross-links still work

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Next Review**: Q2 2026 (Compliance section)
