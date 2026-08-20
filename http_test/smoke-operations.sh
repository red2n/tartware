#!/usr/bin/env bash
###############################################################################
# smoke-operations.sh — live write-path smoke test for the operations domains.
#
# Covers the write paths shipped on 2026-08-11 and 2026-08-13 that have never
# been exercised against a running stack: lost & found (ui-gaps/07), incidents
# (06), shift handovers (08), guest feedback (09), promo codes (16), booking
# sources and market segments (14), and police reports (02). `run-api-tests.sh`
# reaches all of them with GET only, which is precisely the coverage that let
# two 500s ship in ui-gaps/13 slice 2 and two statements that had never executed
# ship elsewhere.
#
# Everything goes through the API gateway on :8080 — the gateway's own routing
# is part of what is under test.
#
# Needs the dev stack up (pnpm run dev:backend) and Postgres/Kafka via docker.
# No direct SQL: the script creates what it needs and leaves rows behind in a
# closed/retired state, so re-runs are safe but the tables grow. Identifiers
# carry a run-unique suffix.
#
# Note: right after a service restart the gateway's circuit breaker can still be
# open and the first write returns 503. Re-run; it is not a code fault.
###############################################################################
set -uo pipefail
cd "$(dirname "$0")/.."

GW="${GW:-http://localhost:8080}"
TOKEN=$(./http_test/get-token.sh 2>/dev/null)
TID="${TENANT_ID:-11111111-1111-1111-1111-111111111111}"
PID="${PROPERTY_ID:-22222222-2222-2222-2222-222222222222}"
# A real user, for the columns that are FKs onto users.
UID_SEED="${USER_ID:-33333333-3333-3333-3333-333333333333}"
RESP=$(mktemp)
SUFFIX=$(date +%y%m%d-%H%M%S)
TODAY=$(date +%F)
TOMORROW=$(date -d "+1 day" +%F)
NEXT_WEEK=$(date -d "+8 days" +%F)

PASS=0; FAIL=0
declare -a FAILURES=()

uuid() { cat /proc/sys/kernel/random/uuid; }

req() { # method url [body] -> echoes http code, body lands in $RESP
  local m="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -o "$RESP" -w "%{http_code}" -X "$m" "$url" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -H "Idempotency-Key: $(uuid)" -d "$body"
  else
    curl -s -o "$RESP" -w "%{http_code}" -X "$m" "$url" \
      -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuid)"
  fi
}

check() { # label expected actual
  if [[ "$2" == "$3" ]]; then
    printf '  ✅ %-58s %s\n' "$1" "$3"; PASS=$((PASS+1))
  else
    printf '  ❌ %-58s expected %s got %s\n' "$1" "$2" "$3"
    printf '        %s\n' "$(head -c 300 "$RESP")"
    FAIL=$((FAIL+1)); FAILURES+=("$1 (expected $2, got $3)")
  fi
}

# Several of these domains reply `{data: …}` and several reply the bare item —
# which is itself worth knowing, so the id lookup accepts either shape.
id_from() { # jq-path-without-.data
  jq -r "(.data.$1 // .$1) // empty" "$RESP"
}

if [[ -z "$TOKEN" ]]; then
  echo "No token — is the stack up? (pnpm run dev:backend)"; exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  OPERATIONS WRITE-PATH SMOKE TEST  ($SUFFIX)"
echo "═══════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── LOST & FOUND (ui-gaps/07) ──"
# The domain the gateway used to proxy at the read-only copy, so every write
# 404ed downstream. Register → store → claim → return is the whole lifecycle.

LF_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID",
 "item_name":"Smoke umbrella $SUFFIX","item_description":"Black golf umbrella, wooden handle",
 "item_category":"accessories","found_date":"$TODAY","found_time":"09:15",
 "found_location":"Lobby","found_by_name":"Smoke Tester","room_number":"101",
 "storage_location":"Front office safe","hold_days":90,"is_valuable":false}
JSON
)
code=$(req POST "$GW/v1/lost-and-found" "$LF_BODY")
check "POST /v1/lost-and-found registers" 201 "$code"
LF_ID=$(id_from item_id)
check "  returns an item id" 1 "$([[ -n "$LF_ID" ]] && echo 1 || echo 0)"

