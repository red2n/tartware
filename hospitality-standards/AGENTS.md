# Agent Instructions for Hospitality Standards

## Purpose
This folder contains PMS industry reference documentation. It serves as domain knowledge for AI assistants working on hospitality software.

## When to Update

### Compliance (11-compliance/) - PRIORITY
- **PCI DSS**: New versions (currently 4.0, check for 4.x updates)
- **GDPR**: EU amendments, new guidance from data protection authorities
- **CCPA/CPRA**: California updates, new state privacy laws (Virginia, Colorado, etc.)
- **Regional**: New countries' data protection laws (check Asia-Pacific, Latin America)
- **Police registration**: Changes to guest registration requirements

### Distribution (08-distribution/)
- OTA market share shifts
- New major OTAs or channel closures
- Commission structure changes
- Metasearch model changes

### Integrations (09-integrations/)
- HTNG specification updates
- New OTA API versions
- Emerging protocols (GraphQL adoption, etc.)
- New lock vendor integrations

### Loyalty (05-guests/loyalty-programs.md)
- Hotel brand mergers/acquisitions
- Tier restructures
- Points devaluations (update valuation table)
- New earning/redemption models

## Update Process

1. **Verify accuracy** - Cross-reference with official sources (HTNG, PCI Council, GDPR portal)
2. **Update content** - Make changes to affected markdown files
3. **Update dates** - Change "Last Updated" in main README.md
4. **Update version** - Increment version if major changes
5. **Commit** - Use conventional commit: `docs(hospitality-standards): update [section] for [reason]`

## Style Guidelines

- Use tables for structured data (status codes, rate types, etc.)
- Use ASCII diagrams for workflows (not images)
- Keep terminology consistent with 01-overview/glossary.md
- Add new terms to glossary when introducing concepts
- Cross-link between related documents
- Include both US and international perspectives (global product)

## Do NOT

- Add implementation-specific code (this is domain knowledge, not code)
- Include brand-specific details that change frequently
- Add pricing/cost numbers that become stale (use ranges or "typical")
- Remove existing content without replacement

## Sources for Updates

| Topic | Authoritative Source |
|-------|---------------------|
| PCI DSS | pcisecuritystandards.org |
| GDPR | gdpr.eu, edpb.europa.eu |
| HTNG | htng.org |
| OTA specs | Partner portals (Booking.com, Expedia) |
| STR metrics | str.com |
| Hotel industry | ahla.com, hsmai.org |
