#!/usr/bin/env bash
# ============================================================================
# db-health-check.sh
# Tartware PMS — Database Architecture Health Check
#
# Runs a comprehensive set of diagnostic queries against the live PostgreSQL
# database and produces a plain-text report under reports/db-health/.
#
# Areas covered:
#   1.  PostgreSQL configuration vs. 20K ops/sec requirements
#   2.  Connection pooling gap
#   3.  Table partitioning on append-heavy tables
#   4.  autovacuum per-table overrides
#   5.  Trigger count / duplicate trigger detection
#   6.  RLS policy coverage and consistency
#   7.  Outbox index coverage (dispatch-ready + partition_key)
#   8.  command_idempotency TTL index
#   9.  JSONB columns missing GIN indexes (top hot-path tables)
#  10.  Indexes missing on FK columns
#  11.  pg_stat_statements extension
#  12.  Sequence / PK type bottlenecks
#
# Usage:
#   ./executables/db-health-check/db-health-check.sh [OPTIONS]
#
# Options:
#   --host=HOST        PostgreSQL host        (default: localhost)
#   --port=PORT        PostgreSQL port        (default: 5432)
#   --user=USER        PostgreSQL user        (default: postgres)
#   --db=DB            Database name          (default: tartware)
#   --password=PASS    Password               (default: postgres)
#   --output=FILE      Override report path
#   --quiet            Suppress console echo; write report only
#   --help             Show this message
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPORT_DIR="${REPO_ROOT}/reports/db-health"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# ── Defaults ────────────────────────────────────────────────────────────────
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-postgres}"
PG_DB="${PGDATABASE:-tartware}"
PG_PASSWORD="${PGPASSWORD:-postgres}"
QUIET=false
REPORT_FILE=""

# ── Argument parsing ─────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --host=*)   PG_HOST="${arg#*=}" ;;
    --port=*)   PG_PORT="${arg#*=}" ;;
    --user=*)   PG_USER="${arg#*=}" ;;
    --db=*)     PG_DB="${arg#*=}" ;;
    --password=*) PG_PASSWORD="${arg#*=}" ;;
    --output=*) REPORT_FILE="${arg#*=}" ;;
    --quiet)    QUIET=true ;;
    --help|-h)
      sed -n '2,35p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg  (use --help)" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${REPORT_DIR}"
REPORT_FILE="${REPORT_FILE:-${REPORT_DIR}/db-health-${TIMESTAMP}.txt}"

export PGPASSWORD="${PG_PASSWORD}"
PSQL="psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${PG_DB} -P pager=off"

# ── Helpers ──────────────────────────────────────────────────────────────────
say()  { [[ "${QUIET}" == "false" ]] && printf '%s\n' "$*"; printf '%s\n' "$*" >> "${REPORT_FILE}"; }
hr()   { say "$(printf '─%.0s' {1..72})"; }
hdr()  { hr; say "  $*"; hr; }
pass() { say "  ✓  $*"; }
fail() { say "  ✗  $*"; }
warn() { say "  ⚠  $*"; }
info() { say "     $*"; }
nl()   { say ""; }

run_sql() {
  # $1 = query string; prints result rows as plain text
  ${PSQL} -t -c "$1" 2>&1
}

# ── Header ───────────────────────────────────────────────────────────────────
{
  printf '%.0s═' {1..72}
  echo ""
} >> "${REPORT_FILE}"
say "  TARTWARE PMS — DB ARCHITECTURE HEALTH REPORT"
say "  Generated : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
say "  Database  : ${PG_DB}@${PG_HOST}:${PG_PORT}"
{
  printf '%.0s═' {1..72}
  echo ""
} >> "${REPORT_FILE}"
nl

# ── 1. PostgreSQL configuration ───────────────────────────────────────────────
hdr "1. POSTGRESQL CONFIGURATION vs. 20K ops/sec TARGETS"
nl

