"""
Shared Data Storage
Stores generated IDs for cross-referencing between tables
"""

# Storage for generated IDs - shared across all loaders
data_store = {
    'tenants': [],
    'users': [],
    'properties': [],
    'guests': [],
    'room_types': [],
    'rooms': [],
    'rates': [],
    'reservations': [],
    'invoices': [],
    'services': [],
    'ota_configurations': [],
    'folios': [],
    'companies': [],
    'packages': [],
    'group_bookings': [],
    'smart_room_devices': [],
    'room_energy_usage': [],
    'guest_room_preferences': [],
    'device_events_log': [],
    'mobile_check_ins': [],
    'digital_registration_cards': [],
    'contactless_requests': [],
    'vehicles': [],
    'transportation_requests': [],
    'shuttle_schedules': [],
}
