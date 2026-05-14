DO $$
DECLARE
    r RECORD;
    v_policy_name TEXT;
BEGIN
    FOR r IN
        SELECT relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND relname LIKE 'reservations_p%'
          AND relkind = 'r'
    LOOP
        v_policy_name := 'tenant_isolation_' || r.table_name;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, r.table_name);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)', v_policy_name, r.table_name);
        RAISE NOTICE 'RLS enabled on public.%', r.table_name;
    END LOOP;
END $$;
