#!/usr/bin/env bash
# Put every tenant into a state where the command mix can actually run —
# through the API, not the database.
#
# Two gates sit in front of a command write, and both have endpoints:
#
#   - command feature flags: all 195 ship `disabled`, so every write 409s.
#     `PATCH /v1/commands/features/batch` is the way to flip them.
#   - tenant modules: a command whose module the caller lacks is refused 403.
#     `PUT /v1/tenants/:id/modules` grants them.
#
# Both were previously set with UPDATE statements here, which is faster and
# wrong: a load test that configures its subject behind the subject's back is
# not exercising the same code the system uses, and would not notice if either
# endpoint broke.
#
# Usage: ./loadtest/enable-via-api.sh <tokens.tsv> [gateway]
#        tokens.tsv: tenantId <TAB> propertyId <TAB> token   (from seed-multi-tenant-flow.sh)

set -uo pipefail

TOKENS="${1:?tokens.tsv required}"
GW="${2:-http://localhost:8085}"

MODULES='["core","reservations","housekeeping","billing","finance-automation","facility-maintenance","analytics-bi","marketing-channel","enterprise-api","revenue-management","loyalty","distribution","tenant-owner-portal"]'

echo "granting modules via PUT /v1/tenants/:id/modules ..."
granted=0
failed=0
while IFS=$'\t' read -r TID _PID TOK; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 20 \
    -X PUT "$GW/v1/tenants/$TID/modules" \
    -H "Authorization: Bearer $TOK" \
    -H "Content-Type: application/json" \
    -d "{\"modules\":$MODULES}")
  case "$CODE" in
    2*) granted=$((granted + 1)) ;;
    *) failed=$((failed + 1)); [ "$failed" -le 3 ] && echo "  tenant $TID → HTTP $CODE" ;;
  esac
done < "$TOKENS"
echo "  modules granted: $granted   failed: $failed"

# One tenant's token is enough: command features are environment-wide, not
# per-tenant, so flipping them once covers the fleet.
FIRST_TOKEN=$(head -1 "$TOKENS" | cut -f3)
[ -n "$FIRST_TOKEN" ] || { echo "no token available"; exit 1; }

echo "enabling command features via PATCH /v1/commands/features/batch ..."
# Done in Python: the listing and the batch body are JSON, and chunking a
# comma-joined string in shell splits command names down the middle.
python3 - "$GW" "$FIRST_TOKEN" <<'PYEOF'
import json, sys, urllib.request

gateway, token = sys.argv[1], sys.argv[2]
auth = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def call(method, path, body=None):
    request = urllib.request.Request(
        f"{gateway}{path}",
        method=method,
        headers=auth,
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read() or "null")


features = call("GET", "/v1/commands/features") or []
names = [f["command_name"] for f in features if f.get("command_name")]
disabled = [f["command_name"] for f in features if f.get("status") != "enabled"]
print(f"  commands listed: {len(names)}  already enabled: {len(names) - len(disabled)}")

CHUNK = 50
enabled = 0
for start in range(0, len(names), CHUNK):
    chunk = names[start : start + CHUNK]
    try:
        result = call(
            "PATCH",
            "/v1/commands/features/batch",
            {"updates": [{"command_name": n, "status": "enabled"} for n in chunk]},
        )
    except Exception as error:  # noqa: BLE001 - surfaced below, not swallowed
        print(f"  chunk {start}-{start + len(chunk)} failed: {error}")
        continue
    # The endpoint answers either with the updated rows or with an object
    # wrapping them, so count whichever shape came back rather than assuming.
    if isinstance(result, list):
        enabled += len(result)
    elif isinstance(result, dict):
        updated = result.get("updated", result.get("updated_count", 0))
        enabled += len(updated) if isinstance(updated, list) else int(updated or 0)

still_off = [f["command_name"] for f in (call("GET", "/v1/commands/features") or []) if f.get("status") != "enabled"]
print(f"  commands enabled: {enabled} / {len(names)}   still disabled: {len(still_off)}")
if still_off:
    print(f"  e.g. {still_off[:5]}")
    sys.exit(1)
PYEOF
