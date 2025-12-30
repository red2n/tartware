# Generate Credentials

Generates all necessary credentials for Tartware deployment including database passwords, JWT secrets, MFA secrets, and Kubernetes manifests.

## Usage

Run from anywhere in the repository:

```bash
./executables/generate-credentials/generate-credentials.sh
```

The script automatically detects the repository root and creates files in the correct locations.

## What It Generates

### 1. Credentials File (`platform/.credentials`)

Secure credentials file containing:
- Database passwords (PostgreSQL admin, user, replication)
- Redis password
- JWT secrets
- API keys and webhook secrets
- System administrator credentials
- **MFA secret** (Base32-encoded TOTP)
- Rancher/Grafana admin passwords
- Vault tokens

**Security:**
- File permissions: `600` (owner read/write only)
- Automatically added to `.gitignore`
- **Never commit this file to version control**

### 2. Kubernetes Secret Manifests (`platform/secrets/`)

- `database-credentials.yaml` - PostgreSQL credentials
- `redis-credentials.yaml` - Redis password
- `application-secrets.yaml` - JWT, API keys, encryption keys
- `monitoring-secrets.yaml` - Grafana admin credentials
- `docker-registry-secret.yaml.template` - Docker registry template

### 3. SSH Key Pairs (`platform/.ssh/`)

- `deployment` / `deployment.pub` - For application deployments
- `rancher-node` / `rancher-node.pub` - For Rancher node access

**Security:**
- Private keys (`deployment`, `rancher-node`) must **NEVER** be committed to git
- File permissions: `600` for private keys, `644` for public keys
- Automatically added to `.gitignore`
- Distribute private keys securely (encrypted channels, secret management tools)

## Features

### MFA Generation

The script automatically generates a TOTP (Time-based One-Time Password) secret for the system administrator account:

```
🔐 MFA Secret (Base32):      JNGUQ4RTGRRVSUKSPJ5ESVCFGBGW23DZ
📱 MFA Setup URI:
   otpauth://totp/Tartware:sysadmin?secret=JNGUQ4RTGRRVSUKSPJ5ESVCFGBGW23DZ&issuer=Tartware
```

- QR code URL provided for easy scanning
- Compatible with Google Authenticator, Authy, 1Password, etc.
- MFA is generated but **NOT enabled** by default

### Optional Bootstrap

The script offers to bootstrap the system administrator account:
- Creates/updates the `sysadmin` account in PostgreSQL
- Stores MFA secret in database
- Generates system admin JWT token
- Requires database to be running and accessible

## Generated Files Location

All files are created at the **repository root** regardless of where you run the script from:

```
/home/navin/tartware/
├── platform/
│   ├── .credentials          # Main credentials file
│   ├── .ssh/                  # SSH key pairs
│   │   ├── deployment
│   │   ├── deployment.pub
│   │   ├── rancher-node
│   │   └── rancher-node.pub
│   └── secrets/               # Kubernetes manifests
│       ├── database-credentials.yaml
│       ├── redis-credentials.yaml
│       ├── application-secrets.yaml
│       ├── monitoring-secrets.yaml
│       └── docker-registry-secret.yaml.template
```

## Workflow

1. **Generate credentials:**
   ```bash
   ./executables/generate-credentials/generate-credentials.sh
   ```

2. **Review MFA setup** (scan QR code with authenticator app)

3. **Bootstrap admin** (if prompted and database is running)

4. **Apply Kubernetes secrets** (if deploying to K8s):
   ```bash
   kubectl apply -f platform/secrets/
   ```

5. **Secure the credentials:**
   - Store `platform/.credentials` in a password manager
   - Delete local copies on shared systems
   - Never commit to git (automatically gitignored)

## Environment Variables (Optional)

Override database connection for bootstrap:
- `PGHOST` (default: localhost)
- `PGPORT` (default: 5432)
- `PGDATABASE` (default: tartware)
- `PGUSER` (default: postgres)
- `PGPASSWORD` (uses generated DB_PASSWORD)

## Related Scripts

- [`show-mfa-qr.sh`](../show-mfa-qr/show-mfa-qr.sh) - Display MFA setup information anytime
- [`bootstrap-system-admin-token.ts`](../../Apps/core-service/scripts/bootstrap-system-admin-token.ts) - Bootstrap admin manually

## Security Notes

1. **Credentials File Protection:**
   - Automatically set to `600` permissions
   - Added to `.gitignore`
   - Should be backed up securely

2. **SSH Private Keys - CRITICAL:**
   - Private keys in `platform/.ssh/` must **NEVER** be committed to git
   - Automatically added to `.gitignore`
   - Only distribute through secure channels (encrypted storage, secret managers)
   - Public keys (`.pub`) can be shared, but keep private keys secure
   - Regenerate keys immediately if accidentally committed

3. **Kubernetes Secrets:**
   - Apply to cluster and delete local copies
   - Use Sealed Secrets or External Secrets Operator in production

4. **MFA Security:**
   - Secret stored in database and credentials file
   - Not enabled by default to prevent lockout
   - Enable after testing with authenticator app

5. **Credential Rotation:**
   - Run script again to regenerate passwords
   - Update database manually or use bootstrap with `RESET_PASSWORD=true`
   - Rotate every 90 days recommended

## Troubleshooting

### "Bootstrap script not found"
The script couldn't find `Apps/core-service/scripts/bootstrap-system-admin-token.ts`. Ensure you're in the Tartware repository.

### "Database connection failed"
Ensure PostgreSQL is running and accessible:
```bash
psql -h localhost -p 5432 -U postgres -d tartware -c "SELECT 1"
```

### "Permission denied" on .credentials file
The file has `600` permissions (owner only). This is intentional for security.

## See Also

- [MFA Implementation Documentation](../../docs/MFA_IMPLEMENTATION.md)
- [Deployment Checklist](../../DEPLOYMENT_CHECKLIST.md)
