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

| Channel | Description | Cost Structure |
|---------|-------------|----------------|
| **Direct** | Hotel website, call center | 2-5% (payment processing) |
| **Brand.com** | Chain central reservation | 5-10% (reservation fee) |
| **GDS** | Amadeus, Sabre, Travelport | $10-20 + travel agent commission |
| **OTA** | Booking.com, Expedia | 15-25% commission |
| **Metasearch** | Google, TripAdvisor, Kayak | CPC or CPA |
| **Wholesale** | Bedbanks (Hotelbeds) | Net rate (20-30% margin to reseller) |
| **Opaque** | Hotwire, Priceline | Discounted, brand hidden |

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

| OTA | Markets | Business Model |
|-----|---------|----------------|
| Booking.com | Global | Agency (merchant of record = hotel) |
| Expedia | Global | Merchant + agency |
| Hotels.com | Global | Expedia group, merchant |
| Agoda | Asia-Pacific | Booking Holdings, merchant |
| Trip.com | Asia | Both models |
| Airbnb | Global (vacation rental focus) | Service fee |

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

| Strategy | Description | Legality |
|----------|-------------|----------|
| Full parity | Same rate everywhere | EU ruled anti-competitive |
| Narrow parity | Same rate on other OTAs | Common in EU |
| No parity | Different rates allowed | Some markets |
| Member rates | Lower for logged-in users | Generally allowed |

## Metasearch

### How Metasearch Works

```
Guest searches → Metasearch aggregates rates → Guest clicks →
→ Redirect to booking site → Booking completes → Hotel charged CPC or CPA
```

### Major Metasearch Engines

| Platform | Model | Notes |
|----------|-------|-------|
| Google Hotel Ads | CPC/CPA | Largest volume |
| TripAdvisor | CPC/CPA | Review integration |
| Kayak | CPC | Booking Holdings |
| Trivago | CPC | Expedia Group |
| Skyscanner | CPC | Trip.com Group |

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
