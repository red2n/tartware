# Show MFA QR Code

Displays the MFA (Multi-Factor Authentication) setup information for the system administrator account.

## Usage

```bash
./executables/show-mfa-qr/show-mfa-qr.sh
```

## What it does

- Reads the MFA secret from `platform/.credentials`
- Displays the Base32-encoded secret
- Shows the `otpauth://` URI for manual entry
- Provides a Google Charts API QR code URL for scanning

## Setup Steps

1. **Run the script** to display your MFA information
2. **Scan the QR code** or **manually enter the secret** in your authenticator app:
   - Google Authenticator
   - Microsoft Authenticator
   - Authy
   - 1Password
   - Bitwarden
3. **Test the code** - your authenticator will generate 6-digit codes every 30 seconds
4. **Enable MFA** in the system settings (MFA is generated but disabled by default)

## Notes

- MFA secret is generated during `generate-credentials.sh` but MFA is **NOT enabled** by default
- The secret is stored in the database but won't be required for login until you enable it
- After testing with your authenticator app, enable MFA through the system administrator settings UI
- Keep the credentials file secure - it contains sensitive secrets

## Security

- Never share your MFA secret
- Store backup codes in a secure location
- The credentials file should never be committed to version control
