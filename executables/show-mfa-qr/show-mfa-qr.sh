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
echo -e "   ${YELLOW}otpauth://totp/Tartware:sysadmin?secret=${MFA_SECRET}&issuer=Tartware${NC}"
echo ""
echo -e "📸 Scan this QR code with your authenticator app:"
echo -e "   ${BLUE}https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=otpauth://totp/Tartware:sysadmin%3Fsecret%3D${MFA_SECRET}%26issuer%3DTartware${NC}"
echo ""
echo -e "${YELLOW}💡 Compatible apps:${NC}"
echo "   • Google Authenticator"
echo "   • Microsoft Authenticator"
echo "   • Authy"
echo "   • 1Password"
echo "   • Bitwarden"
echo ""
echo -e "${YELLOW}⚠️  Note:${NC} MFA is generated but NOT enabled by default."
echo "   Enable it through the system settings UI after testing."
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
