#!/bin/bash
# Display MFA QR code for system administrator

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CREDENTIALS_FILE="platform/.credentials"

if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${YELLOW}⚠️  Credentials file not found: $CREDENTIALS_FILE${NC}"
    echo "Run generate-credentials.sh first"
    exit 1
fi

# Read MFA secret from credentials file
MFA_SECRET=$(grep SYSTEM_ADMIN_MFA_SECRET "$CREDENTIALS_FILE" | tail -1 | cut -d= -f2)

if [ -z "$MFA_SECRET" ]; then
    echo -e "${YELLOW}⚠️  MFA secret not found in credentials file${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}System Administrator MFA Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Account:  ${GREEN}sysadmin@tartware.io${NC}"
echo -e "Issuer:   ${GREEN}Tartware${NC}"
echo ""
echo -e "🔐 MFA Secret (Base32): ${GREEN}$MFA_SECRET${NC}"
echo ""
echo -e "📱 Setup URI for authenticator apps:"
OTPAUTH_URL="otpauth://totp/Tartware:sysadmin?secret=${MFA_SECRET}&issuer=Tartware"
echo -e "   ${YELLOW}${OTPAUTH_URL}${NC}"
echo ""
echo -e "${YELLOW}💡 Compatible apps:${NC}"
echo "   • Google Authenticator"
echo "   • Microsoft Authenticator"
echo "   • Authy"
echo "   • 1Password"
echo "   • Bitwarden"
echo ""
echo -e "${GREEN}📱 To generate QR code locally (SECURE):${NC}"
echo ""
echo "Option 1 - Terminal QR code (requires qrencode):"
echo -e "  ${BLUE}echo \"${OTPAUTH_URL}\" | qrencode -t UTF8${NC}"
echo ""
echo "Option 2 - Save as PNG image:"
echo -e "  ${BLUE}echo \"${OTPAUTH_URL}\" | qrencode -o mfa-qr.png${NC}"
echo ""
echo "Option 3 - Manual entry (most secure):"
echo "  1. Open your authenticator app"
echo "  2. Select 'Enter a setup key' or 'Manual entry'"
echo "  3. Enter the secret key shown above"
echo "  4. Select 'Time based' (TOTP)"
echo ""
echo -e "${YELLOW}⚠️  SECURITY WARNING:${NC}"
echo "   Never use online QR code generators for MFA secrets!"
echo "   This would expose your second factor to third parties."
echo ""
echo -e "${YELLOW}⚠️  Note:${NC} MFA is generated but NOT enabled by default."
echo "   Enable it through the system settings UI after testing."
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