code=$(req POST "$GW/v1/lost-and-found" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"item_name\":\"x\",\"item_description\":\"y\",\"item_category\":\"NOT_A_CATEGORY\",\"found_date\":\"$TODAY\",\"found_location\":\"Lobby\"}")
check "unknown item_category → bad request" 400 "$code"

if [[ -n "$LF_ID" ]]; then
  code=$(req GET "$GW/v1/lost-and-found/$LF_ID?tenant_id=$TID")
  check "GET /v1/lost-and-found/:itemId" 200 "$code"

  code=$(req PUT "$GW/v1/lost-and-found/$LF_ID" \
    "{\"tenant_id\":\"$TID\",\"storage_location\":\"Back office shelf 3\",\"is_valuable\":true}")
  check "PUT /v1/lost-and-found/:itemId" 200 "$code"

  code=$(req POST "$GW/v1/lost-and-found/$LF_ID/claim" \
    "{\"tenant_id\":\"$TID\",\"claimed_by_name\":\"A. Guest\",\"verification_notes\":\"Photo ID checked\"}")
  check "POST …/:itemId/claim" 200 "$code"

  code=$(req POST "$GW/v1/lost-and-found/$LF_ID/return" \
    "{\"tenant_id\":\"$TID\",\"return_method\":\"in_person\",\"returned_to_name\":\"A. Guest\",\"notes\":\"Collected at front desk\"}")
  check "POST …/:itemId/return" 200 "$code"
fi

code=$(req GET "$GW/v1/lost-and-found/$(uuid)?tenant_id=$TID")
check "unknown item_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── INCIDENTS (ui-gaps/06) ──"
# The write path that was gated on a module id that does not exist, so it 403ed
# for every tenant since it shipped. A 403 here means that regressed.

INC_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID",
 "incident_title":"Smoke slip in lobby $SUFFIX","incident_type":"slip_fall","severity":"minor",
 "incident_date":"$TODAY","incident_time":"14:30","incident_location":"Lobby, near reception",
 "incident_description":"Guest slipped on a wet floor; no injury reported.",
 "immediate_actions_taken":"Area cordoned, wet floor sign placed, guest offered assistance.",
 "guest_involved":true,"staff_involved":false,"police_notified":false,
 "discovered_by_name":"Smoke Tester"}
JSON
)
code=$(req POST "$GW/v1/incidents" "$INC_BODY")
check "POST /v1/incidents reports" 201 "$code"
INC_ID=$(id_from incident_id)
check "  module gate passes (not 403)" 1 "$([[ "$code" != "403" ]] && echo 1 || echo 0)"

code=$(req POST "$GW/v1/incidents" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"incident_title\":\"x\",\"incident_type\":\"slip_fall\",\"severity\":\"NOT_A_SEVERITY\",\"incident_date\":\"$TODAY\",\"incident_time\":\"14:30\",\"incident_location\":\"Lobby\",\"incident_description\":\"d\",\"immediate_actions_taken\":\"a\"}")
check "unknown severity → bad request" 400 "$code"

if [[ -n "$INC_ID" ]]; then
  code=$(req GET "$GW/v1/incidents/$INC_ID?tenant_id=$TID")
  check "GET /v1/incidents/:incidentId" 200 "$code"

  code=$(req PUT "$GW/v1/incidents/$INC_ID" \
    "{\"tenant_id\":\"$TID\",\"severity\":\"moderate\",\"area_name\":\"Reception\"}")
  check "PUT /v1/incidents/:incidentId" 200 "$code"

  code=$(req POST "$GW/v1/incidents/$INC_ID/status" \
    "{\"tenant_id\":\"$TID\",\"incident_status\":\"under_investigation\"}")
  check "POST …/:incidentId/status" 200 "$code"

  code=$(req POST "$GW/v1/incidents/$INC_ID/status" \
    "{\"tenant_id\":\"$TID\",\"incident_status\":\"closed\",\"closure_notes\":\"No further action; floor resurfaced.\"}")
  check "  closing stamps the closure" 200 "$code"
fi

code=$(req GET "$GW/v1/incidents/$(uuid)?tenant_id=$TID")
check "unknown incident_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── SHIFT HANDOVERS (ui-gaps/08) ──"
# A handover nobody acknowledges is a note, so the acknowledge transition is the
# one that matters most here.