declare -A PG_TARGETS=(
  ["max_connections"]="300"
  ["shared_buffers"]="524288"      # 4 GB in 8kB pages
  ["work_mem"]="16384"             # 16 MB in kB
  ["maintenance_work_mem"]="524288"
  ["wal_buffers"]="8192"           # 64 MB in 8kB pages
  ["max_wal_size"]="4096"          # MB
  ["checkpoint_completion_target"]="0.9"
  ["synchronous_commit"]="off"
  ["random_page_cost"]="1.2"
  ["autovacuum_vacuum_scale_factor"]="0.05"
  ["autovacuum_analyze_scale_factor"]="0.025"
  ["autovacuum_max_workers"]="5"
  ["autovacuum_vacuum_cost_delay"]="0"
)

# Direction: "ge" = setting must be >= target (higher is better)
#            "le" = setting must be <= target (lower is better)
#            "eq" = must equal target (string)
declare -A PG_DIR=(
  ["max_connections"]="ge"
  ["shared_buffers"]="ge"
  ["work_mem"]="ge"
  ["maintenance_work_mem"]="ge"
  ["wal_buffers"]="ge"
  ["max_wal_size"]="ge"
  ["checkpoint_completion_target"]="ge"
  ["synchronous_commit"]="eq"
  ["random_page_cost"]="le"
  ["autovacuum_vacuum_scale_factor"]="le"
  ["autovacuum_analyze_scale_factor"]="le"
  ["autovacuum_max_workers"]="ge"
  ["autovacuum_vacuum_cost_delay"]="le"
)

declare -A PG_LABELS=(
  ["max_connections"]="Max connections (need ≥300 with PgBouncer)"
  ["shared_buffers"]="shared_buffers (need ≥4 GB / 524288×8kB)"
  ["work_mem"]="work_mem (need ≥16 MB)"
  ["maintenance_work_mem"]="maintenance_work_mem (need ≥512 MB)"
  ["wal_buffers"]="wal_buffers (need ≥64 MB)"
  ["max_wal_size"]="max_wal_size (need ≥4 GB)"
  ["checkpoint_completion_target"]="checkpoint_completion_target (need 0.9)"
  ["synchronous_commit"]="synchronous_commit (need off for outbox/audit)"
  ["random_page_cost"]="random_page_cost (SSD: need ≤1.2)"
  ["autovacuum_vacuum_scale_factor"]="autovacuum_vacuum_scale_factor (need ≤0.05)"
  ["autovacuum_analyze_scale_factor"]="autovacuum_analyze_scale_factor (need ≤0.025)"
  ["autovacuum_max_workers"]="autovacuum_max_workers (need ≥5)"
  ["autovacuum_vacuum_cost_delay"]="autovacuum_vacuum_cost_delay (need 0ms)"
)

GAPS_CONFIG=0

while IFS='|' read -r name setting unit; do
  name="$(echo "$name" | xargs)"
  setting="$(echo "$setting" | xargs)"
  label="${PG_LABELS[$name]:-$name}"
  target="${PG_TARGETS[$name]:-}"

  if [[ -z "$target" ]]; then
    info "${label} = ${setting}${unit}"
    continue
  fi

  dir="${PG_DIR[$name]:-ge}"

  # Numeric comparison
  if [[ "$setting" =~ ^[0-9.]+$ ]] && [[ "$target" =~ ^[0-9.]+$ ]]; then
    if [[ "$dir" == "ge" ]]; then
      if awk "BEGIN{exit !($setting < $target)}"; then
        fail "${label} = ${setting}${unit}  [target: ≥${target}${unit}]"
        GAPS_CONFIG=$((GAPS_CONFIG + 1))
      else
        pass "${label} = ${setting}${unit}"
      fi
    elif [[ "$dir" == "le" ]]; then
      if awk "BEGIN{exit !($setting > $target)}"; then
        fail "${label} = ${setting}${unit}  [target: ≤${target}${unit}]"
        GAPS_CONFIG=$((GAPS_CONFIG + 1))
      else
        pass "${label} = ${setting}${unit}"
      fi
    fi
  else
    # String comparison (e.g. synchronous_commit)
    if [[ "$setting" == "$target" ]]; then
      pass "${label} = ${setting}"
    else
      fail "${label} = ${setting}  [target: ${target}]"
      GAPS_CONFIG=$((GAPS_CONFIG + 1))
    fi
  fi
