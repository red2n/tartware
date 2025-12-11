-- =====================================================
-- reservations_projection.sql
-- Read model table fed by reservation events
-- Maintains denormalized fields for fast queries
-- =====================================================

\c tartware

\echo 'Creating reservations_projection table...'

CREATE TABLE IF NOT EXISTS reservations_projection (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    property_name TEXT,
    guest_id UUID,
    room_type_id UUID,
    room_type_name TEXT,
    confirmation_number VARCHAR(50),
    check_in_date TIMESTAMP WITH TIME ZONE,
    check_out_date TIMESTAMP WITH TIME ZONE,
    booking_date TIMESTAMP WITH TIME ZONE,
    actual_check_in TIMESTAMP WITH TIME ZONE,
    actual_check_out TIMESTAMP WITH TIME ZONE,
    room_number VARCHAR(50),
    number_of_adults INTEGER,
    number_of_children INTEGER,
    total_amount NUMERIC(15,2),
    paid_amount NUMERIC(15,2),
    balance_due NUMERIC(15,2),
    currency VARCHAR(3),
    status TEXT,
    status_display TEXT,
    source TEXT,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    version BIGINT DEFAULT 0,
    nights INTEGER DEFAULT 1,
    last_refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_event_id UUID,
    last_event_type TEXT,
    last_event_timestamp TIMESTAMP WITH TIME ZONE,
    lag_seconds DOUBLE PRECISION DEFAULT 0
);

CREATE INDEX IF NOT EXISTS reservations_projection_tenant_idx
  ON reservations_projection (tenant_id);
CREATE INDEX IF NOT EXISTS reservations_projection_property_idx
  ON reservations_projection (tenant_id, property_id);
CREATE INDEX IF NOT EXISTS reservations_projection_status_idx
  ON reservations_projection (tenant_id, status);
CREATE INDEX IF NOT EXISTS reservations_projection_search_idx
  ON reservations_projection USING GIN (to_tsvector('simple',
    coalesce(guest_name,'') || ' ' ||
    coalesce(guest_email,'') || ' ' ||
    coalesce(confirmation_number,'')));

\echo 'reservations_projection table ready.'
