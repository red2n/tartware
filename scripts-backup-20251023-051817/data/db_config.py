#!/usr/bin/env python3
"""
Database Configuration and Utilities
Shared connection and UUID generation for all data loaders
"""
import psycopg2
import uuid
import time
import random

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'tartware',
    'user': 'postgres',
    'password': 'postgres'
}

# UUID Generation Strategy
UUID_VERSION = "v7"  # v7 = time-ordered (recommended), v4 = random

# Counter for UUID v7 generation to ensure uniqueness within same millisecond
_uuid_v7_counter = 0
_uuid_v7_last_timestamp = 0


def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("\nPlease ensure:")
        print("  1. PostgreSQL is running")
        print("  2. Database 'tartware' exists")
        print("  3. Credentials are correct")
        exit(1)


def generate_uuid_v7():
    """
    Generate UUID v7 (time-ordered UUID)

    Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
    - First 48 bits: Unix timestamp in milliseconds
    - Version bits: 0111 (version 7)
    - Variant bits: 10xx
    - Remaining 74 bits: Random data

    Benefits:
    - Time-ordered for better B-tree index performance
    - Better database cache locality
    - Suitable for time-range queries
    - Reduces index fragmentation
    """
    global _uuid_v7_counter, _uuid_v7_last_timestamp

    # Get current time in milliseconds
    timestamp_ms = int(time.time() * 1000)

    # Handle multiple UUIDs in same millisecond
    if timestamp_ms == _uuid_v7_last_timestamp:
        _uuid_v7_counter += 1
        # Add counter to randomness to maintain uniqueness
        rand_a = _uuid_v7_counter
    else:
        _uuid_v7_counter = 0
        _uuid_v7_last_timestamp = timestamp_ms
        rand_a = random.getrandbits(12)

    # Generate random bits for the rest
    rand_b = random.getrandbits(62)

    # Construct UUID v7
    # timestamp_ms: 48 bits
    # version: 4 bits (0111 for v7)
    # rand_a: 12 bits
    # variant: 2 bits (10)
    # rand_b: 62 bits

    uuid_int = (timestamp_ms << 80) | (7 << 76) | (rand_a << 64) | (2 << 62) | rand_b

    # Convert to UUID format
    return str(uuid.UUID(int=uuid_int))


def generate_uuid_v4():
    """Generate UUID v4 (random UUID) - legacy fallback"""
    return str(uuid.uuid4())


def generate_uuid():
    """Generate UUID based on configured strategy"""
    if UUID_VERSION == "v7":
        return generate_uuid_v7()
    else:
        return generate_uuid_v4()


def validate_uuid_v7():
    """Validate UUID v7 implementation before data load"""
    print("\n" + "=" * 60)
    print("UUID v7 Validation")
    print("=" * 60)

    # Test 1: Generate and verify version
    test_uuid = generate_uuid_v7()
    version_char = test_uuid[14]

    if version_char != '7':
        print(f"❌ ERROR: UUID version is {version_char}, expected 7")
        return False

    print(f"✓ UUID v7 Format: {test_uuid}")

    # Test 2: Time ordering
    uuid1 = generate_uuid_v7()
    time.sleep(0.002)  # 2ms delay
    uuid2 = generate_uuid_v7()

    if uuid1 >= uuid2:
        print(f"❌ ERROR: UUIDs not time-ordered: {uuid1} >= {uuid2}")
        return False

    print(f"✓ Time-ordered: UUIDs sort chronologically")

    # Test 3: Rapid generation (uniqueness)
    rapid_uuids = [generate_uuid_v7() for _ in range(100)]
    if len(set(rapid_uuids)) != 100:
        print(f"❌ ERROR: UUID collision detected in 100 rapid generations")
        return False

    print(f"✓ Uniqueness: 100 UUIDs generated with no collisions")

    # Test 4: Performance
    start = time.time()
    for _ in range(1000):
        generate_uuid_v7()
    v7_time = time.time() - start

    print(f"✓ Performance: 1000 UUIDs in {v7_time:.4f}s ({1000/v7_time:.0f} UUID/sec)")
    print("\n✅ All UUID v7 validations passed!")
    print("=" * 60)

    return True
