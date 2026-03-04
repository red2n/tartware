# Distribution & Channel Management

## Distribution Landscape

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION ECOSYSTEM                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   SUPPLIERS              INTERMEDIARIES           CONSUMERS           │
│   ─────────              ─────────────            ─────────          │
│                                                                       │
│   ┌─────────┐           ┌─────────────┐         ┌──────────┐        │
│   │  Hotel  │ ──────────│   GDS       │─────────│  Travel  │        │
│   │  PMS    │           │ Sabre/Amadeus│         │  Agent   │        │
│   └────┬────┘           └─────────────┘         └──────────┘        │
│        │                                                             │
│        │                ┌─────────────┐         ┌──────────┐        │
│        ├───────────────►│    OTAs     │─────────│  Guest   │        │
│        │                │ Booking.com │         │  Direct  │        │
│        │                │ Expedia     │         └──────────┘        │
│        │                └─────────────┘                              │
│        │                                                             │
│        │                ┌─────────────┐         ┌──────────┐        │
│        └───────────────►│  Metasearch │─────────│  Guest   │        │
│                         │ Google/Kayak│         │          │        │
│                         └─────────────┘         └──────────┘        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Channel Types

| Channel | Description | Cost Structure | Net ADR Impact |
|---------|-------------|----------------|----------------|
| **Direct** | Hotel website, call center | 2-5% (payment processing) | Highest margin |
| **Brand.com** | Chain central reservation | 5-10% (reservation fee) | High margin |
| **GDS** | Amadeus, Sabre, Travelport | $10-20 + travel agent commission | Medium |
| **OTA** | Booking.com, Expedia | 15-18% commission | Lower margin |
| **Metasearch** | Google, TripAdvisor, Kayak, Trivago | CPC or CPA | Medium (lower than OTA) |
| **Wholesale** | Bedbanks (Hotelbeds, WebBeds) | Net rate (20-30% margin to reseller) | Lowest margin |
| **Opaque** | Hotwire, Priceline | Discounted, brand hidden | Rock bottom |
| **Google Free Booking Links** | Free organic listing | 0% (organic) | High margin |

> **Key Trend**: Since 2019, global RevPAR grew 19% but booking costs per available room surged 25% (Duetto/HotStats 2025). Optimizing channel mix toward direct and lower-cost channels is critical for margin preservation.

## Channel Manager Function

### Key Capabilities

| Function | Description |
|----------|-------------|
| Inventory sync | Real-time availability to all channels |
| Rate distribution | Push rates to connected channels |
| Restriction management | Apply booking rules |
| Reservation retrieval | Pull bookings from channels |
| Content management | Sync descriptions, photos |
| Two-way connectivity | ARI updates, reservation import |

### ARI Updates

| Component | Description |
|-----------|-------------|
| **A** - Availability | Rooms available for sale |
| **R** - Rates | Pricing by room type, rate plan |
| **I** - Inventory | Allotment controls, restrictions |

## OTA Connectivity

### Major OTAs

| OTA | Markets | Business Model | Parent Company |
|-----|---------|----------------|----------------|
| Booking.com | Global | Agency (merchant of record = hotel) | Booking Holdings |
| Expedia | Global | Merchant + agency | Expedia Group |
| Hotels.com | Global | Merchant | Expedia Group |
| Agoda | Asia-Pacific | Both models | Booking Holdings |
| Trip.com | Asia/Global | Both models | Trip.com Group |
| Airbnb | Global (vacation rental + hotel) | Service fee (split model) | Airbnb Inc. |
| Vrbo | Global (vacation rental) | Service fee | Expedia Group |
| MakeMyTrip | India | Both models | MakeMyTrip (Booking Holdings invested) |

> **Consolidation Note**: Booking Holdings (Booking.com, Agoda, Kayak, Priceline) and Expedia Group (Expedia, Hotels.com, Vrbo, Trivago) dominate global OTA distribution. The EU Digital Markets Act (DMA) and Digital Services Act (DSA) are impacting rate parity and transparency requirements for OTAs operating in Europe.

### OTA Extranet Functions

| Function | Purpose |
|----------|---------|
| Inventory management | Override channel manager |
| Rate loading | Manual rate entry |
| Promotion setup | Deals, flash sales |
| Content update | Photos, descriptions |
| Reservation management | Modify, cancel |
| Payment | Manage virtual cards |
| Reviews | Respond to guest feedback |
| Analytics | Performance reporting |

## Rate Parity

### Parity Requirements

| Type | Definition |
|------|------------|
| **Rate parity** | Same rate across public channels |
| **Inventory parity** | Same availability across channels |
| **Content parity** | Consistent descriptions/photos |

### Parity Strategies

| Strategy | Description | Legality | Notes (2026) |
|----------|-------------|----------|--------------|
| Full parity | Same rate everywhere | EU ruled anti-competitive | Banned in many EU countries |
| Narrow parity | Same rate on other OTAs, but can undercut on direct | Common in EU | Standard post-EU rulings |
| No parity | Different rates allowed | Some markets | Growing (Germany, France, Italy, Austria) |
| Member rates | Lower for logged-in users | Generally allowed | Industry standard practice |
| Loyalty pricing | Exclusive rates for program members | Allowed | OPERA Cloud Loyalty encourages direct booking incentives |

> **Regulatory Trend**: The EU Digital Markets Act (DMA) and national laws in Germany, France, Italy, and Austria have weakened OTA rate parity clauses. Hotels increasingly offer lower direct rates legally.

## Metasearch

### How Metasearch Works

```
Guest searches → Metasearch aggregates rates → Guest clicks →
→ Redirect to booking site → Booking completes → Hotel charged CPC or CPA
```

### Major Metasearch Engines

| Platform | Model | Notes | Parent Company |
|----------|-------|-------|----------------|
| Google Hotel Ads | CPC/CPA + Free Booking Links | Largest volume; free links since 2021 | Alphabet |
| TripAdvisor | CPC/CPA | Review integration | TripAdvisor Inc. |
| Kayak | CPC | Multi-platform | Booking Holdings |
| Trivago | CPC | Hotel-focused comparison | Expedia Group |
| Skyscanner | CPC | Flights + hotels | Trip.com Group |

### OPERA Cloud Distribution

Oracle OPERA Cloud Distribution provides integrated channel management:

| Feature | Description |
|---------|-------------|
| Rate management | Consistent yield and rate management across channels |
| Inventory sync | Real-time availability distribution |
| Restriction management | CTA, CTD, MinLOS controls |
| Multi-property | Centralized distribution for hotel portfolios |
| GDS connectivity | Native Amadeus, Sabre, Travelport integration |

## GDS Distribution

### GDS Chains

| GDS | Primary Market | Codes |
|-----|----------------|-------|
| Amadeus | Europe, international | 1A |
| Sabre | Americas | 1S |
| Travelport (Galileo/Apollo/Worldspan) | Various | 1G/1V/1P |

### GDS Chain Codes

| Type | Example | Purpose |
|------|---------|---------|
| Brand code | HI (Hilton), BW (Best Western) | Identify chain |
| Property code | LAXHH (LAX Hilton) | Identify property |
| Rate code | RAC, CORP | Rate access |

## Content Syndication

### Content Elements

| Element | Importance | Update Frequency |
|---------|------------|------------------|
| Property description | High | When changed |
| Room type descriptions | High | When changed |
| Photos (exterior) | High | Annually minimum |
| Photos (rooms) | High | After renovation |
| Amenity list | Medium | When changed |
| Location details | Medium | Rarely |
| Policies | High | When changed |

---

[← Back to Overview](../README.md)