done < <(run_sql "
  SELECT name, setting, COALESCE(unit,'') AS unit
  FROM pg_settings
  WHERE name IN (
    'max_connections','shared_buffers','work_mem','maintenance_work_mem',
    'wal_buffers','max_wal_size','checkpoint_completion_target',
    'synchronous_commit','random_page_cost',
    'autovacuum_vacuum_scale_factor','autovacuum_analyze_scale_factor',
    'autovacuum_max_workers','autovacuum_vacuum_cost_delay'
  )
  ORDER BY name;" | grep '|')

nl
if [[ "$GAPS_CONFIG" -eq 0 ]]; then
  pass "All tracked configuration parameters meet targets"
else
  fail "${GAPS_CONFIG} configuration parameter(s) below target — see above"
fi
nl

# ── 2. Connection pooler ─────────────────────────────────────────────────────
hdr "2. CONNECTION POOLER (PgBouncer)"
nl

MAX_CONN="$(run_sql "SELECT setting FROM pg_settings WHERE name='max_connections';" | xargs)"
SVC_COUNT=13   # known service count in this monorepo
DEFAULT_POOL=10
PROJECTED=$(( SVC_COUNT * DEFAULT_POOL ))

info "max_connections         = ${MAX_CONN}"
info "Services in monorepo    = ${SVC_COUNT}"
info "Default pool per svc    = ${DEFAULT_POOL}"
info "Projected max DB conns  = ${PROJECTED}"

POOL_IN_DOCKER=false
if grep -qi "pgbouncer" "${REPO_ROOT}/docker-compose.yml" 2>/dev/null; then
  POOL_IN_DOCKER=true
fi

if [[ "${POOL_IN_DOCKER}" == "true" ]]; then
  pass "PgBouncer found in docker-compose.yml"
else
  fail "No PgBouncer in docker-compose.yml — projected ${PROJECTED} conns vs. max ${MAX_CONN}"
  fail "Add PgBouncer in transaction mode (see audit report for docker-compose snippet)"
fi
nl

# ── 3. Table partitioning ────────────────────────────────────────────────────
hdr "3. TABLE PARTITIONING — append-heavy hot tables"
nl

APPEND_TABLES=(
  "transactional_outbox"
  "charge_postings"
  "audit_logs"
  "reservation_status_history"
  "command_dispatches"
  "command_idempotency"
  "tenant_access_audit"
  "api_logs"
)

GAPS_PARTITION=0

for tbl in "${APPEND_TABLES[@]}"; do
  result="$(run_sql "
    SELECT CASE WHEN relkind='p' THEN 'PARTITIONED' ELSE 'REGULAR' END
    FROM pg_class
    WHERE relnamespace='public'::regnamespace AND relname='${tbl}';" | xargs)"

  if [[ "$result" == "PARTITIONED" ]]; then
    pass "${tbl} — partitioned"
  elif [[ "$result" == "REGULAR" ]]; then
    fail "${tbl} — REGULAR (not partitioned) — add RANGE partition by created_at"
    GAPS_PARTITION=$((GAPS_PARTITION + 1))
  else
    warn "${tbl} — table not found"
  fi
done

nl
if [[ "$GAPS_PARTITION" -eq 0 ]]; then
  pass "All append-heavy tables are partitioned"
else
  fail "${GAPS_PARTITION} unpartitioned append-heavy table(s) — see above"
fi
nl

# ── 4. Per-table autovacuum overrides ────────────────────────────────────────
hdr "4. PER-TABLE AUTOVACUUM OVERRIDES"
nl

HOT_TABLES=(
  "transactional_outbox"
  "charge_postings"
  "audit_logs"
  "command_dispatches"
  "reservation_status_history"
)

GAPS_VACUUM=0

for tbl in "${HOT_TABLES[@]}"; do
  opts="$(run_sql "
    SELECT COALESCE(array_to_string(reloptions,', '),'none')
    FROM pg_class
    WHERE relnamespace='public'::regnamespace AND relname='${tbl}';" | xargs)"

  if [[ "$opts" == "none" ]] || [[ -z "$opts" ]]; then
    fail "${tbl} — no per-table autovacuum overrides (default scale_factor=0.2 too high)"
    GAPS_VACUUM=$((GAPS_VACUUM + 1))
  else
    pass "${tbl} — overrides: ${opts}"
  fi
done

nl
if [[ "$GAPS_VACUUM" -eq 0 ]]; then
  pass "All hot tables have per-table autovacuum overrides"
else
  fail "${GAPS_VACUUM} hot table(s) missing autovacuum overrides"
  info "Fix: ALTER TABLE <tbl> SET (autovacuum_vacuum_scale_factor=0.01, autovacuum_vacuum_cost_delay=0);"
fi
nl

# ── 5. Trigger health ─────────────────────────────────────────────────────────
hdr "5. TRIGGER HEALTH"
nl

TOTAL_TRIGGERS="$(run_sql "
  SELECT COUNT(*) FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal;" | xargs)"

info "Total user-defined triggers: ${TOTAL_TRIGGERS}"
nl

# Tables with >3 triggers
info "Tables with >3 triggers (write amplification risk):"
while IFS='|' read -r tbl cnt; do
  tbl="$(echo "$tbl" | xargs)"; cnt="$(echo "$cnt" | xargs)"
  [[ -z "$tbl" ]] && continue
  if [[ "$cnt" -gt 3 ]]; then
    fail "${tbl} — ${cnt} triggers"
  else
    warn "${tbl} — ${cnt} triggers (monitor)"
  fi
done < <(run_sql "
  SELECT t.event_object_table, COUNT(*) AS c
  FROM information_schema.triggers t
  WHERE t.trigger_schema='public'
  GROUP BY t.event_object_table
  HAVING COUNT(*) > 2
  ORDER BY c DESC;" | grep '|')

nl

# Duplicate trigger names
info "Checking for duplicate trigger names per table:"
DUPE_COUNT=0
while IFS='|' read -r tbl tname cnt; do
  tbl="$(echo "$tbl" | xargs)"; tname="$(echo "$tname" | xargs)"; cnt="$(echo "$cnt" | xargs)"
  [[ -z "$tbl" ]] && continue
  fail "DUPLICATE: ${tbl}.${tname} appears ${cnt} times"
  DUPE_COUNT=$((DUPE_COUNT + 1))
done < <(run_sql "
  SELECT c.relname, t.tgname, COUNT(*) AS c
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal
  GROUP BY c.relname, t.tgname
  HAVING COUNT(*) > 1
  ORDER BY c.relname, t.tgname;" | grep '|')

if [[ "$DUPE_COUNT" -eq 0 ]]; then
  pass "No duplicate triggers found"
fi
nl

# ── 6. RLS coverage & consistency ────────────────────────────────────────────
hdr "6. ROW-LEVEL SECURITY COVERAGE"
nl

RLS_RESULT="$(run_sql "
  SELECT
    COUNT(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity
      AND EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid=c.oid))
      AS ok,
    COUNT(*) FILTER (WHERE NOT c.relrowsecurity OR NOT c.relforcerowsecurity
      OR NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid=c.oid))
      AS failed,
    COUNT(*) AS total
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND a.attnum>0 AND NOT a.attisdropped
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname != ALL(ARRAY[
      'tenants','users','user_tenant_associations',
      'system_administrators','system_admin_break_glass_codes','system_admin_audit_log',
      'reservation_event_offsets','roll_service_consumer_offsets','roll_service_backfill_checkpoint',
      'command_templates','command_dispatches','command_features','command_routes','command_idempotency',
      'transactional_outbox','tenant_access_audit'
    ]);" | xargs)"

OK_RLS="$(echo "$RLS_RESULT" | awk -F'|' '{print $1}' | xargs)"
FAIL_RLS="$(echo "$RLS_RESULT" | awk -F'|' '{print $2}' | xargs)"
TOTAL_RLS="$(echo "$RLS_RESULT" | awk -F'|' '{print $3}' | xargs)"

if [[ "$FAIL_RLS" == "0" ]]; then
  pass "RLS enabled+forced+policy: ${OK_RLS} / ${TOTAL_RLS} tenant tables ✓"
else
  fail "RLS missing on ${FAIL_RLS} tenant table(s):"
  while IFS='|' read -r tbl rls_on rls_forced has_policy; do
    tbl="$(echo "$tbl" | xargs)"
    [[ -z "$tbl" ]] && continue
    fail "  ${tbl}  rls=${rls_on}  force=${rls_forced}  policy=${has_policy}"
  done < <(run_sql "
    SELECT c.relname,
           c.relrowsecurity::text,
           c.relforcerowsecurity::text,
           EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.polrelid=c.oid)::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind='r'
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
           OR NOT EXISTS(SELECT 1 FROM pg_policy pol WHERE pol.polrelid=c.oid))
      AND c.relname != ALL(ARRAY[
        'tenants','users','user_tenant_associations','system_administrators',
        'system_admin_break_glass_codes','system_admin_audit_log',
        'reservation_event_offsets','roll_service_consumer_offsets','roll_service_backfill_checkpoint',
        'command_templates','command_dispatches','command_features','command_routes',
        'command_idempotency','transactional_outbox','tenant_access_audit'
      ])
    ORDER BY c.relname;" | grep '|')