HO_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","shift_date":"$TODAY",
 "department":"front_desk","outgoing_shift":"morning","outgoing_user_id":"$UID_SEED",
 "outgoing_user_name":"Morning Desk","incoming_shift":"afternoon","incoming_user_id":"$UID_SEED",
 "incoming_user_name":"Afternoon Desk","handover_title":"Smoke handover $SUFFIX",
 "key_points":"Two late arrivals expected; room 214 maintenance pending.",
 "urgent_matters":"VIP arrival at 18:00 needs the suite checked.",
 "requires_follow_up":true,"cash_on_hand":450.50,"deposits_to_make":1200}
JSON
)
code=$(req POST "$GW/v1/shift-handovers" "$HO_BODY")
check "POST /v1/shift-handovers" 201 "$code"
HO_ID=$(id_from handover_id)

code=$(req POST "$GW/v1/shift-handovers" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"shift_date\":\"$TODAY\",\"department\":\"front_desk\",\"outgoing_shift\":\"NOT_A_SHIFT\",\"outgoing_user_id\":\"$UID_SEED\",\"incoming_shift\":\"afternoon\",\"incoming_user_id\":\"$UID_SEED\",\"key_points\":\"k\"}")
check "unknown shift name → bad request" 400 "$code"

if [[ -n "$HO_ID" ]]; then
  code=$(req GET "$GW/v1/shift-handovers/$HO_ID?tenant_id=$TID")
  check "GET /v1/shift-handovers/:handoverId" 200 "$code"

  code=$(req PUT "$GW/v1/shift-handovers/$HO_ID" \
    "{\"tenant_id\":\"$TID\",\"important_notes\":\"Safe recount done at 15:00.\",\"cash_on_hand\":460}")
  check "PUT /v1/shift-handovers/:handoverId" 200 "$code"

  code=$(req POST "$GW/v1/shift-handovers/$HO_ID/acknowledge" \
    "{\"tenant_id\":\"$TID\",\"acknowledgment_notes\":\"Read and understood.\",\"handover_quality_rating\":5}")
  check "POST …/:handoverId/acknowledge" 200 "$code"
fi

code=$(req GET "$GW/v1/shift-handovers/$(uuid)?tenant_id=$TID")
check "unknown handover_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── GUEST FEEDBACK (ui-gaps/09) ──"
# Staff-entered feedback through to a response and a resolution.

FB_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","feedback_source":"STAFF_ENTERED",
 "review_title":"Smoke feedback $SUFFIX","review_text":"Check-in was slow at peak time.",
 "overall_rating":3,"rating_scale":5,"cleanliness_rating":4,"staff_rating":3,
 "would_return":true,"is_public":false,"feedback_category":"front_desk"}
JSON
)
code=$(req POST "$GW/v1/guest-feedback" "$FB_BODY")
check "POST /v1/guest-feedback" 201 "$code"
# The feedback read model keys on `id`, not `feedback_id` — the one domain here
# that does.
FB_ID=$(id_from id)

code=$(req POST "$GW/v1/guest-feedback" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"feedback_source\":\"NOT_A_SOURCE\",\"review_text\":\"t\"}")
check "unknown feedback_source → bad request" 400 "$code"

if [[ -n "$FB_ID" ]]; then
  code=$(req GET "$GW/v1/guest-feedback/$FB_ID?tenant_id=$TID")
  check "GET /v1/guest-feedback/:feedbackId" 200 "$code"

  code=$(req PUT "$GW/v1/guest-feedback/$FB_ID" \
    "{\"tenant_id\":\"$TID\",\"sentiment_label\":\"negative\",\"feedback_status\":\"in_progress\"}")
  check "PUT /v1/guest-feedback/:feedbackId" 200 "$code"

  code=$(req POST "$GW/v1/guest-feedback/$FB_ID/respond" \
    "{\"tenant_id\":\"$TID\",\"response_text\":\"Thank you — we have added a second agent at peak.\",\"is_public\":false}")
  check "POST …/:feedbackId/respond" 200 "$code"

  code=$(req POST "$GW/v1/guest-feedback/$FB_ID/resolve" \
    "{\"tenant_id\":\"$TID\",\"resolution_notes\":\"Staffing adjusted; guest contacted.\",\"feedback_status\":\"resolved\"}")
  check "POST …/:feedbackId/resolve" 200 "$code"
fi

