-- =====================================================
-- 103_event_bookings.sql
-- Event & Function Booking Management
--
-- Purpose: Track event bookings for meeting rooms
-- Industry Standard: OPERA (BOOKING_MASTER), Delphi.fdc (EVENT),
--                    Protel (VERANSTALTUNG), EventPro (FUNCTION)
--
-- Use Cases:
-- - Corporate meetings and conferences
-- - Weddings and receptions
-- - Training seminars
-- - Social events
-- - Multi-day conferences
--
-- Links to meeting_rooms and banquet_event_orders
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS event_bookings CASCADE;

CREATE TABLE event_bookings (
    -- Primary Key
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique event identifier

-- Multi-tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Event Information
event_number VARCHAR(50), -- Human-readable event number
event_name VARCHAR(200) NOT NULL, -- Event title
event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN (
        'MEETING',
        'CONFERENCE',
        'WEDDING',
        'BANQUET',
        'TRAINING',
        'WORKSHOP',
        'RECEPTION',
        'SEMINAR',
        'TRADE_SHOW',
        'PARTY',
        'FUNDRAISER',
        'EXHIBITION',
        'OTHER'
    )
),

-- Meeting Room
meeting_room_id UUID NOT NULL, -- Reference to meeting_rooms

-- Date & Time
event_date DATE NOT NULL, -- Calendar date for event
start_time TIME NOT NULL, -- Scheduled start time
end_time TIME NOT NULL, -- Scheduled end time
setup_start_time TIME, -- When setup crew can start
actual_start_time TIME, -- Actual start time
actual_end_time TIME, -- Actual end time
teardown_end_time TIME, -- When room must be clear

-- Guest/Organizer Information
organizer_name VARCHAR(200) NOT NULL, -- Primary organizer
organizer_company VARCHAR(200), -- Company hosting event
organizer_email VARCHAR(255), -- Organizer contact email
organizer_phone VARCHAR(20), -- Organizer contact phone
contact_person VARCHAR(200), -- Onsite contact
contact_email VARCHAR(255), -- Onsite contact email
contact_phone VARCHAR(20), -- Onsite contact phone
contact_address VARCHAR(500), -- Onsite contact address

-- Linked Entities
guest_id UUID, -- If booked by hotel guest
reservation_id UUID, -- If part of hotel stay
company_id UUID, -- If corporate booking
group_booking_id UUID, -- If part of group block
sales_lead_id UUID, -- Reference to sales leads
banquet_event_order_id UUID, -- Link to BEO
parent_booking_id UUID, -- For modifications or related events
referral_source_id UUID, -- Marketing referral source
assigned_event_planner_id UUID, -- Staff assigned to event

-- Expected Attendance
expected_attendees INTEGER NOT NULL, -- Forecast headcount
confirmed_attendees INTEGER, -- Confirmed headcount
actual_attendees INTEGER, -- Actual turnout
guarantee_number INTEGER, -- Minimum number for billing
max_capacity INTEGER, -- Room max capacity
vip_guest_count INTEGER, -- Number of VIPs attending
attendee_demographics JSONB, -- Age groups, professions, etc.

