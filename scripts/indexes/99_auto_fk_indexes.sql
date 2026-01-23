-- =====================================================
-- Auto-generate missing foreign key indexes
-- =====================================================

DO $$
DECLARE
    r RECORD;
    idx_name TEXT;
    table_ref TEXT;
    col_list TEXT;
BEGIN
    FOR r IN
        SELECT
            con.conrelid AS table_oid,
            nsp.nspname AS schema_name,
            rel.relname AS table_name,
            con.conkey AS col_nums,
            array_agg(att.attname ORDER BY ord.ordinality) AS col_names
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname IN ('public', 'availability')
        GROUP BY con.conrelid, nsp.nspname, rel.relname, con.conkey
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indrelid = r.table_oid
              AND i.indisvalid
              AND i.indisready
              AND (i.indkey::int2[] @> r.col_nums)
        ) THEN
            table_ref := format('%I.%I', r.schema_name, r.table_name);
            col_list := array_to_string(r.col_names, ', ');
            idx_name := 'idx_' || r.table_name || '_' || array_to_string(r.col_names, '_') || '_fk';
            idx_name := substr(idx_name, 1, 55) || '_' || substr(md5(idx_name), 1, 7);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s);', idx_name, table_ref, col_list);
        END IF;
    END LOOP;
END $$;