code=$(req GET "$GW/v1/guest-feedback/$(uuid)?tenant_id=$TID")
check "unknown feedback_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── PROMO CODES (ui-gaps/16) ──"
# The slice that added a uniqueness constraint on (tenant_id, promo_code); the
# duplicate below is what proves the 409 path rather than a 500.

PROMO_CODE="SMOKE$(date +%y%m%d%H%M%S)"
PROMO_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","promo_code":"$PROMO_CODE",
 "promo_name":"Smoke test promo","promo_description":"Created by smoke-operations.sh",
 "promo_type":"discount_percent","discount_type":"percentage","discount_percent":10,
 "valid_from":"$TODAY","valid_to":"2027-12-31","is_active":true,"is_public":false,
 "has_usage_limit":true,"total_usage_limit":100,"per_user_limit":1}
JSON
)
code=$(req POST "$GW/v1/promo-codes" "$PROMO_BODY")
check "POST /v1/promo-codes" 201 "$code"
PROMO_ID=$(id_from promo_id)

code=$(req POST "$GW/v1/promo-codes" "$PROMO_BODY")
check "duplicate promo_code → conflict" 409 "$code"

# `arrival_date` and `departure_date` are required — validation prices a stay,
# not a code in the abstract.
code=$(req POST "$GW/v1/promo-codes/validate" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"promo_code\":\"$PROMO_CODE\",\"arrival_date\":\"$TOMORROW\",\"departure_date\":\"$NEXT_WEEK\",\"booking_amount\":500}")
check "POST /v1/promo-codes/validate" 200 "$code"
check "  the code it just created is valid" true "$(jq -r 'if has("data") then .data.valid else .valid end' "$RESP")"

code=$(req POST "$GW/v1/promo-codes/validate" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"promo_code\":\"NOPE-$SUFFIX\",\"arrival_date\":\"$TOMORROW\",\"departure_date\":\"$NEXT_WEEK\"}")
check "validating an unknown code answers rather than failing" 200 "$code"
# `//` is the wrong operator for a boolean: jq treats `false` as empty, so
# `.data.valid // .valid` on `{"valid": false}` falls through to the default and
# reports "null". The first cut of this check did exactly that.
check "  and reports it invalid" false "$(jq -r 'if has("data") then .data.valid else .valid end' "$RESP")"

if [[ -n "$PROMO_ID" ]]; then
  code=$(req PUT "$GW/v1/promo-codes/$PROMO_ID" \
    "{\"tenant_id\":\"$TID\",\"discount_percent\":15,\"promo_name\":\"Smoke test promo (revised)\"}")
  check "PUT /v1/promo-codes/:promoId" 200 "$code"

  code=$(req DELETE "$GW/v1/promo-codes/$PROMO_ID?tenant_id=$TID")
  check "DELETE /v1/promo-codes/:promoId retires" 200 "$code"

  code=$(req DELETE "$GW/v1/promo-codes/$PROMO_ID?tenant_id=$TID")
  check "DELETE again → not found" 404 "$code"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── BOOKING SOURCES & MARKET SEGMENTS (ui-gaps/14) ──"
# Reference data that reporting groups by: market-segment production has been
# grouping on a dimension nothing could populate until this write path landed.

SRC_CODE="SMK$(date +%H%M%S)"
code=$(req POST "$GW/v1/booking-sources" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"source_code\":\"$SRC_CODE\",\"source_name\":\"Smoke Channel $SUFFIX\",\"source_type\":\"OTA\",\"is_active\":true,\"is_bookable\":true,\"commission_percentage\":15}")
check "POST /v1/booking-sources" 201 "$code"
SRC_ID=$(id_from source_id)

code=$(req POST "$GW/v1/booking-sources" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"source_code\":\"$SRC_CODE\",\"source_name\":\"Duplicate\",\"source_type\":\"OTA\"}")
check "duplicate source_code → conflict" 409 "$code"

if [[ -n "$SRC_ID" ]]; then
  code=$(req PUT "$GW/v1/booking-sources/$SRC_ID" \
    "{\"tenant_id\":\"$TID\",\"commission_percentage\":12,\"channel_name\":\"Smoke OTA\"}")
  check "PUT /v1/booking-sources/:sourceId" 200 "$code"

  code=$(req DELETE "$GW/v1/booking-sources/$SRC_ID?tenant_id=$TID")
  check "DELETE /v1/booking-sources/:sourceId retires" 200 "$code"
