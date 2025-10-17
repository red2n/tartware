# Value-Added Tables Documentation

## Overview

This document describes the 6 new value-added tables added to the Tartware PMS to enhance competitive positioning with modern features for OTA integration, guest communication, and feedback management.

---

## New Tables Added

### 1. **ota_configurations** (Table 38)
**Purpose**: Store OTA API credentials and synchronization settings

**Key Features**:
- Multi-OTA support (Booking.com, Expedia, Airbnb, etc.)
- Sync status tracking and error logging
- Configurable sync frequency (default: 15 minutes)
- Commission tracking per OTA
- Support for direct integration or channel managers (SiteMinder, etc.)

**Use Cases**:
- Configure Booking.com API credentials
- Monitor sync health across all OTAs
- Track last successful sync timestamp
- Store OTA-specific property identifiers

**Critical Fields**:
- `ota_code`: Standard code (BOOKING_COM, EXPEDIA, AIRBNB)
- `hotel_id`: Property identifier in OTA system
- `sync_status`: PENDING, SUCCESS, FAILED, IN_PROGRESS
- `sync_frequency_minutes`: How often to push/pull data

---

### 2. **ota_rate_plans** (Table 39)
**Purpose**: Map internal rate plans to OTA-specific rate codes

**Key Features**:
- One-to-many mapping (one internal rate → multiple OTA rates)
- Dynamic pricing adjustments (markup/markdown by OTA)
- Booking window restrictions (min/max advance days)
- Length of stay requirements
- Inclusion rules (breakfast, taxes)

**Use Cases**:
- Map "Standard Rate" to Booking.com's "Non-refundable" rate
- Apply 10% markup for Expedia rates
- Set minimum 3-night stay for promotional rates
- Configure which rates include breakfast

**Critical Fields**:
- `rate_id`: Internal rate plan reference
- `ota_rate_plan_id`: OTA's rate plan code
- `markup_percentage`: Price adjustment for this OTA
- `min_advance_booking_days`: Booking window restriction

---

### 3. **ota_reservations_queue** (Table 40)
**Purpose**: Queue incoming OTA reservations for processing

**Key Features**:
- Async processing with retry logic (max 3 attempts)
- Duplicate detection by OTA reservation ID
- Raw payload storage for troubleshooting
- Status tracking (PENDING, PROCESSING, COMPLETED, FAILED)
- Link to created reservation after successful processing

**Use Cases**:
- Receive Booking.com reservation webhook
- Queue for processing during high-volume periods
- Retry failed reservations automatically
- Detect and reject duplicate bookings

**Critical Fields**:
- `ota_reservation_id`: OTA's unique reservation ID
- `status`: Processing status
- `processing_attempts`: Retry counter
- `raw_payload`: Complete OTA XML/JSON payload
- `reservation_id`: Link to created reservation

**Processing Flow**:
```
1. OTA sends reservation → Stored as PENDING
2. Background job picks up → Status = PROCESSING
3. Create reservation → Status = COMPLETED, link reservation_id
4. If error → Status = FAILED, increment attempts, retry later
5. If duplicate → Status = DUPLICATE, reject
```

---

### 4. **guest_communications** (Table 41)
**Purpose**: Track all guest communication history across channels

**Key Features**:
- Multi-channel support (EMAIL, SMS, PHONE, WHATSAPP, IN_PERSON, CHAT)
- Direction tracking (INBOUND, OUTBOUND)
- Email analytics (sent, delivered, opened, clicked)
- Link to guest and optionally to reservation
- Attachment metadata storage
- Template usage tracking

**Use Cases**:
- Send pre-arrival email with check-in instructions
- Log front desk phone conversation
- Track email open rates
- Store WhatsApp message history
- View complete communication timeline for a guest

**Critical Fields**:
- `communication_type`: EMAIL, SMS, PHONE, WHATSAPP, etc.
- `direction`: INBOUND or OUTBOUND
- `status`: SENT, DELIVERED, OPENED, CLICKED, FAILED
- `template_id`: If sent from template
- `opened_at`, `clicked_at`: Email engagement tracking

**Analytics Queries**:
```sql
-- Email open rate by property
SELECT
    property_id,
    COUNT(*) as sent,
    COUNT(opened_at) as opened,
    ROUND(100.0 * COUNT(opened_at) / COUNT(*), 2) as open_rate_pct
FROM guest_communications
WHERE communication_type = 'EMAIL'
    AND status = 'DELIVERED'
GROUP BY property_id;
```

---

### 5. **communication_templates** (Table 42)
**Purpose**: Pre-built message templates for automated and manual communications

