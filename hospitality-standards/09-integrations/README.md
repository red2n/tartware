# System Integrations

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PMS INTEGRATION HUB                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                         ┌─────────────┐                              │
│              ┌──────────│     PMS     │──────────┐                   │
│              │          │   (Core)    │          │                   │
│              │          └──────┬──────┘          │                   │
│              │                 │                 │                   │
│      ┌───────┴───────┐   ┌────┴────┐   ┌───────┴───────┐           │
│      │   Guest-      │   │  Ops    │   │   Revenue     │           │
│      │   Facing      │   │  Tech   │   │   Systems     │           │
│      └───────┬───────┘   └────┬────┘   └───────┬───────┘           │
│              │                │                 │                   │
│   ┌──────────┼────────┐   ┌───┼───┐   ┌────────┼────────┐          │
│   │          │        │   │   │   │   │        │        │          │
│   ▼          ▼        ▼   ▼   ▼   ▼   ▼        ▼        ▼          │
│  CRS      Mobile   Web  POS Key  HK  CRM   Channel   RMS           │
│  Booking  App      BEng     Lock Sys      Manager                  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Standard Protocols

### HTNG (Hotel Technology Next Generation)

| Standard | Purpose | Format | Status (2026) |
|----------|---------|--------|---------------|
| HTNG 2.0 | Property interface specs | XML/SOAP | Legacy, still in use |
| HTNG Hospitality API | Modern API standard | REST/JSON | Recommended for new integrations |
| HTNG Payment | Payment tokenization | Various | Active |
| HTNG IoT | Guest room technology | Various | Growing |

### OTA (OpenTravel Alliance)

| Standard | Use Case |
|----------|----------|
| OTA_HotelResRQ/RS | Reservation messages |
| OTA_HotelAvailRQ/RS | Availability queries |
| OTA_HotelRateAmountNotif | Rate updates |
| OTA_HotelInvCountNotif | Inventory updates |
| OTA_HotelDescriptiveInfo | Content sync |

### HAPI (Hospitality API) — Modern Standard

| Specification | Description |
|---------------|-------------|
| OpenAPI 3.0+ | REST API definition standard |
| JSON Schema | Data structure validation |
| OAuth 2.0 | Authentication standard |
| Webhooks | Event-driven notifications |
| GraphQL | Emerging for complex queries |

### Oracle Hospitality Integration Platform (OHIP)

Oracle's OHIP is a key integration layer for OPERA Cloud:

| Feature | Description |
|---------|-------------|
| Open APIs | RESTful APIs for reservations, profiles, rates, inventory |
| Partner marketplace | Pre-validated integrations with 3,000+ technology partners |
| Event streaming | Real-time webhooks for PMS events |
| ID Document Scanning | Automated guest ID capture and verification |
| Bi-directional sync | Two-way data flow with channel managers, RMS, CRM |

## Common Integration Points

### Point of Sale (POS)

| Direction | Data Flow |
|-----------|-----------|
| POS → PMS | Charges posted to guest folio |
| PMS → POS | Guest lookup, room charge auth |

Interface requirements:
- Real-time posting (< 3 seconds)
- Room number + guest name validation
- Support for split checks
- Void/adjustment sync

### Key/Lock Systems

| Direction | Data Flow |
|-----------|-----------|
| PMS → Lock | Check-in: encode key with room, dates |
| Lock → PMS | Access logs (optional) |

Major vendors: ASSA ABLOY, Salto, dormakaba, Onity

### Housekeeping Systems

| Direction | Data Flow |
|-----------|-----------|
| PMS → HSK | Room status, priority assignments |
| HSK → PMS | Cleaned status, minibar, maintenance |

### Channel Manager

| Direction | Data Flow |
|-----------|-----------|
| PMS → CM | ARI updates (availability, rates, restrictions) |
| CM → PMS | Reservations from OTAs |

### Revenue Management System

| Direction | Data Flow | Modern Enhancement |
|-----------|-----------|---------------------|
| PMS → RMS | Historical data, on-the-books | Real-time pace and pickup data |
| RMS → PMS | Rate recommendations, restrictions | Automated rate updates (IDeaS G3 auto-accept, Duetto GameChanger auto-push) |

### Central Reservation System

| Direction | Data Flow |
|-----------|-----------|
| PMS → CRS | Availability, rates |
| CRS → PMS | Reservations, modifications, cancellations |

### AI/Upsell Platforms

| Direction | Data Flow | Example |
|-----------|-----------|---------|
| PMS → Upsell | Room availability, guest profile, pricing | Oracle Nor1, Oaky, Revinate |
| Upsell → PMS | Confirmed upgrades, revenue updates | Pre-arrival and at-check-in |

## API Design Patterns

### Resource Naming

```
GET    /properties/{propertyId}/reservations          # List
POST   /properties/{propertyId}/reservations          # Create
GET    /properties/{propertyId}/reservations/{id}     # Read
PUT    /properties/{propertyId}/reservations/{id}     # Update
DELETE /properties/{propertyId}/reservations/{id}     # Cancel
```

### Pagination

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "hasMore": true
  }
}
```

### Event Webhooks

| Event | Trigger |
|-------|---------|
| reservation.created | New booking |
| reservation.modified | Change to booking |
| reservation.cancelled | Cancellation |
| guest.checkedIn | Check-in complete |
| guest.checkedOut | Check-out complete |
| room.statusChanged | Housekeeping update |

## Data Exchange Formats

### Reservation Message Example (Simplified)

```json
{
  "confirmationNumber": "HX12345678",
  "propertyCode": "LAXHILTON",
  "status": "CONFIRMED",
  "guest": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com"
  },
  "stayDetails": {
    "arrivalDate": "2026-03-15",
    "departureDate": "2026-03-18",
    "roomType": "KNG",
    "rateCode": "BAR",
    "dailyRates": [
      { "date": "2026-03-15", "amount": 199.00 },
      { "date": "2026-03-16", "amount": 219.00 },
      { "date": "2026-03-17", "amount": 219.00 }
    ]
  },
  "guarantee": {
    "paymentType": "CC",
    "cardType": "VISA",
    "lastFour": "1234"
  }
}
```

## Security Requirements

| Requirement | Implementation | 2026 Standard |
|-------------|----------------|---------------|
| Authentication | API keys, OAuth 2.0, JWT | OAuth 2.0 + mTLS preferred |
| Encryption | TLS 1.2+ for transit | TLS 1.3 recommended |
| PCI compliance | Tokenize card data | PCI DSS v4.0 mandatory (March 2025) |
| Rate limiting | Per-client throttling | Required |
| Audit logging | All API calls logged | Structured logging with correlation IDs |
| IP allowlisting | Optional additional security | Recommended for PMS integrations |
| Data residency | Regional data storage | Required in EU (GDPR), China (PIPL) |

---

[← Back to Overview](../README.md)