-- Room Setup
setup_type VARCHAR(50) NOT NULL CHECK (
    setup_type IN (
        'THEATER',
        'CLASSROOM',
        'BANQUET',
        'RECEPTION',
        'U_SHAPE',
        'HOLLOW_SQUARE',
        'BOARDROOM',
        'CABARET',
        'COCKTAIL',
        'CUSTOM'
    )
),
setup_details TEXT, -- Additional setup instructions
special_requests TEXT, -- Client special requests
setup_diagram_url VARCHAR(500), -- Link to setup diagram
signage_requirements TEXT, -- Signage instructions
accessibility_requirements TEXT, -- ADA or special needs
decoration_details TEXT, -- Decoration instructions
theme VARCHAR(100), -- Event theme
color_scheme VARCHAR(100), -- Preferred colors
floral_arrangements TEXT, -- Floral details
audio_visual_needed BOOLEAN DEFAULT FALSE, -- AV required
lighting_requirements TEXT, -- Lighting specifics
stage_requirements TEXT, -- Stage setup details
podium_required BOOLEAN DEFAULT FALSE, -- Podium needed
microphone_count INTEGER, -- Number of microphones
internet_access_required BOOLEAN DEFAULT FALSE, -- Wi-Fi or wired access
bandwidth_requirements VARCHAR(100), -- e.g., "High-Speed", "Standard
networking_requirements TEXT, -- LAN/WAN needs
recording_required BOOLEAN DEFAULT FALSE, -- Recording services needed
live_streaming_required BOOLEAN DEFAULT FALSE, -- Live streaming needed
photographer_required BOOLEAN DEFAULT FALSE, -- Photographer needed
videographer_required BOOLEAN DEFAULT FALSE, -- Videographer needed
signage_url VARCHAR(500), -- Link to signage design
irst_affiliate_marketing BOOLEAN DEFAULT FALSE, -- If using 1st party affiliate marketing
social_media_integration BOOLEAN DEFAULT FALSE, -- Social media needs
event_app_required BOOLEAN DEFAULT FALSE, -- If event app is needed
qr_code_integration BOOLEAN DEFAULT FALSE, -- QR code needs
mobile_checkin_required BOOLEAN DEFAULT FALSE, -- Mobile check-in needed
badge_printing_required BOOLEAN DEFAULT FALSE, -- Badge printing needed
transportation_arrangements TEXT, -- Shuttle or transport details
parking_requirements TEXT, -- Parking needs
security_requirements TEXT, -- Security details
emergency_plan_details TEXT, -- Emergency procedures

-- Equipment & AV Requirements
required_equipment JSONB DEFAULT '[]'::jsonb, -- Non-AV equipment needs
    av_requirements JSONB DEFAULT '[]'::jsonb, -- AV specifics
    technical_contact_name VARCHAR(200), -- Onsite tech contact
    technical_contact_email VARCHAR(255), -- Onsite tech email
    technical_contact_phone VARCHAR(20), -- Onsite tech phone
    rehearsal_date DATE, -- Rehearsal date
    rehearsal_start_time TIME,  -- Rehearsal start time
    rehearsal_end_time TIME, -- Rehearsal end time
    sound_check_required BOOLEAN DEFAULT FALSE, -- Sound check needed
    lighting_check_required BOOLEAN DEFAULT FALSE, -- Lighting check needed
    av_setup_time TIME, -- AV setup start time
    av_teardown_time TIME, -- AV teardown time
    presentation_materials_required BOOLEAN DEFAULT FALSE, -- Presentation materials needed
    webcast_required BOOLEAN DEFAULT FALSE, -- Webcast services needed
    simultaneous_translation_required BOOLEAN DEFAULT FALSE, -- Translation services needed
    interpretation_services_required BOOLEAN DEFAULT FALSE, -- Interpretation services needed
    equipment_rental_details TEXT, -- Equipment rental specifics
    room_visualization_3d_url VARCHAR(500), -- Link to 3D room visualization
    -- Program & Agenda
    agenda_details TEXT, -- Event agenda
    speaker_list JSONB, -- List of speakers
    session_details JSONB, -- Session breakdowns
    breakout_room_requirements JSONB, -- Breakout room needs
    workshop_requirements JSONB, -- Workshop specifics
    panel_discussion_details TEXT, -- Panel discussion info
    entertainment_details TEXT, -- Entertainment specifics
    awards_ceremony_details TEXT, -- Awards ceremony info
    keynote_speaker VARCHAR(200), -- Keynote speaker name
    opening_remarks_by VARCHAR(200), -- Opening remarks by
    closing_remarks_by VARCHAR(200), -- Closing remarks by
    networking_event_details TEXT, -- Networking event info