**Key Features**:
- Multi-channel templates (EMAIL, SMS, WHATSAPP)
- Variable substitution ({{guest_name}}, {{check_in_date}})
- Automated sending based on triggers
- Trigger offset (e.g., send 24h before check-in)
- Multi-language support
- Usage tracking (how many times used)
- HTML and plain text versions

**Use Cases**:
- Create "Pre-Arrival Instructions" template
- Auto-send 24 hours before check-in
- Store WiFi password template
- Thank you message after checkout
- Marketing campaigns

**Critical Fields**:
- `template_code`: Unique identifier (PRE_ARRIVAL, THANK_YOU)
- `is_automated`: Auto-send based on trigger?
- `trigger_event`: BOOKING_CONFIRMED, CHECK_IN_MINUS_24H, CHECK_OUT
- `trigger_offset_hours`: -24 = 24 hours before, +1 = 1 hour after
- `variables`: Available placeholders like {{guest_name}}

**Trigger Examples**:
- `trigger_event = 'CHECK_IN'`, `trigger_offset_hours = -24` → Send 24h before check-in
- `trigger_event = 'CHECK_OUT'`, `trigger_offset_hours = 2` → Send 2h after checkout
- `trigger_event = 'BOOKING_CONFIRMED'`, `trigger_offset_hours = 0` → Send immediately

**Template Variables**:
```
{{guest_name}} → John Doe
{{property_name}} → Grand Hotel
{{check_in_date}} → 2025-10-20
{{check_out_date}} → 2025-10-23
{{room_number}} → 301
{{confirmation_number}} → ABC123456
{{wifi_password}} → guest2025
{{total_amount}} → $450.00
```

---

### 6. **guest_feedback** (Table 43)
**Purpose**: Store guest reviews, ratings, and feedback

**Key Features**:
- Overall rating + 7 category ratings (cleanliness, staff, location, etc.)
- Multiple rating scales (5-star or 10-point)
- Multi-source (email survey, SMS, Google, TripAdvisor, Booking.com)
- AI sentiment analysis (score + label)
- Public/private reviews
- Featured review flagging for marketing
- Management response capability
- Tag extraction from reviews

**Use Cases**:
- Send post-stay survey via email
- Import reviews from Booking.com
- Flag low-rated stays for immediate follow-up
- Calculate average property rating
- Display featured reviews on website
- Track sentiment trends over time

**Critical Fields**:
- `overall_rating`: Main rating (0-5.00 or 0-10.00)
- `rating_scale`: 5 or 10 point scale
- Individual ratings: `cleanliness_rating`, `staff_rating`, `location_rating`, etc.
- `sentiment_score`: -1.00 to 1.00 (AI-calculated)
- `sentiment_label`: POSITIVE, NEUTRAL, NEGATIVE
- `is_public`: Show on website?
- `is_featured`: Featured review for marketing?
- `tags`: Extracted topics like ['clean', 'friendly staff', 'noisy']

**Sentiment Analysis**:
- Score: -1.00 (very negative) to 1.00 (very positive)
- Label: POSITIVE (>0.3), NEUTRAL (-0.3 to 0.3), NEGATIVE (<-0.3)
- Can use services like AWS Comprehend, Google NLP, or Azure Text Analytics

**Analytics Queries**:
```sql
-- Average rating by property
SELECT
    property_id,
    COUNT(*) as review_count,
    ROUND(AVG(overall_rating), 2) as avg_rating,
    ROUND(AVG(cleanliness_rating), 2) as avg_cleanliness,
    ROUND(AVG(staff_rating), 2) as avg_staff
FROM guest_feedback
WHERE is_verified = true
GROUP BY property_id;

-- Low ratings needing response
SELECT *
FROM guest_feedback
WHERE overall_rating < 3.0
    AND response_text IS NULL
    AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Sentiment trend over time
SELECT
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as reviews,
    ROUND(AVG(sentiment_score), 3) as avg_sentiment,
    COUNT(*) FILTER (WHERE sentiment_label = 'POSITIVE') as positive_count,
    COUNT(*) FILTER (WHERE sentiment_label = 'NEGATIVE') as negative_count
FROM guest_feedback
WHERE property_id = 'xxx'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

---

## Database Schema Relationships

### Foreign Key Dependencies

```
ota_configurations
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  └─ created_by, updated_by → users(id)

ota_rate_plans
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  ├─ ota_configuration_id → ota_configurations(id)
  ├─ rate_id → rates(id)
  └─ created_by, updated_by → users(id)

ota_reservations_queue
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  ├─ ota_configuration_id → ota_configurations(id)
  └─ reservation_id → reservations(reservation_id)