fi

SEG_CODE="SMKSEG$(date +%H%M%S)"
code=$(req POST "$GW/v1/market-segments" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"segment_code\":\"$SEG_CODE\",\"segment_name\":\"Smoke Segment $SUFFIX\",\"segment_type\":\"CORPORATE\",\"is_active\":true,\"rate_multiplier\":0.9}")
check "POST /v1/market-segments" 201 "$code"
SEG_ID=$(id_from segment_id)

code=$(req POST "$GW/v1/market-segments" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"segment_code\":\"$SEG_CODE\",\"segment_name\":\"Duplicate\",\"segment_type\":\"CORPORATE\"}")
check "duplicate segment_code → conflict" 409 "$code"

if [[ -n "$SEG_ID" ]]; then
  code=$(req PUT "$GW/v1/market-segments/$SEG_ID" \
    "{\"tenant_id\":\"$TID\",\"rate_multiplier\":0.95,\"segment_name\":\"Smoke Segment (revised)\"}")
  check "PUT /v1/market-segments/:segmentId" 200 "$code"

  code=$(req DELETE "$GW/v1/market-segments/$SEG_ID?tenant_id=$TID")
  check "DELETE /v1/market-segments/:segmentId retires" 200 "$code"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── ALLOTMENTS (ui-gaps/16 step 4) ──"
# Contracted room blocks. Deliberately not through availability-guard-service —
# see the 2026-08-19 decision in that spec. The lifecycle is what most needs a
# live run: the CHECK constrains the value, the service constrains the movement.

ALLOT_CODE="SMKBLK$(date +%H%M%S)"
ALLOT_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID","allotment_code":"$ALLOT_CODE",
 "allotment_name":"Smoke tour series $SUFFIX","allotment_type":"TOUR",
 "start_date":"$TOMORROW","end_date":"$NEXT_WEEK","cutoff_date":"$TODAY",
 "total_rooms_blocked":40,"rooms_per_night":8,"rate_type":"CONTRACTED",
 "contracted_rate":129.50,"currency_code":"USD","account_name":"Smoke Tours Ltd",
 "contact_name":"A. Operator","contact_email":"ops@example.com",
 "attrition_clause":true,"attrition_percentage":20,"guaranteed_rooms":30,
 "elastic_limit":5,"commission_percentage":12,"notes":"Created by smoke-operations.sh"}
JSON
)
code=$(req POST "$GW/v1/allotments" "$ALLOT_BODY")
check "POST /v1/allotments" 201 "$code"
ALLOT_ID=$(id_from allotment_id)
check "  starts TENTATIVE" TENTATIVE "$(jq -r '(.data.allotment_status // .allotment_status) // "null"' "$RESP")"
check "  stored case is not folded" TOUR "$(jq -r '(.data.allotment_type // .allotment_type) // "null"' "$RESP")"

code=$(req POST "$GW/v1/allotments" "$ALLOT_BODY")
check "duplicate allotment_code → conflict" 409 "$code"

code=$(req POST "$GW/v1/allotments" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"allotment_code\":\"SMKBAD$SUFFIX\",\"allotment_name\":\"Backwards\",\"allotment_type\":\"TOUR\",\"start_date\":\"$NEXT_WEEK\",\"end_date\":\"$TOMORROW\",\"total_rooms_blocked\":5}")
check "end before start → bad request" 400 "$code"

code=$(req POST "$GW/v1/allotments" \
  "{\"tenant_id\":\"$TID\",\"property_id\":\"$PID\",\"allotment_code\":\"SMKBAD2$SUFFIX\",\"allotment_name\":\"No rooms\",\"allotment_type\":\"TOUR\",\"start_date\":\"$TOMORROW\",\"end_date\":\"$NEXT_WEEK\",\"total_rooms_blocked\":0}")
check "a block of zero rooms → bad request" 400 "$code"

