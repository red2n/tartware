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
- [Financial Operations](07-financial/README.md) - Folios, payments, night audit, AR

### Distribution & Integration
- [Channel Distribution](08-distribution/README.md) - OTAs, GDS, channel managers, connectivity
- [Integration Protocols](09-integrations/README.md) - API standards, webhooks, HTNG/OTA

### Compliance & Reporting
- [Reporting Standards](10-reporting/README.md) - Operational and financial reports
- [Security & Compliance](11-compliance/README.md) - GDPR, PCI DSS, regional requirements

### Technical Reference
- [Technical Architecture](12-technical/README.md) - Benchmarks, database patterns, code standards

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
│   └── night-audit.md
├── 08-distribution/             # Channel management & OTA connectivity
│   └── README.md
├── 09-integrations/             # Technical integrations
│   └── README.md
├── 10-reporting/                # Analytics and reports
│   └── README.md
├── 11-compliance/               # Regulatory requirements (incl. regional)
│   └── README.md
└── 12-technical/                # Benchmarks, database patterns, code standards
    └── README.md
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

| Metric | Value (2026) | Source |
|--------|-------------|--------|
| Global hotel rooms | ~19 million | STR/CoStar Global |
| Global hotel market | $785B (2023) → $1.13T by 2030 | Revfine / Statista |
| PMS market size | $9.2B (9% CAGR) | Industry estimates |
| RMS market size | $1.2B (2024) → $3.4B by 2033 (12.3% CAGR) | Revfine 2026 |
| RMS adoption rate | 83.9% of hotels | Revfine / SnapShot 2024 survey |
| ADR (global average) | $130-160 USD | CoStar with STR Benchmark |
| Occupancy (global average) | 66-73% | CoStar with STR Benchmark |
| RevPAR leaders | Hyatt +5.7%, Marriott +4.1% Q1 2025 | Brand earnings reports |
| AI pricing revenue uplift | ~15% from AI-powered RMS | Revfine 2026 |
| Guest eco-friendly preference | 78% prefer sustainable stays | Booking.com / Revfine |
| PCI DSS version | v4.0 mandatory (March 31, 2025) | PCI SSC |
| Leading PMS platform | Oracle OPERA Cloud (IDC MarketScape 2025 Leader) | IDC/Oracle |

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

See the [main Tartware repository](../README.md) for contribution guidelines. This documentation is maintained alongside the codebase.

When updating:
1. Update the "Last Updated" date below
2. Add changelog entry if significant
3. Verify cross-links still work

---

**Version**: 2.0
**Last Updated**: June 2025
**Standards Referenced**: Oracle OPERA Cloud Release 26.1, IDeaS G3, Duetto GameChanger/RP-OS, Atomize, Revfine 2026 Guides, CoStar with STR Benchmark, PCI DSS v4.0
**Next Review**: Q4 2025 (Compliance + Distribution sections)
