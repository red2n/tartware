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
}
