#!/usr/bin/env bash
###############################################################################
# get-token.sh - Authenticate and obtain JWT access token
#
# Usage:
#   ./get-token.sh              # Print token to stdout
#   ./get-token.sh -e           # Export as TOKEN environment variable (source this)
#   ./get-token.sh -c           # Copy to clipboard (requires xclip/pbcopy)
#   ./get-token.sh -h           # Print Authorization header format
#
# Environment Variables (optional):
#   API_URL     - Base URL (default: http://localhost:8080)
#   API_USER    - Username (default: setup.admin)
#   API_PASS    - Password (default: TempPass123)
#
# Examples:
#   # Get token and use in curl
#   TOKEN=$(./get-token.sh) && curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v1/tenants
#
#   # Source to set TOKEN variable in current shell
#   source <(./get-token.sh -e)
#   curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/v1/rooms
#
###############################################################################

set -euo pipefail

# Configuration (override with environment variables)
API_URL="${API_URL:-http://localhost:8080}"
API_USER="${API_USER:-setup.admin}"
API_PASS="${API_PASS:-TempPass123}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
OUTPUT_MODE="token"  # token | export | clipboard | header
while getopts "ech" opt; do
  case $opt in
    e) OUTPUT_MODE="export" ;;
    c) OUTPUT_MODE="clipboard" ;;
    h) OUTPUT_MODE="header" ;;
    *)
      echo "Usage: $0 [-e|-c|-h]"
      echo "  -e  Output as 'export TOKEN=...' (for sourcing)"
      echo "  -c  Copy token to clipboard"
      echo "  -h  Output as 'Authorization: Bearer ...' header"
      exit 1
      ;;
  esac
done

# Check if API is reachable
if ! curl -s --max-time 2 "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: API not reachable at ${API_URL}${NC}" >&2
  echo -e "${YELLOW}Hint: Run 'npm run dev' from the project root to start services${NC}" >&2
  exit 1
fi

# Authenticate and get token
RESPONSE=$(curl -s "${API_URL}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${API_USER}\",\"password\":\"${API_PASS}\"}" \
  --max-time 10)

# Check for error response
if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$RESPONSE" | grep -oP '"message"\s*:\s*"\K[^"]+' || echo "Unknown error")
  echo -e "${RED}Authentication failed: ${ERROR_MSG}${NC}" >&2
  exit 1
fi

# Extract access_token
TOKEN=$(echo "$RESPONSE" | grep -oP '"access_token"\s*:\s*"\K[^"]+' || true)

if [[ -z "$TOKEN" ]]; then
  echo -e "${RED}Error: Could not extract access_token from response${NC}" >&2
  echo -e "${YELLOW}Response: ${RESPONSE}${NC}" >&2
  exit 1
fi

# Output based on mode
case $OUTPUT_MODE in
  token)
    echo "$TOKEN"
    ;;
  export)
    echo "export TOKEN=\"${TOKEN}\""
    echo "export AUTH_HEADER=\"Authorization: Bearer ${TOKEN}\""
    ;;
  clipboard)
    if command -v xclip &> /dev/null; then
      echo -n "$TOKEN" | xclip -selection clipboard
      echo -e "${GREEN}Token copied to clipboard!${NC}" >&2
    elif command -v pbcopy &> /dev/null; then
      echo -n "$TOKEN" | pbcopy
      echo -e "${GREEN}Token copied to clipboard!${NC}" >&2
    else
      echo -e "${YELLOW}Clipboard tool not found. Token:${NC}" >&2
      echo "$TOKEN"
    fi
    ;;
  header)
    echo "Authorization: Bearer ${TOKEN}"
    ;;
esac