guest_communications
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  ├─ guest_id → guests(id)
  ├─ reservation_id → reservations(reservation_id)
  ├─ template_id → communication_templates(id)
  └─ created_by → users(id)

communication_templates
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  └─ created_by, updated_by → users(id)

guest_feedback
  ├─ tenant_id → tenants(id)
  ├─ property_id → properties(id)
  ├─ guest_id → guests(id)
  ├─ reservation_id → reservations(reservation_id)
  └─ responded_by → users(id)
```

---

## Installation Order

**IMPORTANT**: Tables must be created in this order due to foreign key dependencies:

1. **communication_templates** (no dependencies on other new tables)
2. **ota_configurations** (no dependencies on other new tables)
3. **ota_rate_plans** (depends on ota_configurations)
4. **ota_reservations_queue** (depends on ota_configurations)
5. **guest_communications** (depends on communication_templates)
6. **guest_feedback** (no dependencies on other new tables)

---

## Performance Optimization

### Critical Indexes Created

**OTA Tables**:
- `ota_configurations`: Indexed on `sync_status` and `last_sync_at` for background sync jobs
- `ota_rate_plans`: Indexed on `ota_configuration_id` + `rate_id` for fast lookups
- `ota_reservations_queue`: Indexed on `status` + `created_at` for queue processing

**Communication Tables**:
- `guest_communications`: Indexed on `guest_id`, `status`, and timestamp fields
- `communication_templates`: Indexed on `is_automated` + `trigger_event` for background jobs
- `guest_feedback`: Indexed on `overall_rating`, `sentiment_score`, and `is_public`

### Full-Text Search Indexes

Using PostgreSQL's `GIN` indexes for text search:
- `guest_communications.message`: Full-text search on message content
- `communication_templates.body`: Search template content
- `guest_feedback.review_text`: Search guest reviews

### JSONB Indexes

GIN indexes on JSONB columns for fast queries:
- `ota_configurations.configuration_json`
- `ota_reservations_queue.raw_payload`
- `guest_communications.attachments`, `metadata`
- `communication_templates.variables`, `metadata`
- `guest_feedback.tags`, `metadata`

---

## Multi-Tenant Isolation

All 6 tables include `tenant_id` with foreign key to `tenants(id)` and `ON DELETE CASCADE`:
- ✅ Complete tenant data isolation
- ✅ Cascade delete when tenant is removed
- ✅ All queries filterable by tenant
- ✅ **Shard-ready** for enterprise scaling

---

## Soft Delete Support

5 out of 6 tables support soft delete with `deleted_at` column:
- ✅ `ota_configurations`
- ✅ `ota_rate_plans`
- ✅ `communication_templates`
- ❌ `ota_reservations_queue` (queue table, hard delete OK)
- ❌ `guest_communications` (audit trail, no delete)
- ❌ `guest_feedback` (legal requirement, no delete)

All indexes include `WHERE deleted_at IS NULL` for performance.

---

## Integration Points

### OTA Integration Workflow

```
1. Setup:
   - Create ota_configurations with API credentials
   - Map rates in ota_rate_plans

2. Rate & Availability Push (every 15 min):
   - Read ota_configurations WHERE sync_enabled = true
   - Push room_availability to OTA
   - Push rates with markup/markdown from ota_rate_plans
   - Update last_sync_at and sync_status

3. Reservation Pull:
   - OTA webhook → Insert into ota_reservations_queue
   - Background job picks up PENDING reservations
   - Create reservation → Update queue status = COMPLETED
   - Link reservation_id in queue table
```

### Communication Workflow

```
1. Manual Send:
   - User selects template from communication_templates
   - Variables replaced: {{guest_name}} → "John Doe"
   - Record in guest_communications
   - Send via email/SMS provider
   - Track delivery status

2. Automated Send:
   - Background job runs every 15 minutes
   - Find templates WHERE is_automated = true
   - Calculate trigger time (e.g., check_in - 24h)
   - Find matching reservations
   - Send and record in guest_communications
```

### Feedback Collection Workflow

```
1. Post-Stay Survey:
   - Guest checks out
   - 2 hours later: auto-send survey email (from template)
   - Guest clicks link → Opens survey form
   - Submit → Record in guest_feedback

2. External Review Import:
   - Daily job fetches Booking.com reviews via API
   - Insert into guest_feedback
   - Set feedback_source = 'BOOKING_COM'
   - Link to reservation by booking reference

3. Response Management:
   - Daily report: Low ratings needing response
   - Manager responds → Update response_text
   - Set responded_by and responded_at
