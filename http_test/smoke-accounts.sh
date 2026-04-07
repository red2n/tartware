#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(./http_test/get-token.sh 2>/dev/null)
TID="11111111-1111-1111-1111-111111111111"
PID="22222222-2222-2222-2222-222222222222"
PASS=0; FAIL=0; TOTAL=0

smoke() {
  local label="$1" url="$2"
  TOTAL=$((TOTAL+1))
  code=$(curl -s -o /tmp/smoke_resp.json -w "%{http_code}" "$url" -H "Authorization: Bearer $TOKEN")
  type=$(jq -r 'type' /tmp/smoke_resp.json 2>/dev/null || echo "?")
  keys=$(jq -r 'if type == "object" then (keys | join(",")) else "array[\(length)]" end' /tmp/smoke_resp.json 2>/dev/null || echo "?")
  if [[ "$code" =~ ^2 ]]; then
    PASS=$((PASS+1))
    printf "  ✅ %-45s %s  %-8s %s\n" "$label" "$code" "$type" "$keys"
  else
    FAIL=$((FAIL+1))
    msg=$(jq -r '.message // .error // empty' /tmp/smoke_resp.json 2>/dev/null || echo "")
    printf "  ❌ %-45s %s  %s\n" "$label" "$code" "$msg"
  fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "  ACCOUNTS & NIGHT AUDIT SMOKE TEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── INVOICES ──"
smoke "invoices list"               "http://localhost:8080/v1/billing/invoices?tenant_id=$TID&limit=10"
smoke "invoices by property"        "http://localhost:8080/v1/billing/invoices?tenant_id=$TID&property_id=$PID&limit=10"
smoke "invoices status=draft"       "http://localhost:8080/v1/billing/invoices?tenant_id=$TID&status=draft"

echo ""
echo "── ACCOUNTS RECEIVABLE ──"
smoke "AR list"                     "http://localhost:8080/v1/billing/accounts-receivable?tenant_id=$TID&limit=50"
smoke "AR limit=500 (UI match)"     "http://localhost:8080/v1/billing/accounts-receivable?tenant_id=$TID&limit=500"
smoke "AR by property"              "http://localhost:8080/v1/billing/accounts-receivable?tenant_id=$TID&property_id=$PID&limit=50"
smoke "AR aging-summary"            "http://localhost:8080/v1/billing/accounts-receivable/aging-summary?tenant_id=$TID"
smoke "AR aging-summary by prop"    "http://localhost:8080/v1/billing/accounts-receivable/aging-summary?tenant_id=$TID&property_id=$PID"

echo ""
echo "── TAX CONFIGURATIONS ──"
smoke "tax-config list"             "http://localhost:8080/v1/billing/tax-configurations?tenant_id=$TID&limit=10"
smoke "tax-config active"           "http://localhost:8080/v1/billing/tax-configurations?tenant_id=$TID&is_active=true"
smoke "tax-config type=sales_tax"  "http://localhost:8080/v1/billing/tax-configurations?tenant_id=$TID&tax_type=sales_tax"

echo ""
echo "── CASHIER SESSIONS ──"
smoke "cashier-sessions list"       "http://localhost:8080/v1/billing/cashier-sessions?tenant_id=$TID&limit=10"
smoke "cashier-sessions by prop"    "http://localhost:8080/v1/billing/cashier-sessions?tenant_id=$TID&property_id=$PID"

echo ""
echo "── FINANCIAL REPORTS ──"
smoke "trial-balance"               "http://localhost:8080/v1/billing/reports/trial-balance?tenant_id=$TID&property_id=$PID&business_date=2026-04-06"
smoke "departmental-revenue"        "http://localhost:8080/v1/billing/reports/departmental-revenue?tenant_id=$TID&property_id=$PID&start_date=2026-04-01&end_date=2026-04-06"
smoke "tax-summary"                 "http://localhost:8080/v1/billing/reports/tax-summary?tenant_id=$TID&property_id=$PID&start_date=2026-04-01&end_date=2026-04-06"
smoke "commissions"                 "http://localhost:8080/v1/billing/reports/commissions?tenant_id=$TID&property_id=$PID&start_date=2026-04-01&end_date=2026-04-06"

echo ""
echo "── NIGHT AUDIT ──"
smoke "night-audit status"          "http://localhost:8080/v1/night-audit/status?tenant_id=$TID&property_id=$PID"
smoke "night-audit history"         "http://localhost:8080/v1/night-audit/history?tenant_id=$TID&limit=20"
smoke "night-audit history by prop" "http://localhost:8080/v1/night-audit/history?tenant_id=$TID&property_id=$PID&limit=50"

echo ""
echo "═══════════════════════════════════════════════════════════════"
printf "  RESULTS: %d/%d passed" "$PASS" "$TOTAL"
if [ $FAIL -gt 0 ]; then printf ", %d FAILED" "$FAIL"; fi
echo ""
echo "═══════════════════════════════════════════════════════════════"
