# MFA (Multi-Factor Authentication) Implementation

## Overview

MFA support has been added to the Tartware system for enhanced security of system administrator accounts and tenant users.

## Components Modified

### 1. Credentials Generator (`executables/generate-credentials/generate-credentials.sh`)

**New Features:**
- Added `generate_mfa_secret()` function that creates a 32-character Base32-encoded TOTP secret
- Generates `SYSTEM_ADMIN_MFA_SECRET` and stores it in `platform/.credentials`
- Displays MFA setup information after credentials are generated:
  - Base32 secret for manual entry
  - `otpauth://` URI for QR code scanning
  - Google Charts API QR code URL
- Passes MFA secret to bootstrap script via `ADMIN_MFA_SECRET` environment variable

**Output Example:**
```
🔐 MFA Secret (Base32):      JNGUQ4RTGRRVSUKSPJ5ESVCFGBGW23DZ
📱 MFA Setup URI:
   otpauth://totp/Tartware:sysadmin?secret=JNGUQ4RTGRRVSUKSPJ5ESVCFGBGW23DZ&issuer=Tartware
```

### 2. Bootstrap Script (`Apps/core-service/scripts/bootstrap-system-admin-token.ts`)

**Changes:**
- Added `mfaSecret` to settings configuration (reads from `ADMIN_MFA_SECRET` env var)
- Stores MFA secret in database during admin creation
- Updates MFA secret when resetting password or when `ADMIN_MFA_SECRET` is provided
- **Important:** MFA is stored but remains **disabled** by default (`mfa_enabled=false`)

**Environment Variables:**
- `ADMIN_MFA_SECRET` - Optional MFA secret (Base32 encoded, 32 characters)

### 3. MFA Display Script (`executables/show-mfa-qr/show-mfa-qr.sh`)

**New utility script** for displaying MFA setup information at any time:
- Reads MFA secret from credentials file
- Shows account details, secret, and QR code URL
- Lists compatible authenticator apps
- Reminds users that MFA must be enabled separately

**Usage:**
```bash
./executables/show-mfa-qr/show-mfa-qr.sh
```

## Database Schema

The `system_administrators` table already had MFA support:
- `mfa_secret` (TEXT) - Base32-encoded TOTP secret
- `mfa_enabled` (BOOLEAN) - Whether MFA is required for this account

Tenant users also store MFA settings in `users`:
- `mfa_secret` (TEXT) - Base32-encoded TOTP secret
- `mfa_enabled` (BOOLEAN) - Whether MFA is required for the account

## Tenant MFA API

Tenant MFA enrollment and rotation are handled by the core-service auth endpoints:

1. `POST /v1/auth/mfa/enroll` (authenticated)
   - Generates a new secret and stores it with `mfa_enabled=false`.
   - Returns `secret` and `otpauth_url` for QR code enrollment.

2. `POST /v1/auth/mfa/verify` (authenticated)
   - Body: `{ "mfa_code": "123456" }`
   - Validates the TOTP code and flips `mfa_enabled=true`.

3. `POST /v1/auth/mfa/rotate` (authenticated)
   - Body: `{ "mfa_code": "123456" }`
   - Verifies the current code, generates a new secret, and sets `mfa_enabled=false`.
   - Returns the new `secret` and `otpauth_url` for re-enrollment.

All endpoints return `401` for unauthenticated users, `403` for inactive accounts, and `400` for invalid codes.

## Security Flow

### 1. Credential Generation
```bash
# Run from anywhere in the repository - it auto-detects the repo root
./executables/generate-credentials/generate-credentials.sh
```
- Generates secure random MFA secret
- Stores in `platform/.credentials` (at repository root)
- Displays QR code for scanning
- Optionally runs bootstrap script

### 2. Bootstrap Process
```bash
ADMIN_MFA_SECRET="..." tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts
```
- Creates/updates system admin account
- Stores MFA secret in database
- Sets `mfa_enabled=false` (disabled by default)

### 3. Authenticator Setup
- User scans QR code or manually enters secret
- Authenticator generates 6-digit codes every 30 seconds
- User can test codes before enabling MFA