-- Catering
catering_required BOOLEAN DEFAULT FALSE, -- Is catering needed
catering_service_type VARCHAR(50), -- BREAKFAST, LUNCH, DINNER, BREAK, RECEPTION
food_beverage_minimum DECIMAL(10, 2), -- Minimum spend
menu_selections JSONB, -- Menu choices
dietary_restrictions TEXT, -- Dietary needs
bar_service_required BOOLEAN DEFAULT FALSE, -- Is bar service needed
alcohol_permit_required BOOLEAN DEFAULT FALSE, -- Alcohol permit needed
catering_contact_name VARCHAR(200), -- Catering contact
catering_contact_email VARCHAR(255), -- Catering contact email
catering_contact_phone VARCHAR(20), -- Catering contact phone

-- Status
booking_status VARCHAR(20) NOT NULL DEFAULT 'TENTATIVE' -- Overall status
CHECK (
    booking_status IN (
        'INQUIRY',
        'TENTATIVE',
        'DEFINITE',
        'CONFIRMED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    )
),
confirmation_status VARCHAR(20), -- CONFIRMED, PENDING, CANCELLED
CHECK (
    confirmation_status IN (
        'CONFIRMED',
        'PENDING',
        'CANCELLED'
    )
),
payment_status VARCHAR(20) DEFAULT 'PENDING' -- PENDING, DEPOSIT_PAID, PARTIALLY_PAID, PAID, REFUNDED, WAIVED
CHECK (
    payment_status IN (
        'PENDING',
        'DEPOSIT_PAID',
        'PARTIALLY_PAID',
        'PAID',
        'REFUNDED',
        'WAIVED'
    )
),

-- Dates & Deadlines
booked_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date booking created
confirmed_date DATE, -- Date moved to definite status
beo_due_date DATE, -- Banquet Event Order deadline
final_count_due_date DATE, -- Final attendee count deadline (usually 72 hours prior)
cancellation_deadline DATE, -- Last date to cancel without penalty
decision_date DATE, -- Convert from tentative to definite
last_modified_date TIMESTAMP, -- Last modification timestamp
event_completion_date TIMESTAMP, -- When event was completed
cancellation_date TIMESTAMP, -- When event was cancelled
no_show_date TIMESTAMP, -- When event was marked no-show
reschedule_date TIMESTAMP, -- When event was rescheduled
reminder_sent_date TIMESTAMP, -- When reminder was sent to organizer
followup_date TIMESTAMP, -- Date for post-event follow-up
survey_sent_date TIMESTAMP, -- Date feedback survey was sent
survey_completed_date TIMESTAMP, -- Date feedback survey was completed
feedback_received_date TIMESTAMP, -- Date feedback was received
invoice_sent_date TIMESTAMP, -- Date invoice was sent
payment_received_date TIMESTAMP, -- Date payment was received
deposit_received_date TIMESTAMP, -- Date deposit was received
final_payment_date TIMESTAMP, -- Date final payment was made
event_planner_assigned_date TIMESTAMP, -- Date event planner was assigned
setup_completed_date TIMESTAMP, -- Date setup was completed
teardown_completed_date TIMESTAMP, -- Date teardown was completed
equipment_setup_date TIMESTAMP, -- Date equipment was set up
equipment_teardown_date TIMESTAMP, -- Date equipment was torn down
rehearsal_completed_date TIMESTAMP, -- Date rehearsal was completed
catering_confirmed_date TIMESTAMP, -- Date catering was confirmed
av_confirmed_date TIMESTAMP, -- Date AV requirements were confirmed
security_confirmed_date TIMESTAMP, -- Date security arrangements were confirmed
transportation_confirmed_date TIMESTAMP, -- Date transportation arrangements were confirmed
parking_confirmed_date TIMESTAMP, -- Date parking arrangements were confirmed
decoration_completed_date TIMESTAMP, -- Date decorations were completed
signage_completed_date TIMESTAMP, -- Date signage was completed
marketing_materials_sent_date TIMESTAMP, -- Date marketing materials were sent
social_media_posts_scheduled_date TIMESTAMP, -- Date social media posts were scheduled
event_app_launched_date TIMESTAMP, -- Date event app was launched
qr_codes_generated_date TIMESTAMP, -- Date QR codes were generated
mobile_checkin_setup_date TIMESTAMP, -- Date mobile check-in was set up
badge_printing_completed_date TIMESTAMP, -- Date badge printing was completed

-- Financial Information
rental_rate DECIMAL(10, 2), -- Space rental fee
setup_fee DECIMAL(10, 2), -- Setup labor fee
equipment_rental_fee DECIMAL(10, 2), -- Non-AV equipment rental fee
av_equipment_fee DECIMAL(10, 2), -- AV equipment rental fee
labor_charges DECIMAL(10, 2), -- Labor costs
service_charge_percent DECIMAL(5, 2), -- Service charge %
tax_rate DECIMAL(5, 2), -- Tax rate applied
estimated_food_beverage DECIMAL(10, 2), -- Estimated F&B cost
estimated_total DECIMAL(12, 2), -- Estimated total cost
actual_total DECIMAL(12, 2), -- Actual total cost
currency_code CHAR(3) DEFAULT 'USD', -- Currency code (ISO 4217)
discount_amount DECIMAL(10, 2), -- Any discounts applied
cancellation_fee DECIMAL(10, 2), -- Fee if cancelled
no_show_fee DECIMAL(10, 2), -- Fee if no-show
tax_exempt BOOLEAN DEFAULT FALSE, -- Is the event tax-exempt
tax_exempt_certificate_url VARCHAR(500), -- Link to tax-exempt certificate

-- Deposit & Payment
deposit_required DECIMAL(10, 2), -- Deposit amount
deposit_paid DECIMAL(10, 2), -- Amount received
deposit_due_date DATE, -- Deposit payment deadline
final_payment_amount DECIMAL(10, 2), -- Final payment amount
final_payment_due DATE, -- Final payment deadline
payment_terms TEXT, -- Payment terms and conditions
refund_policy TEXT, -- Refund terms
invoice_number VARCHAR(50), -- Linked invoice number
receipt_number VARCHAR(50), -- Linked payment receipt number

-- Linked Documents
contract_signed BOOLEAN DEFAULT FALSE, -- Is contract signed
contract_signed_date DATE, -- Date contract was signed
contract_url VARCHAR(500), -- Link to contract document
beo_pdf_url VARCHAR(500), -- Link to Banquet Event Order PDF
floor_plan_url VARCHAR(500), -- Link to event floor plan
seating_chart_url VARCHAR(500), -- Link to seating chart
menu_pdf_url VARCHAR(500), -- Link to menu PDF
av_requirements_pdf_url VARCHAR(500), -- Link to AV requirements PDF
catering_agreement_url VARCHAR(500), -- Link to catering agreement
insurance_certificate_url VARCHAR(500), -- Link to insurance certificate
permits_obtained TEXT, -- List of permits obtained
health_safety_measures TEXT, -- Health and safety protocols
covid19_guidelines TEXT, -- COVID-19 specific guidelines
emergency_contact_name VARCHAR(200), -- Emergency contact person
emergency_contact_phone VARCHAR(20), -- Emergency contact phone number
emergency_contact_email VARCHAR(255), -- Emergency contact email
evacuation_plan_url VARCHAR(500), -- Link to evacuation plan document

-- Billing
folio_id UUID, -- Reference to folios for charges
    billing_instructions TEXT,  -- Special billing instructions
    billing_contact_name VARCHAR(200),  -- Billing contact person
    billing_contact_email VARCHAR(255), -- Billing contact email
    payment_method VARCHAR(50), -- CREDIT_CARD, BANK_TRANSFER, CHECK, CASH
    card_on_file BOOLEAN DEFAULT FALSE, -- Is credit card on file
    last_four_card_digits CHAR(4), -- Last 4 digits of card
    billing_address VARCHAR(500), -- Billing address
    tax_identification_number VARCHAR(50), -- TIN for billing
    purchase_order_number VARCHAR(50), -- PO number if applicable
    billing_cycle VARCHAR(20) DEFAULT 'ONE_TIME' -- ONE_TIME, MONTHLY, QUARTERLY, ANNUALLY
        CHECK (billing_cycle IN ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUALLY')),
    ird_number VARCHAR(50), -- Tax ID for invoicing
    vat_number VARCHAR(50), -- VAT number for invoicing
    gst_number VARCHAR(50), -- GST number for invoicing
    sst_number VARCHAR(50), -- SST number for invoicing
    withholding_tax_rate DECIMAL(5, 2), -- Withholding tax rate if applicable
    -- Staffing
    event_planner_id UUID, -- Assigned event planner
    catering_manager_id UUID, -- Assigned catering manager
    av_coordinator_id UUID, -- Assigned AV coordinator
    setup_crew_lead_id UUID, -- Setup crew lead
    teardown_crew_lead_id UUID, -- Teardown crew lead
    security_manager_id UUID, -- Assigned security manager
    cleaning_crew_lead_id UUID, -- Cleaning crew lead
    technical_support_id UUID, -- Technical support contact
    staffing_requirements JSONB DEFAULT '[]'::jsonb, -- Additional staffing needs
    event_staffing_details JSONB, -- Detailed staffing assignments
    volunteer_coordinator_id UUID, -- Volunteer coordinator if applicable
    volunteer_requirements JSONB DEFAULT '[]'::jsonb, -- Volunteer needs
    staffing_schedule JSONB, -- Staffing schedule details

-- Marketing & Attribution
booking_source VARCHAR(50), -- WEB, PHONE, EMAIL, WALK_IN, REFERRAL
lead_source VARCHAR(100), -- Marketing lead source
sales_manager_id UUID, -- Assigned sales manager
commission_rate DECIMAL(5, 2), -- Commission percentage
promotional_code VARCHAR(50), -- Applied promo code
affiliate_partner_id UUID, -- Affiliate partner if applicable
marketing_campaign_id UUID, -- Linked marketing campaign
advertising_channel VARCHAR(100), -- Advertising channel used
social_media_platforms JSONB, -- Social media platforms used
email_marketing_list_id UUID, -- Email marketing list reference
referral_contact_name VARCHAR(200), -- Referral contact person
referral_contact_email VARCHAR(255), -- Referral contact email
referral_contact_phone VARCHAR(20), -- Referral contact phone
customer_loyalty_id UUID, -- Linked loyalty program ID
discount_code_used VARCHAR(50), -- Discount code applied
special_offers_applied TEXT, -- Details of special offers applied

-- Event Performance Metrics
attendee_satisfaction_score DECIMAL(3, 2) CHECK (
    attendee_satisfaction_score BETWEEN 1.0 AND 5.0
), -- Avg satisfaction score
net_promoter_score INTEGER CHECK (
    net_promoter_score BETWEEN -100 AND 100
), -- NPS value
repeat_booking_likelihood DECIMAL(3, 2) CHECK (
    repeat_booking_likelihood BETWEEN 0.0 AND 1.0
), -- Likelihood of repeat
social_media_mentions INTEGER, -- Number of social media mentions
survey_response_rate DECIMAL(5, 2) CHECK (
    survey_response_rate BETWEEN 0.0 AND 100.0
), -- Survey response %
average_dwell_time_minutes INTEGER, -- Avg time attendees stayed
conversion_rate DECIMAL(5, 2) CHECK (
    conversion_rate BETWEEN 0.0 AND 100.0
), -- Conversion rate %
revenue_per_attendee DECIMAL(10, 2), -- Revenue generated per attendee
cost_per_attendee DECIMAL(10, 2), -- Cost incurred per attendee
profit_margin_percent DECIMAL(5, 2) CHECK (
    profit_margin_percent BETWEEN 0.0 AND 100.0
), -- Profit margin %
event_rating VARCHAR(20) CHECK (
    event_rating IN (
        'EXCELLENT',
        'GOOD',
        'FAIR',
        'POOR'
    )
), -- Overall event rating
lessons_learned TEXT, -- Post-event analysis
improvement_areas TEXT, -- Areas for improvement
success_stories TEXT, -- Highlights and successes
challenges_faced TEXT, -- Challenges encountered
key_performance_indicators JSONB, -- KPIs tracked

-- Post-Event
post_event_feedback TEXT, -- Feedback notes
post_event_rating INTEGER CHECK (
    post_event_rating BETWEEN 1 AND 5
), -- Post-event rating
issues_reported TEXT, -- Any issues during event
followup_required BOOLEAN DEFAULT FALSE, -- Is follow-up needed
followup_actions TEXT, -- Actions to be taken
survey_results JSONB, -- Survey data
testimonials_collected TEXT, -- Collected testimonials
case_study_created BOOLEAN DEFAULT FALSE, -- Is case study created
media_coverage_details TEXT, -- Media coverage info
post_event_photos_url VARCHAR(500), -- Link to event photos
post_event_videos_url VARCHAR(500), -- Link to event videos

-- Repeat Booking
is_recurring BOOLEAN DEFAULT FALSE, -- Is this a recurring event
recurring_pattern VARCHAR(100), -- WEEKLY, MONTHLY, YEARLY
parent_event_id UUID, -- If part of recurring series
series_id UUID, -- Group recurring events

-- Risk Management
security_required BOOLEAN DEFAULT FALSE, -- Is security needed
insurance_required BOOLEAN DEFAULT FALSE, -- Is insurance needed
liability_waiver_signed BOOLEAN DEFAULT FALSE, -- Has liability waiver been signed

-- Notes
internal_notes TEXT, -- Staff-only notes
public_notes TEXT, -- Notes visible to all attendees
setup_notes TEXT, -- Setup instructions and details
billing_notes TEXT, -- Billing and payment notes
cancellation_notes TEXT, -- Cancellation details
feedback_notes TEXT, -- Post-event feedback notes
special_instructions TEXT, -- Any special instructions
additional_requirements TEXT, -- Any additional requirements

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Extensibility payload

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last update timestamp
created_by UUID, -- Creator
updated_by UUID, -- Modifier
confirmed_by UUID, -- User who confirmed event

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Deletion timestamp
deleted_by UUID, -- User who deleted

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Concurrency version

-- Constraints
CONSTRAINT event_bookings_time_check CHECK (end_time > start_time),
    CONSTRAINT event_bookings_setup_time_check CHECK (
        setup_start_time IS NULL OR start_time IS NULL OR setup_start_time <= start_time
    ),
    CONSTRAINT event_bookings_attendees_check CHECK (expected_attendees > 0),
    CONSTRAINT event_bookings_rating_check CHECK (
        post_event_rating IS NULL OR (post_event_rating >= 1 AND post_event_rating <= 5)
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE event_bookings IS 'Event and function bookings for meeting rooms and event spaces';

COMMENT ON COLUMN event_bookings.event_id IS 'Unique event booking identifier (UUID)';

COMMENT ON COLUMN event_bookings.event_number IS 'Human-readable event number (e.g., "EVT-2025-001")';

COMMENT ON COLUMN event_bookings.meeting_room_id IS 'Reference to meeting_rooms.room_id';

COMMENT ON COLUMN event_bookings.setup_type IS 'Room arrangement: THEATER, CLASSROOM, BANQUET, etc.';

COMMENT ON COLUMN event_bookings.guarantee_number IS 'Minimum attendees for billing purposes';

COMMENT ON COLUMN event_bookings.beo_due_date IS 'Deadline for finalized Banquet Event Order';

COMMENT ON COLUMN event_bookings.final_count_due_date IS 'Deadline for final attendee count (usually 72 hours before)';

COMMENT ON COLUMN event_bookings.booking_status IS 'Current status: INQUIRY, TENTATIVE, DEFINITE, CONFIRMED, etc.';

COMMENT ON COLUMN event_bookings.series_id IS 'Groups recurring events together';

COMMENT ON COLUMN event_bookings.metadata IS 'Custom fields and additional event details';

\echo 'Event bookings table created successfully!'
