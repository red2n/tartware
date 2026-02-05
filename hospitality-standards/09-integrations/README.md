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

| Standard | Purpose | Format |
|----------|---------|--------|
| HTNG 2.0 | Property interface specs | XML/SOAP |
| HTNG Hospitality API | Modern API standard | REST/JSON |
| HTNG Payment | Payment tokenization | Various |
| HTNG IoT | Guest room technology | Various |

### OTA (OpenTravel Alliance)

| Standard | Use Case |
|----------|----------|
| OTA_HotelResRQ/RS | Reservation messages |
| OTA_HotelAvailRQ/RS | Availability queries |
| OTA_HotelRateAmountNotif | Rate updates |
| OTA_HotelInvCountNotif | Inventory updates |
| OTA_HotelDescriptiveInfo | Content sync |

### HAPI (Hospitality API)

| Specification | Description |
|---------------|-------------|
| OpenAPI 3.0 | REST API definition standard |
| JSON Schema | Data structure validation |
| OAuth 2.0 | Authentication standard |
| Webhooks | Event-driven notifications |

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

| Direction | Data Flow |
|-----------|-----------|
| PMS → RMS | Historical data, on-the-books |
| RMS → PMS | Rate recommendations, restrictions |

### Central Reservation System

| Direction | Data Flow |
|-----------|-----------|
| PMS → CRS | Availability, rates |
| CRS → PMS | Reservations, modifications, cancellations |

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

| Requirement | Implementation |
|-------------|----------------|
| Authentication | API keys, OAuth 2.0, JWT |
| Encryption | TLS 1.2+ for transit |
| PCI compliance | Tokenize card data |
| Rate limiting | Per-client throttling |
| Audit logging | All API calls logged |
| IP allowlisting | Optional additional security |

---

[← Back to Overview](../README.md)