### 4. Enable MFA (Future)
- Through system administrator settings UI
- Updates `mfa_enabled=true` in database
- Future logins will require password + MFA code

## Authentication Logic

The authentication flow in `Apps/core-service/src/services/system-admin-service.ts`:

```typescript
// If MFA is enabled for the account
if (admin.mfa_enabled) {
  if (!input.mfaCode) {
    throw new AuthenticationError('MFA code required');
  }
  
  const isValid = authenticator.check(input.mfaCode, admin.mfa_secret);
  if (!isValid) {
    throw new AuthenticationError('Invalid MFA code');
  }
}
```

## Compatible Authenticator Apps

- Google Authenticator (iOS/Android)
- Microsoft Authenticator (iOS/Android)
- Authy (iOS/Android/Desktop)
- 1Password (password manager with TOTP support)
- Bitwarden (password manager with TOTP support)

## Files Modified

1. `executables/generate-credentials/generate-credentials.sh`
   - Added `generate_mfa_secret()` function
   - Generate and store `SYSTEM_ADMIN_MFA_SECRET`
   - Display MFA setup information
   - Pass secret to bootstrap script

2. `Apps/core-service/scripts/bootstrap-system-admin-token.ts`
   - Accept `ADMIN_MFA_SECRET` environment variable
   - Store MFA secret in database (disabled by default)
   - Update secret on password reset

3. `executables/show-mfa-qr/show-mfa-qr.sh` (new)
   - Display MFA setup information
   - Show QR code URL for scanning

4. `executables/show-mfa-qr/README.md` (new)
   - Documentation for MFA setup script

## Testing

### Manual Test Flow

1. **Generate credentials with MFA:**
   ```bash
   cd /home/navin/tartware
   ./executables/generate-credentials/generate-credentials.sh
   ```

2. **View MFA setup:**
   ```bash
   ./executables/show-mfa-qr/show-mfa-qr.sh
   ```

3. **Verify database storage:**
   ```bash
   PGPASSWORD=postgres psql -h localhost -U postgres -d tartware -c \
     "SELECT username, mfa_enabled, CASE WHEN mfa_secret IS NULL THEN 'NULL' ELSE 'SET' END as mfa_secret FROM system_administrators WHERE username='sysadmin';"
   ```

4. **Bootstrap with MFA:**
   ```bash
   MFA_SECRET=$(grep SYSTEM_ADMIN_MFA_SECRET platform/.credentials | tail -1 | cut -d= -f2)
   ADMIN_MFA_SECRET=$MFA_SECRET RESET_PASSWORD=true npx tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts
   ```

## Security Considerations

1. **MFA Secret Storage:**
   - Secrets stored in `platform/.credentials` (600 permissions)
   - File is gitignored
   - Should be backed up securely (e.g., password manager)

2. **Default Disabled:**
   - MFA is generated but NOT enabled by default
   - Allows testing before enforcement
   - Prevents lockout if authenticator is lost

3. **Rotation:**
   - MFA secret can be regenerated by running bootstrap with new `ADMIN_MFA_SECRET`
   - Old secret becomes invalid immediately

4. **Recovery:**
   - System admin can disable MFA through database if locked out
   - Or reset using bootstrap script without MFA

## Next Steps (Future Enhancements)

1. **UI Integration:**
   - Add MFA enable/disable toggle in settings
   - QR code display in UI for setup
   - MFA code input field on login page

2. **Backup Codes:**
   - Generate one-time recovery codes
   - Store hashed in database
   - Display to user for safekeeping

3. **MFA for Tenant Admins:**
   - Extend MFA to non-system administrators
   - Per-tenant MFA requirements

4. **TOTP Validation Window:**
   - Currently uses default window (±1 step = ±30 seconds)
   - Consider configurable window for clock drift

## Dependencies

- `otplib@12.0.1` - TOTP generation and validation
- `bcryptjs` - Password hashing
- `openssl` - Random secret generation (shell script)
- `base32` command - Base32 encoding (coreutils)

## Documentation

- [Show MFA QR Script README](./show-mfa-qr/README.md)
- [System Admin Bootstrap Script](../../Apps/core-service/scripts/bootstrap-system-admin-token.ts)
- [Credentials Generator](./generate-credentials.sh)
