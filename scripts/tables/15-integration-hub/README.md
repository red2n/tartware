# Category 15: Integration Hub Tables

**Purpose**: API integrations, webhook management, external system synchronization, and logging

## Tables in this Category (4 tables)

### 86_integration_mappings.sql
- **Table**: `integration_mappings`
- **Purpose**: Map internal entities to external system identifiers
- **Key Features**:
  - Entity type mapping (guest, reservation, room, etc.)
  - External system ID storage
  - Bi-directional mapping support
  - Sync status tracking
  - Configuration metadata (JSONB)

### 87_api_logs.sql
- **Table**: `api_logs`
- **Purpose**: Comprehensive API request/response logging
- **Key Features**:
  - Full request/response capture
  - Performance timing (duration_ms)
  - HTTP status code tracking
  - Error message storage
  - IP address and user agent logging
  - User attribution

### 88_webhook_subscriptions.sql
- **Table**: `webhook_subscriptions`
- **Purpose**: Manage outbound webhook subscriptions
- **Key Features**:
  - Event-based triggers
  - HTTP endpoint configuration
  - Authentication header support
  - Retry policies
  - Active/inactive status
  - Event filtering

### 89_data_sync_status.sql
- **Table**: `data_sync_status`
- **Purpose**: Track synchronization status with external systems
- **Key Features**:
  - Entity-level sync tracking
  - Last sync timestamp
  - Success/failure status
  - Error logging
  - Sync direction (inbound/outbound/bidirectional)
  - Retry counter

## Dependencies

- **Requires**: All primary entities (tenants, properties, guests, reservations, etc.)
- **Standalone**: Can function independently for API logging

## Integration Architecture

```
External System
    ↓
API Request
    ↓
api_logs (logging)
    ↓
integration_mappings (ID translation)
    ↓
Internal Processing
    ↓
data_sync_status (tracking)
    ↓
webhook_subscriptions (notifications)
    ↓
External System (callback)
```

## Common Integration Scenarios

### 1. **PMS → External CRM**
- Map guest IDs via `integration_mappings`
- Track sync status in `data_sync_status`
- Log all API calls in `api_logs`

### 2. **External Booking Engine → PMS**
- Receive reservation data
- Map external IDs to internal entities
- Send confirmation webhook

### 3. **PMS → Revenue Management System**
- Export rate and availability data
- Track sync status
- Receive pricing recommendations via API

### 4. **PMS → Accounting System**
- Sync invoices and payments
- Map chart of accounts
- Track synchronization status

## Supported Integration Types

- **REST APIs**: Full request/response logging
- **Webhooks**: Event-driven notifications
- **Batch Sync**: Scheduled data synchronization
- **Real-time**: WebSocket/streaming support

## Key Features

### API Logging
- Request/response body capture (JSONB)
- Header storage for debugging
- Performance metrics
- Error tracking
- User attribution

### Webhook Management
- Event subscription
- Retry logic with exponential backoff
- Authentication support (Bearer, Basic, Custom)
- Payload customization
- Delivery confirmation

### Data Synchronization
- Entity-level tracking
- Bidirectional sync support
- Conflict resolution
- Error recovery
- Incremental sync

## Performance Considerations

- **api_logs**: High-volume table, consider partitioning by date
- **Indexes**: Optimized for timestamp and tenant queries
- **Retention**: Implement data retention policies (archive old logs)
- **JSONB**: Use GIN indexes for efficient JSON queries

## Security Notes

- API credentials stored encrypted in `integration_mappings.configuration`
- Webhook secrets hashed in `webhook_subscriptions.secret_key`
- API logs capture sensitive data - implement access controls
- IP address logging for security auditing

## Monitoring & Alerts

### Track these metrics:
- API error rate (from `api_logs`)
- Webhook delivery success rate
- Sync lag time (from `data_sync_status`)
- Failed integration attempts

### Alert on:
- High error rates (> 5%)
- Sync delays (> 1 hour)
- Webhook delivery failures
- Authentication errors

## Example Use Cases

1. **Salesforce Integration**: Track guest interactions
2. **QuickBooks Sync**: Financial data synchronization
3. **Channel Manager**: OTA connectivity
4. **Email Marketing**: Guest communication platform
5. **Business Intelligence**: Data warehouse sync
6. **POS Systems**: F&B integration
7. **Door Lock Systems**: Mobile key delivery
8. **Payment Gateways**: Transaction processing

## Notes

- All tables support multi-tenancy
- Soft delete implemented for data retention
- Comprehensive audit trails
- JSONB for flexible metadata storage
- UUID-based entity references
