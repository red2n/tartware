# Category 6: Channel Management & OTA Tables

**Purpose**: Distribution channel integrations, OTA platforms, rate parity, and commission management

## Tables in this Category (7 tables)

### 18_channel_mappings.sql
- **Table**: `channel_mappings`
- **Purpose**: Map internal room types to external OTA/channel room types
- **Key Features**:
  - Channel-specific room code mapping
  - Bi-directional sync support
  - Active/inactive status

### 38_ota_configurations.sql
- **Table**: `ota_configurations`
- **Purpose**: OTA platform connection settings
- **Key Features**:
  - API credentials storage (encrypted)
  - Channel-specific settings (JSONB)
  - Sync frequency configuration
  - Active/inactive status per OTA

### 39_ota_rate_plans.sql
- **Table**: `ota_rate_plans`
- **Purpose**: Map internal rate plans to OTA-specific rate plans
- **Key Features**:
  - OTA rate plan code mapping
  - Markup/markdown configuration
  - Meal plan and cancellation policy mapping

### 40_ota_reservations_queue.sql
- **Table**: `ota_reservations_queue`
- **Purpose**: Queue for processing incoming OTA reservations
- **Key Features**:
  - Async reservation processing
  - Retry mechanism
  - Error tracking
  - Status workflow (pending → processing → completed/failed)

### 44_ota_inventory_sync.sql
- **Table**: `ota_inventory_sync`
- **Purpose**: Track room inventory synchronization with OTAs
- **Key Features**:
  - Availability sync status
  - Last sync timestamp
  - Error logging
  - Batch processing support

### 45_channel_rate_parity.sql
- **Table**: `channel_rate_parity`
- **Purpose**: Monitor rate parity across all distribution channels
- **Key Features**:
  - Rate comparison tracking
  - Parity violation detection
  - Automated alerts
  - Historical rate tracking

### 46_channel_commission_rules.sql
- **Table**: `channel_commission_rules`
- **Purpose**: Define commission structures for each channel
- **Key Features**:
  - Percentage or fixed amount commissions
  - Date-effective rules
  - Seasonal variations
  - Property-specific overrides

## Dependencies

- **Requires**: `properties`, `room_types`, `rates`
- **Used by**: `reservations`, `payments`, `invoices`

## Integration Flow

```
OTA Platform
    ↓
ota_configurations (credentials)
    ↓
channel_mappings (room type mapping)
    ↓
ota_rate_plans (rate plan mapping)
    ↓
ota_reservations_queue (incoming bookings)
    ↓
ota_inventory_sync (availability sync)
    ↓
channel_rate_parity (rate monitoring)
    ↓
channel_commission_rules (fee calculation)
```

## Supported OTA Platforms

- Booking.com
- Expedia/Hotels.com
- Airbnb
- Agoda
- TripAdvisor
- Custom channel managers

## Key Features

- **Two-way sync**: Inventory, rates, and reservations
- **Real-time updates**: Availability and pricing
- **Commission tracking**: Automated calculation
- **Rate parity**: Cross-channel monitoring
- **Error handling**: Retry logic and logging

## Notes

- Queue-based processing for reliability
- JSONB for flexible OTA-specific settings
- Comprehensive audit trail
- Soft delete support
- Multi-property support
