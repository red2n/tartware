#!/usr/bin/env bash
# Bootstrap N tenants for multi-tenant load testing.
#
# Single-tenant load says nothing about the things multi-tenancy actually
# stresses: RLS scoping per statement, partition spread across tenants, and
# whether one noisy tenant can starve the rest. This creates the tenants and
# writes a manifest the load scenario reads.
#
# Mirrors the bootstrap in
# executables/test-accounts-realdata/test-concurrent-50-tenants.sh, which is the
# reference for how a tenant, its first property, and its owner are created
# together through the system-admin API.
#
# The owner password is deliberately longer than the reference script's
# `LTPass<n>!x`: the policy now requires at least 12 characters, so that value
# is rejected with HTTP 400 and the script bootstraps nothing.
#
# Usage: ./loadtest/seed-tenants.sh <count> <system-admin-token> [core-url]
# Output: /tmp/tartware-tenants.env  (TENANT_IDS=..., PROPERTY_IDS=...)

set -uo pipefail

COUNT="${1:-50}"
SYS_TOKEN="${2:?system admin token required}"
CORE="${3:-http://localhost:3000}"
OUT="/tmp/tartware-tenants.env"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "bootstrapping $COUNT tenants via $CORE ..."

bootstrap_one() {
  local idx="$1"
  local slug="lt-tenant-$(printf '%03d' "$idx")"
  local resp="$WORK/boot-$idx.json"

  curl -s -o "$resp" -w "%{http_code}" \
    -X POST "$CORE/v1/system/tenants/bootstrap" \
    -H "Authorization: Bearer $SYS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenant\": {
        \"name\": \"LT Hotel Group $idx\",
        \"slug\": \"$slug\",
        \"type\": \"CHAIN\",
        \"email\": \"admin@${slug}.test\"
      },
      \"property\": {
        \"property_name\": \"LT Hotel Group $idx HQ\",
        \"property_code\": \"LT$(printf '%03d' "$idx")-001\",
        \"property_type\": \"hotel\",
        \"star_rating\": $(( (idx % 3) + 3 )),
        \"total_rooms\": $(( 50 + (idx % 50) )),
        \"email\": \"hq@${slug}.test\",
        \"timezone\": \"America/New_York\",
        \"currency\": \"USD\"
      },
      \"owner\": {
        \"username\": \"lt${idx}.admin\",
        \"email\": \"admin@${slug}.test\",
        \"password\": \"LoadTest${idx}!Aa9x\",
        \"first_name\": \"Admin\",
        \"last_name\": \"LT$idx\"
      }
    }" > "$WORK/code-$idx" 2>/dev/null
}

for i in $(seq 1 "$COUNT"); do
  bootstrap_one "$i" &
  # Bootstrap is write-heavy and touches shared tables; a modest fan-out keeps
  # it from contending with itself.
  if (( i % 10 == 0 )); then wait; fi
done
wait

CREATED=0
for i in $(seq 1 "$COUNT"); do
  CODE=$(cat "$WORK/code-$i" 2>/dev/null || echo "000")
  case "$CODE" in
    2*) CREATED=$((CREATED + 1)) ;;
    *) echo "  [T$i] HTTP $CODE $(head -c 120 "$WORK/boot-$i.json" 2>/dev/null)" ;;
  esac
done
echo "  bootstrapped: $CREATED / $COUNT"

PSQL=(env PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d tartware -t -A)

# Every command write is authorised against the caller's module list, so a
# tenant missing a module rejects that whole command family with 403 and skews
# the mix. Grant the full set to the load-test users.
"${PSQL[@]}" -c "UPDATE user_tenant_associations SET modules = '[\"core\",\"reservations\",\"housekeeping\",\"billing\",\"finance-automation\",\"facility-maintenance\",\"revenue\",\"crm\",\"channel-manager\",\"analytics\"]'::jsonb;" >/dev/null

{
  echo "TENANT_IDS=$("${PSQL[@]}" -c "SELECT string_agg(id::text, ',') FROM tenants;")"
  echo "PROPERTY_IDS=$("${PSQL[@]}" -c "SELECT string_agg(id::text, ',') FROM properties;")"
} > "$OUT"

echo "tenants: $("${PSQL[@]}" -c 'SELECT count(*) FROM tenants;')  properties: $("${PSQL[@]}" -c 'SELECT count(*) FROM properties;')"
echo "wrote $OUT"