if [[ -n "$ALLOT_ID" ]]; then
  code=$(req GET "$GW/v1/allotments/$ALLOT_ID?tenant_id=$TID")
  check "GET /v1/allotments/:allotmentId" 200 "$code"

  # Pickup is re-derived from the block size, not stored twice.
  code=$(req PUT "$GW/v1/allotments/$ALLOT_ID" \
    "{\"tenant_id\":\"$TID\",\"rooms_picked_up\":10,\"contracted_rate\":135}")
  check "PUT /v1/allotments/:allotmentId" 200 "$code"
  check "  pickup percentage re-derived" 25 "$(jq -r '(.data.pickup_percentage // .pickup_percentage) // "null"' "$RESP")"
  check "  rooms available re-derived" 30 "$(jq -r '(.data.rooms_available // .rooms_available) // "null"' "$RESP")"

  code=$(req POST "$GW/v1/allotments/$ALLOT_ID/status" \
    "{\"tenant_id\":\"$TID\",\"allotment_status\":\"COMPLETED\"}")
  check "skipping straight to COMPLETED → conflict" 409 "$code"

  code=$(req POST "$GW/v1/allotments/$ALLOT_ID/status" \
    "{\"tenant_id\":\"$TID\",\"allotment_status\":\"DEFINITE\"}")
  check "POST …/:allotmentId/status DEFINITE" 200 "$code"
  check "  signed" DEFINITE "$(jq -r '(.data.allotment_status // .allotment_status) // "null"' "$RESP")"

  code=$(req POST "$GW/v1/allotments/$ALLOT_ID/status" \
    "{\"tenant_id\":\"$TID\",\"allotment_status\":\"ACTIVE\"}")
  check "  DEFINITE → ACTIVE" 200 "$code"

  code=$(req POST "$GW/v1/allotments/$ALLOT_ID/status" \
    "{\"tenant_id\":\"$TID\",\"allotment_status\":\"CANCELLED\",\"cancellation_reason\":\"smoke test cleanup\"}")
  check "  cancelling a live block" 200 "$code"

  code=$(req POST "$GW/v1/allotments/$ALLOT_ID/status" \
    "{\"tenant_id\":\"$TID\",\"allotment_status\":\"ACTIVE\"}")
  check "  CANCELLED is terminal" 409 "$code"
fi

code=$(req GET "$GW/v1/allotments/$(uuid)?tenant_id=$TID")
check "unknown allotment_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── POLICE REPORTS (ui-gaps/02) ──"
# Shipped 2026-08-11 and never run live either. This is a statutory register in
# some jurisdictions, so a silently broken write is the worst kind here.

PR_BODY=$(cat <<JSON
{"tenant_id":"$TID","property_id":"$PID",
 "incident_date":"$TODAY","incident_time":"22:40","incident_type":"theft",
 "incident_location":"Car park, level 2",
 "incident_description":"Vehicle break-in reported by a guest; police attended. Smoke run $SUFFIX.",
 "agency_name":"City Police Department","agency_jurisdiction":"Downtown precinct",
 "responding_officer_name":"Officer Smoke","guest_involved":true,
 "property_stolen":true,"total_loss_value":450,"injuries_reported":false}
JSON
)
code=$(req POST "$GW/v1/police-reports" "$PR_BODY")
check "POST /v1/police-reports" 201 "$code"
PR_ID=$(id_from report_id)

if [[ -n "$PR_ID" ]]; then
  code=$(req GET "$GW/v1/police-reports/$PR_ID?tenant_id=$TID")
  check "GET /v1/police-reports/:reportId" 200 "$code"

  code=$(req PUT "$GW/v1/police-reports/$PR_ID" \
    "{\"tenant_id\":\"$TID\",\"incident_description\":\"Vehicle break-in; CCTV footage retained for the investigation.\"}")
  check "PUT /v1/police-reports/:reportId" 200 "$code"

  code=$(req POST "$GW/v1/police-reports/$PR_ID/status" \
    "{\"tenant_id\":\"$TID\",\"report_status\":\"filed\",\"police_case_number\":\"CASE-$SUFFIX\"}")
  check "POST …/:reportId/status" 200 "$code"

  code=$(req POST "$GW/v1/police-reports/$PR_ID/status" \
    "{\"tenant_id\":\"$TID\",\"report_status\":\"NOT_A_STATUS\"}")
  check "unknown report_status → bad request" 400 "$code"
fi

code=$(req GET "$GW/v1/police-reports/$(uuid)?tenant_id=$TID")
check "unknown report_id → not found" 404 "$code"

# ─────────────────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════════"
echo "  $PASS passed, $FAIL failed"
if ((FAIL)); then printf '  ❌ %s\n' "${FAILURES[@]}"; fi
echo "═══════════════════════════════════════════════════════════════"
exit $((FAIL > 0))
