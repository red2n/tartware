-- =====================================================
-- table_lineage_report.sql
-- Purpose: Quick dependency explorer for Tartware PMS schema
-- Location: scripts/tables/tools/
--
-- Usage:
--   psql -f scripts/tables/tools/table_lineage_report.sql
--
-- Output Highlights:
--   1. Outbound dependencies: which tables this table references
--   2. Inbound dependencies: which tables reference this table
--   3. View dependencies: base tables each view pulls from
--
-- Notes:
--   * Limits scope to the public schema (matching production deployment)
--   * Safe to run in CI or local environments; read-only queries
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\pset format aligned
\pset border 2
\pset footer off

\echo ''
\echo '======================================================'
\echo ' TABLE LINEAGE: FOREIGN KEY OUTBOUND DEPENDENCIES'
\echo '======================================================'

DROP TABLE IF EXISTS tmp_fk_lineage;
CREATE TEMP TABLE tmp_fk_lineage ON COMMIT DROP AS
SELECT
    con.conname                                       AS constraint_name,
    conrelid::regclass::text                          AS referencing_table,
    confrelid::regclass::text                         AS referenced_table,
    array_agg(att2.attname ORDER BY att2.attnum)      AS referencing_columns,
    array_agg(att.attname ORDER BY att.attnum)        AS referenced_columns
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
JOIN pg_class rel_conf ON rel_conf.oid = con.confrelid
JOIN pg_namespace n_conf ON n_conf.oid = rel_conf.relnamespace
JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
JOIN pg_attribute att2 ON att2.attrelid = con.conrelid AND att2.attnum = cols.attnum
JOIN unnest(con.confkey) WITH ORDINALITY AS refcols(attnum, ord) ON refcols.ord = cols.ord
JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = refcols.attnum
WHERE con.contype = 'f'
  AND n.nspname = 'public'
  AND n_conf.nspname = 'public'
GROUP BY con.conname, conrelid, confrelid;

SELECT
    referencing_table AS table_name,
    referenced_table,
    array_to_string(referencing_columns, ', ') AS referencing_columns,
    array_to_string(referenced_columns, ', ')  AS referenced_columns
FROM tmp_fk_lineage
ORDER BY referencing_table, referenced_table;

\echo ''
\echo '======================================================'
\echo ' TABLE LINEAGE: INBOUND DEPENDENCIES (WHO REFERENCES ME)'
\echo '======================================================'

SELECT
    referenced_table AS table_name,
    string_agg(
        DISTINCT referencing_table || ' (' || array_to_string(referencing_columns, ', ') || ')',
        E'\n' ORDER BY referencing_table
    ) AS referenced_by
FROM tmp_fk_lineage
GROUP BY referenced_table
ORDER BY referenced_table;

\echo ''
\echo '======================================================'
\echo ' VIEW LINEAGE: BASE TABLES PER VIEW'
\echo '======================================================'

SELECT
    view_schema || '.' || view_name AS view_name,
    string_agg(DISTINCT table_schema || '.' || table_name, ', ' ORDER BY table_schema, table_name) AS referenced_tables
FROM information_schema.view_table_usage
WHERE view_schema = 'public'
GROUP BY view_schema, view_name
ORDER BY view_name;

\echo ''
\echo '======================================================'
\echo ' Lineage report complete.'
\echo '======================================================'

DROP TABLE IF EXISTS tmp_fk_lineage;