fi

nl

# RLS policy consistency: check for non-NULLIF patterns
info "RLS policy expression consistency:"
NULLIF_COUNT="$(run_sql "
  SELECT COUNT(*) FROM pg_policy pol
  JOIN pg_class c ON c.oid=pol.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND pg_get_expr(pol.polqual,pol.polrelid) ILIKE '%NULLIF%';" | xargs)"

NON_NULLIF_COUNT="$(run_sql "
  SELECT COUNT(*) FROM pg_policy pol
  JOIN pg_class c ON c.oid=pol.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND pg_get_expr(pol.polqual,pol.polrelid) ILIKE '%current_setting%'
    AND pg_get_expr(pol.polqual,pol.polrelid) NOT ILIKE '%NULLIF%';" | xargs)"

pass "Policies using safe NULLIF pattern: ${NULLIF_COUNT}"
if [[ "$NON_NULLIF_COUNT" -gt 0 ]]; then
  fail "${NON_NULLIF_COUNT} policy(s) use bare current_setting() without NULLIF — will throw when GUC unset:"
  while IFS='|' read -r tbl pol expr; do
    tbl="$(echo "$tbl" | xargs)"; pol="$(echo "$pol" | xargs)"
    [[ -z "$tbl" ]] && continue
    fail "  ${tbl}.${pol}"
  done < <(run_sql "
    SELECT c.relname, pol.polname, pg_get_expr(pol.polqual,pol.polrelid)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND pg_get_expr(pol.polqual,pol.polrelid) ILIKE '%current_setting%'
      AND pg_get_expr(pol.polqual,pol.polrelid) NOT ILIKE '%NULLIF%'
    ORDER BY c.relname;" | grep '|')
fi
nl

# ── 7. Outbox index coverage ──────────────────────────────────────────────────
hdr "7. TRANSACTIONAL OUTBOX INDEX COVERAGE"
nl

REQUIRED_OUTBOX_PATTERNS=(
  "idx_outbox_dispatch_ready:PENDING.*FAILED|FAILED.*PENDING"
  "idx_outbox_partition_key:partition_key"
  "idx_outbox_locked_workers:locked_by"
  "idx_outbox_tenant_status:tenant_id.*status|status.*tenant_id"
)

GAPS_OUTBOX=0

for entry in "${REQUIRED_OUTBOX_PATTERNS[@]}"; do
  iname="${entry%%:*}"
  pattern="${entry#*:}"
  found="$(run_sql "
    SELECT indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='transactional_outbox'
      AND indexname='${iname}';" | xargs)"
  if [[ -n "$found" ]] && echo "$found" | grep -qiE "$pattern"; then
    pass "${iname} exists"
  elif [[ -n "$found" ]]; then
    warn "${iname} exists but does not match expected pattern — verify manually"
  else
    fail "${iname} MISSING"
    GAPS_OUTBOX=$((GAPS_OUTBOX + 1))
  fi
done

nl
if [[ "$GAPS_OUTBOX" -eq 0 ]]; then
  pass "All required outbox indexes present"
else
  fail "${GAPS_OUTBOX} outbox index(es) missing"
  info "Fix: CREATE INDEX idx_outbox_partition_key ON transactional_outbox (partition_key, available_at) WHERE status IN ('PENDING','FAILED');"
fi
nl

# ── 8. command_idempotency TTL index ─────────────────────────────────────────
hdr "8. COMMAND_IDEMPOTENCY TTL / EXPIRY INDEX"
nl

EXPIRY_IDX="$(run_sql "
  SELECT COUNT(*) FROM pg_indexes
  WHERE schemaname='public' AND tablename='command_idempotency'
    AND indexdef ILIKE '%created_at%';" | xargs)"

if [[ "$EXPIRY_IDX" -gt 0 ]]; then
  pass "created_at index exists on command_idempotency"
  info "Ensure a periodic cleanup job deletes rows older than retention window"
else
  fail "No created_at index on command_idempotency — expiry sweeps will seq-scan"
  info "Fix: CREATE INDEX idx_command_idempotency_expiry ON command_idempotency (created_at);"
fi

ROW_COUNT="$(run_sql "SELECT COUNT(*) FROM command_idempotency;" | xargs)"
info "Current row count: ${ROW_COUNT}"
nl

# ── 9. JSONB columns missing GIN indexes (hot-path tables only) ───────────────
hdr "9. JSONB COLUMNS WITHOUT GIN INDEXES (hot-path tables)"
nl

HOT_JSONB_TABLES=(
  "audit_logs"
  "command_dispatches"
  "api_logs"
  "charge_postings"
  "reservations"
  "transactional_outbox"
  "cashier_sessions"
  "folios"
)

TOTAL_JSONB_MISSING=0
TOTAL_JSONB_COVERED=0

for tbl in "${HOT_JSONB_TABLES[@]}"; do
  while IFS='|' read -r col has_gin; do
    col="$(echo "$col" | xargs)"; has_gin="$(echo "$has_gin" | xargs)"
    [[ -z "$col" ]] && continue
    if [[ "$has_gin" == "t" || "$has_gin" == "true" ]]; then
      pass "${tbl}.${col} — GIN index present"
      TOTAL_JSONB_COVERED=$((TOTAL_JSONB_COVERED + 1))
    else
      fail "${tbl}.${col} — NO GIN index (full table scan on JSONB filter queries)"
      TOTAL_JSONB_MISSING=$((TOTAL_JSONB_MISSING + 1))
    fi
  done < <(run_sql "
    SELECT c.column_name,
           EXISTS(
             SELECT 1 FROM pg_indexes i
             WHERE i.tablename='${tbl}'
               AND i.schemaname='public'
               AND i.indexdef ILIKE '%gin%'
               AND i.indexdef ILIKE '%' || c.column_name || '%'
           )::text AS has_gin
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='${tbl}' AND c.data_type='jsonb'
    ORDER BY c.column_name;" | grep '|')
done

nl
ALL_JSONB_MISSING="$(run_sql "
  SELECT COUNT(*) FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.data_type='jsonb'
    AND NOT EXISTS(
      SELECT 1 FROM pg_indexes i
      WHERE i.tablename=c.table_name
        AND i.indexdef ILIKE '%gin%'
        AND i.indexdef ILIKE '%' || c.column_name || '%'
    );" | xargs)"

info "Hot-path JSONB columns: ${TOTAL_JSONB_COVERED} covered, ${TOTAL_JSONB_MISSING} missing GIN"
info "Total JSONB columns without GIN across ALL tables: ${ALL_JSONB_MISSING}"
if [[ "$TOTAL_JSONB_MISSING" -gt 0 ]]; then
  info "Fix (most impactful): CREATE INDEX CONCURRENTLY idx_<table>_<col>_gin ON <table> USING GIN (<col>);"
fi
nl

# ── 10. FK columns missing indexes ───────────────────────────────────────────
hdr "10. FOREIGN KEY COLUMNS WITHOUT INDEXES"
nl

FK_MISSING="$(run_sql "
  SELECT COUNT(*)
  FROM (
    SELECT c.conrelid AS tbl_oid, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid
      AND a.attnum=ANY(c.conkey) AND NOT a.attisdropped
    WHERE c.contype='f'
      AND c.connamespace='public'::regnamespace
    EXCEPT
    SELECT ix.indrelid AS tbl_oid, a.attname
    FROM pg_index ix
    JOIN pg_class tc ON tc.oid=ix.indrelid
    JOIN pg_namespace n ON n.oid=tc.relnamespace AND n.nspname='public'
    JOIN pg_attribute a ON a.attrelid=ix.indrelid
      AND a.attnum=ANY(ix.indkey) AND NOT a.attisdropped
  ) gaps;" | xargs)"

if [[ "$FK_MISSING" == "0" ]]; then
  pass "All foreign key columns have supporting indexes (${FK_MISSING} gaps)"
else
  fail "${FK_MISSING} FK column(s) without indexes — causes seq scans on JOIN/DELETE cascade"
  info "Run: SELECT conrelid::regclass, a.attname FROM pg_constraint ..."
  info "     (see scripts/indexes/ for full missing-FK-index script)"
fi
nl

# ── 11. Extensions ────────────────────────────────────────────────────────────
hdr "11. REQUIRED EXTENSIONS"
nl

REQUIRED_EXTENSIONS=(
  "uuid-ossp:UUID generation"
  "pg_trgm:Trigram fuzzy search"
  "pg_stat_statements:Slow query identification — CRITICAL for 20K ops/s"
)

GAPS_EXT=0

for entry in "${REQUIRED_EXTENSIONS[@]}"; do
  extname="${entry%%:*}"
  desc="${entry#*:}"
  found="$(run_sql "SELECT COUNT(*) FROM pg_extension WHERE extname='${extname}';" | xargs)"
  if [[ "$found" -gt 0 ]]; then
    pass "${extname} — ${desc}"
  else
    fail "${extname} MISSING — ${desc}"
    GAPS_EXT=$((GAPS_EXT + 1))
  fi
done

if [[ "$GAPS_EXT" -gt 0 ]]; then
  info "Fix: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
  info "     Add shared_preload_libraries = 'pg_stat_statements' in postgresql.conf, then restart"
fi
nl

# ── 12. Sequence / PK type bottlenecks ───────────────────────────────────────
hdr "12. SEQUENCE / PRIMARY KEY BOTTLENECKS"
nl

# Check if outbox still uses a BIGINT serial as its primary key
OUTBOX_PK_TYPE="$(run_sql "
  SELECT data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='transactional_outbox' AND column_name='id';" | xargs)"

if [[ "$OUTBOX_PK_TYPE" == "bigint" ]]; then
  warn "transactional_outbox PK 'id' is BIGINT serial — single-node sequence is a contention point at 20K inserts/s"
  info "Consider: switch PK to event_id (UUID already exists) to eliminate sequence hotspot"
else
  pass "transactional_outbox PK type: ${OUTBOX_PK_TYPE}"
fi

# Count tables still on SERIAL / BIGSERIAL vs UUID pk
SERIAL_PK_COUNT="$(run_sql "
  SELECT COUNT(DISTINCT c.table_name)
  FROM information_schema.columns c
  WHERE c.table_schema='public'
    AND c.column_name='id'
    AND c.data_type IN ('integer','bigint')
    AND c.column_default ILIKE 'nextval%';" | xargs)"

UUID_PK_COUNT="$(run_sql "
  SELECT COUNT(DISTINCT c.table_name)
  FROM information_schema.columns c
  WHERE c.table_schema='public'
    AND c.column_name='id'
    AND c.data_type='uuid';" | xargs)"

info "Tables with SERIAL/BIGSERIAL id PK : ${SERIAL_PK_COUNT}"
info "Tables with UUID id PK             : ${UUID_PK_COUNT}"
if [[ "${SERIAL_PK_COUNT}" -gt 0 ]]; then
  warn "${SERIAL_PK_COUNT} table(s) use integer sequences as PK — evaluate if any are on write-hot paths"
fi
nl

# ── Final scorecard ────────────────────────────────────────────────────────────
{
  printf '%.0s═' {1..72}
  echo ""
} >> "${REPORT_FILE}"
say "  SCORECARD SUMMARY"
{
  printf '%.0s═' {1..72}
  echo ""
} >> "${REPORT_FILE}"
nl

TOTAL_GAPS=$((GAPS_CONFIG + GAPS_PARTITION + GAPS_VACUUM + GAPS_OUTBOX + GAPS_EXT))
# Add per-section booleans
[[ "$POOL_IN_DOCKER" == "false" ]] && TOTAL_GAPS=$((TOTAL_GAPS + 1))
[[ "${DUPE_COUNT:-0}" -gt 0 ]] && TOTAL_GAPS=$((TOTAL_GAPS + DUPE_COUNT))
[[ "${NON_NULLIF_COUNT:-0}" -gt 0 ]] && TOTAL_GAPS=$((TOTAL_GAPS + 1))
[[ "$FK_MISSING" != "0" ]] && TOTAL_GAPS=$((TOTAL_GAPS + 1))
[[ "$TOTAL_JSONB_MISSING" -gt 0 ]] && TOTAL_GAPS=$((TOTAL_GAPS + 1))

say "  Section                              Gaps"
say "  ─────────────────────────────────────────────────────────────────────"
say "  1.  PG Configuration                 ${GAPS_CONFIG}"
say "  2.  Connection Pooler (PgBouncer)     $([ "$POOL_IN_DOCKER" == "false" ] && echo 1 || echo 0)"
say "  3.  Table Partitioning                ${GAPS_PARTITION}"
say "  4.  Autovacuum Overrides              ${GAPS_VACUUM}"
say "  5.  Trigger Duplicates                ${DUPE_COUNT:-0}"
say "  6.  RLS Consistency                   $([ "${NON_NULLIF_COUNT:-0}" -gt 0 ] && echo "${NON_NULLIF_COUNT}" || echo 0)"
say "  7.  Outbox Indexes                    ${GAPS_OUTBOX}"
say "  8.  Idempotency Expiry Index          $([ "$EXPIRY_IDX" -gt 0 ] && echo 0 || echo 1)"
say "  9.  JSONB GIN (hot tables)            ${TOTAL_JSONB_MISSING}"
say "  10. FK Index Coverage                 ${FK_MISSING}"
say "  11. Extensions                        ${GAPS_EXT}"
say "  ─────────────────────────────────────────────────────────────────────"
say "  TOTAL GAPS                            ${TOTAL_GAPS}"
nl

if [[ "$TOTAL_GAPS" -eq 0 ]]; then
  say "  ✅  ALL CHECKS PASSED — database is production-ready for 20K ops/s"
else
  say "  ⚠   ${TOTAL_GAPS} gap(s) found — review items marked ✗ above"
fi
nl
say "  Report written to: ${REPORT_FILE}"
nl
