#!/usr/bin/env python3
"""Identify database tables that have not been populated by the sample loaders."""

import psycopg2

def fetch_table_stats(cursor):
    """Retrieve row counts for every base table in the public schemas.

    Args:
        cursor: psycopg2 cursor used to execute metadata queries.

    Returns:
        list[tuple[str, str, int]]: Table schema, table name, and record count.
    """
    cursor.execute(
        """
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
        """
    )
    return cursor.fetchall()


def partition_tables(table_stats):
    """Split table metadata into empty and populated collections.

    Args:
        table_stats: Iterable of (schema, table name, record count) tuples.

    Returns:
        tuple[list[tuple[str, str]], list[tuple[str, str, int]]]: First list contains
        empty tables; second list contains populated tables with counts.
    """
    empty_tables = []
    populated_tables = []

    for schema, table, records in table_stats:
        if records == 0:
            empty_tables.append((schema, table))
        else:
            populated_tables.append((schema, table, records))

    return empty_tables, populated_tables


def render_report(empty_tables, populated_tables, total_tables):
    """Print a human-readable report of table population status.

    Args:
        empty_tables: Tables with zero inserted rows.
        populated_tables: Tables that contain at least one row.
        total_tables: Total number of tables inspected.
    """
    print("=" * 80)
    print(f"TABLES WITHOUT SAMPLE DATA ({len(empty_tables)} tables)")
    print("=" * 80)
    print()

    for i, (schema, table) in enumerate(empty_tables, 1):
        schema_prefix = f"{schema}." if schema != "public" else ""
        print(f"{i:2}. {schema_prefix}{table}")

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total tables:      {total_tables}")

    if total_tables:
        with_data_pct = len(populated_tables) * 100 // total_tables
        without_data_pct = len(empty_tables) * 100 // total_tables
    else:
        with_data_pct = without_data_pct = 0

    print(f"With data:         {len(populated_tables)} ({with_data_pct}%)")
    print(f"Without data:      {len(empty_tables)} ({without_data_pct}%)")
    print("=" * 80)


def main():
    """Generate a console report listing tables that lack seeded data."""
    with psycopg2.connect(
        host="localhost",
        port="5432",
        dbname="tartware",
        user="postgres",
        password="postgres",
    ) as conn:
        with conn.cursor() as cur:
            results = fetch_table_stats(cur)

    empty_tables, populated_tables = partition_tables(results)
    render_report(empty_tables, populated_tables, len(results))


if __name__ == "__main__":
    main()