```

---

## Business Value

### ROI Metrics

**OTA Integration** (Tables 38-40):
- **Revenue Impact**: 30-50% of bookings typically come from OTAs
- **Time Savings**: Eliminates manual rate/availability updates (4-8 hours/week)
- **Accuracy**: Prevents overbooking from sync delays
- **Competitive**: Must-have feature for modern PMS

**Guest Communication** (Tables 41-42):
- **Efficiency**: 60% reduction in manual communication time
- **Guest Satisfaction**: Timely, consistent communication
- **Marketing**: Automated campaigns increase direct bookings 15-20%
- **Staff Productivity**: Pre-built templates save 10+ hours/week

**Guest Feedback** (Table 43):
- **Reputation Management**: Quick response to negative reviews
- **Revenue Impact**: 1-star rating increase = 5-9% revenue boost
- **Insights**: Identify operational issues early
- **Marketing**: Featured positive reviews drive bookings

---

## Sample Data Queries

### Top OTAs by Bookings
```sql
SELECT
    oc.ota_name,
    COUNT(DISTINCT oq.reservation_id) as booking_count,
    SUM(oq.total_amount) as total_revenue,
    ROUND(AVG(oc.commission_percentage), 2) as avg_commission_pct
FROM ota_configurations oc
JOIN ota_reservations_queue oq ON oq.ota_configuration_id = oc.id
WHERE oq.status = 'COMPLETED'
    AND oq.processed_at >= NOW() - INTERVAL '30 days'
GROUP BY oc.ota_name
ORDER BY total_revenue DESC;
```

### Communication Engagement Report
```sql
SELECT
    communication_type,
    COUNT(*) as sent,
    COUNT(delivered_at) as delivered,
    COUNT(opened_at) as opened,
    COUNT(clicked_at) as clicked,
    ROUND(100.0 * COUNT(opened_at) / NULLIF(COUNT(delivered_at), 0), 2) as open_rate,
    ROUND(100.0 * COUNT(clicked_at) / NULLIF(COUNT(opened_at), 0), 2) as click_rate
FROM guest_communications
WHERE created_at >= NOW() - INTERVAL '30 days'
    AND direction = 'OUTBOUND'
GROUP BY communication_type;
```

### Property Rating Dashboard
```sql
SELECT
    p.name as property_name,
    COUNT(gf.id) as review_count,
    ROUND(AVG(gf.overall_rating), 2) as avg_rating,
    ROUND(AVG(gf.cleanliness_rating), 2) as cleanliness,
    ROUND(AVG(gf.staff_rating), 2) as staff,
    ROUND(AVG(gf.location_rating), 2) as location,
    ROUND(AVG(gf.value_rating), 2) as value,
    COUNT(*) FILTER (WHERE gf.overall_rating >= 4) as positive_reviews,
    COUNT(*) FILTER (WHERE gf.overall_rating < 3) as negative_reviews,
    COUNT(*) FILTER (WHERE gf.response_text IS NULL AND gf.overall_rating < 3) as needs_response
FROM guest_feedback gf
JOIN properties p ON p.id = gf.property_id
WHERE gf.created_at >= NOW() - INTERVAL '90 days'
GROUP BY p.id, p.name
ORDER BY avg_rating DESC;
```

---

## Next Steps

### Recommended Additional Tables (Phase 2)

If these 6 tables prove successful, consider adding:

1. **guest_loyalty_programs** - Loyalty points and tiers
2. **revenue_forecasts** - AI-based revenue predictions
3. **competitor_rates** - Rate shopping data
4. **mobile_keys** - Digital room key management
5. **promotional_codes** - Discount code management
6. **tax_configurations** - Tax rates by jurisdiction
7. **automated_messages** - Scheduled message queue
8. **cashier_sessions** - Cash drawer management

### Integration Requirements

- **Email Provider**: SendGrid, AWS SES, Mailgun
- **SMS Provider**: Twilio, AWS SNS, Vonage
- **Sentiment Analysis**: AWS Comprehend, Google NLP, Azure Text Analytics
- **OTA APIs**: Booking.com Connectivity API, Expedia EQC, Airbnb API

---

## Conclusion

These 6 tables add **critical competitive features** to Tartware PMS:

✅ **OTA Integration** - Connect to major booking channels
✅ **Guest Communication** - Professional, automated messaging
✅ **Feedback Management** - Protect and enhance reputation

**Total Impact**: Positions Tartware as a **modern, competitive PMS** ready for market.

---

**Last Updated**: October 17, 2025
**Tables Added**: 38-43 (6 tables)
**Indexes Created**: 96 indexes
**Foreign Keys**: 23 constraints
