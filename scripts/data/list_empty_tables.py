#!/usr/bin/env python3
"""Find tables missing sample data"""

import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    dbname="tartware",
    user="postgres",
    password="postgres"
)

cur = conn.cursor()

# Get all tables with their record counts
cur.execute("""
    SELECT
        t.table_schema,
        t.table_name,
        COALESCE(s.n_tup_ins, 0) as records
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s
        ON s.relname = t.table_name
        AND s.schemaname = t.table_schema
    WHERE t.table_schema IN ('public', 'availability')
    AND t.table_type = 'BASE TABLE'
    ORDER BY
        CASE WHEN COALESCE(s.n_tup_ins, 0) = 0 THEN 0 ELSE 1 END,
        t.table_name
""")

results = cur.fetchall()

# Separate empty and populated tables
empty_tables = []
populated_tables = []

for schema, table, records in results:
    if records == 0:
        empty_tables.append((schema, table))
    else:
        populated_tables.append((schema, table, records))

print("="*80)
print(f"TABLES WITHOUT SAMPLE DATA ({len(empty_tables)} tables)")
print("="*80)
print()

for i, (schema, table) in enumerate(empty_tables, 1):
    schema_prefix = f"{schema}." if schema != 'public' else ""
    print(f"{i:2}. {schema_prefix}{table}")

print()
print("="*80)
print("SUMMARY")
print("="*80)
print(f"Total tables:      {len(results)}")
print(f"With data:         {len(populated_tables)} ({len(populated_tables)*100//len(results)}%)")
print(f"Without data:      {len(empty_tables)} ({len(empty_tables)*100//len(results)}%)")
print("="*80)

conn.close()
