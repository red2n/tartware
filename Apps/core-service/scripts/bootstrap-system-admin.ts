import { randomBytes } from "node:crypto";

import type { SystemAdminRole, TenantRole } from "@tartware/schemas";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";

import { config } from "../src/config.js";
import { pool } from "../src/lib/db.js";

type TenantBootstrapResult = {
  tenantId: string;
  tenantName: string;
  created: boolean;
};

type CliOptions = {
  username?: string;
  email?: string;
  role: SystemAdminRole;
  ipWhitelist: string[];
  allowedHours?: string;
  tenantId?: string;
  tenantRole: TenantRole;
  skipTenantUser?: boolean;
  force?: boolean;
};

const VALID_ROLES: SystemAdminRole[] = [
  "SYSTEM_ADMIN",
  "SYSTEM_OPERATOR",
  "SYSTEM_AUDITOR",
  "SYSTEM_SUPPORT",
] as const;

const VALID_TENANT_ROLES: TenantRole[] = ["OWNER", "ADMIN", "MANAGER"] as const;

const toTitle = (value: string) => value.replace(/_/g, " ").toLowerCase();

const parseList = (value?: string): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    username: process.env.SYSTEM_ADMIN_BOOTSTRAP_USERNAME,
    email: process.env.SYSTEM_ADMIN_BOOTSTRAP_EMAIL,
    role: "SYSTEM_ADMIN",
    ipWhitelist: ["127.0.0.1/32", "::1/128"],
    allowedHours: process.env.SYSTEM_ADMIN_BOOTSTRAP_ALLOWED_HOURS,
    tenantId: process.env.SYSTEM_ADMIN_BOOTSTRAP_TENANT_ID,
    tenantRole: "OWNER",
    skipTenantUser: false,
    force: false,
  };

  const envWhitelist = parseList(process.env.SYSTEM_ADMIN_BOOTSTRAP_IP_WHITELIST);
  if (envWhitelist.length > 0) {
    options.ipWhitelist = envWhitelist;
  }

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split("=", 2);
    const key = rawKey.trim().toLowerCase();
    const value = rawValue?.trim() ?? "";

    switch (key) {
      case "username":
        options.username = value;
        break;
      case "email":
        options.email = value;
        break;
      case "role":
        if (VALID_ROLES.includes(value as SystemAdminRole)) {
          options.role = value as SystemAdminRole;
        } else {
          console.warn(
            `⚠️  Unknown role "${value}". Falling back to SYSTEM_ADMIN (allowed roles: ${VALID_ROLES.join(
              ", ",
            )}).`,
          );
        }
        break;
      case "ip-whitelist":
        if (value.length > 0) {
          const parsed = parseList(value);
          if (parsed.length > 0) {
            options.ipWhitelist = parsed;
          }
        }
        break;
      case "allowed-hours":
        options.allowedHours = value;
        break;
      case "tenant-id":
        options.tenantId = value;
        break;
      case "tenant-role":
        if (VALID_TENANT_ROLES.includes(value as TenantRole)) {
          options.tenantRole = value as TenantRole;
        } else {
          console.warn(
            `⚠️  Unknown tenant role "${value}". Falling back to OWNER (allowed: ${VALID_TENANT_ROLES.join(", ")}).`,
          );
        }
        break;
      case "skip-tenant-user":
        options.skipTenantUser = value === "true" || value.length === 0;
        break;
      default:
        console.warn(`⚠️  Ignoring unknown option "--${rawKey}"`);
    }
  }

  if (!options.username) {
    console.error("✗ Missing required --username (or SYSTEM_ADMIN_BOOTSTRAP_USERNAME).");
    process.exit(1);
  }

  if (!options.email) {
    console.error("✗ Missing required --email (or SYSTEM_ADMIN_BOOTSTRAP_EMAIL).");
    process.exit(1);
  }

  if (!options.email.includes("@")) {
    console.error("✗ Provided email must be valid.");
    process.exit(1);
  }

  return options;
};

const generatePassword = (length = 24): string => {
  const sets = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "0123456789",
    "!@#$%^&*()-_=+[]{}<>?",
  ];

  const pick = (charset: string) => charset[randomBytes(1)[0] % charset.length];

  const requiredChars = sets.map((set) => pick(set));
  const allChars = sets.join("");
  const remaining = Array.from({ length: Math.max(length - requiredChars.length, 0) })
    .map(() => pick(allChars))
    .join("");

  const password = [...requiredChars.join("") + remaining]
    .sort(() => (randomBytes(1)[0] % 2 === 0 ? 1 : -1))
    .join("");

  return password;
};

const generateBackupCodes = (count = 8): string[] =>
  Array.from({ length: count }).map(() => {
    const bytes = randomBytes(6).toString("hex").toUpperCase();
    return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
  });

const defaultAllowedHours = () => `[2000-01-01T00:00:00Z,)`;

const normalizeAllowedHours = (value?: string): string => {
  if (!value || value.trim().length === 0) {
    return defaultAllowedHours();
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("(")) {
    return trimmed;
  }
  return `[${trimmed},)`;
};

const ensureTenant = async (
  client: Awaited<ReturnType<typeof pool.connect>>,
  tenantId?: string,
): Promise<TenantBootstrapResult> => {
  if (tenantId) {
    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM public.tenants WHERE id = $1 AND COALESCE(is_deleted, false) = false`,
      [tenantId],
    );
    if (existing.rows.length === 0) {
      throw new Error(`No tenant found with ID ${tenantId}. Provide a valid tenant or omit --tenant-id.`);
    }
    return { tenantId: existing.rows[0].id, tenantName: existing.rows[0].name, created: false };
  }

  const current = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM public.tenants WHERE COALESCE(is_deleted, false) = false ORDER BY created_at ASC LIMIT 1`,
  );
  if (current.rows.length > 0) {
    return { tenantId: current.rows[0].id, tenantName: current.rows[0].name, created: false };
  }

  const fallbackName = "Bootstrap Tenant";
  const slugSuffix = randomBytes(4).toString("hex");
  const slug = `bootstrap-${slugSuffix}`;

  const insert = await client.query<{ id: string; name: string }>(
    `
      INSERT INTO public.tenants (
        name,
        slug,
        type,
        status,
        email,
        phone,
        country,
        config,
        subscription,
        created_at
      )
      VALUES (
        $1,
        $2,
        'INDEPENDENT',
        'ACTIVE',
        $3,
        $4,
        'US',
        jsonb_build_object('defaultCurrency', 'USD', 'defaultLanguage', 'en', 'defaultTimezone', 'UTC'),
        jsonb_build_object('plan', 'BASIC', 'billingCycle', 'MONTHLY', 'amount', 0, 'currency', 'USD'),
        NOW()
      )
      RETURNING id, name
    `,
    [fallbackName, slug, `bootstrap+${slugSuffix}@example.com`, "+1-555-0100"],
  );

  return { tenantId: insert.rows[0].id, tenantName: insert.rows[0].name, created: true };
};

const upsertTenantUser = async ({
  client,
  username,
  email,
  hashedPassword,
  tenantId,
  tenantRole,
  linkedAdminId,
  force,
}: {
  client: Awaited<ReturnType<typeof pool.connect>>;
  username: string;
  email: string;
  hashedPassword: string;
  tenantId: string;
  tenantRole: TenantRole;
  linkedAdminId: string;
  force: boolean;
}): Promise<{ userId: string; created: boolean }> => {
  const existingUser = await client.query<{ id: string }>(
    `SELECT id FROM public.users WHERE username = $1 AND deleted_at IS NULL`,
    [username],
  );

  const metadata = {
    must_change_password: true,
    bootstrap_linked_admin_id: linkedAdminId,
  };

  let userId: string;
  let created = false;

  if (existingUser.rows.length > 0) {
    if (!force) {
      throw new Error(
        `User "${username}" already exists in tenant directory. Re-run with --force to update it.`,
      );
    }
    userId = existingUser.rows[0].id;
    await client.query(
      `
        UPDATE public.users
           SET password_hash = $1,
               email = $2,
               first_name = COALESCE(first_name, 'System'),
               last_name = COALESCE(last_name, 'Administrator'),
               is_active = true,
               is_verified = true,
               metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
               updated_at = NOW(),
               version = COALESCE(version, 0) + 1
         WHERE id = $4
      `,
      [hashedPassword, email, JSON.stringify(metadata), userId],
    );
  } else {
    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO public.users (
          username,
          email,
          password_hash,
          first_name,
          last_name,
          phone,
          is_active,
          is_verified,
          metadata,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'System',
          'Administrator',
          '+1-555-0101',
          true,
          true,
          $4::jsonb,
          NOW()
        )
        RETURNING id
      `,
      [username, email, hashedPassword, JSON.stringify(metadata)],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  await client.query(
    `
      INSERT INTO public.user_tenant_associations (user_id, tenant_id, role, is_active, permissions, created_at)
      VALUES ($1, $2, $3::tenant_role, true, jsonb_build_object('canAccessAll', true), NOW())
      ON CONFLICT (user_id, tenant_id)
      DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW(),
        version = COALESCE(user_tenant_associations.version, 0) + 1
    `,
    [userId, tenantId, tenantRole],
  );

  return { userId, created };
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  console.log("🔐 Bootstrapping initial system administrator...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM public.system_administrators",
    );
    const count = Number(existing.rows[0]?.count ?? "0");
    if (count > 0 && !options.force) {
      throw new Error(
        "System administrators already exist. Pass --force if you intend to add another bootstrap account.",
      );
    }

    const password = generatePassword();
    const hashedPassword = await bcrypt.hash(password, 12);
    const mfaSecret = authenticator.generateSecret(32);
    const backupCodes = generateBackupCodes();
    const allowedHoursRange = normalizeAllowedHours(options.allowedHours);

    const metadata = {
      trusted_devices: [],
      password_rotated_at: new Date().toISOString(),
      break_glass_codes: backupCodes,
      bootstrap_created: true,
      must_change_password: true,
    };

    const result = await client.query<{
      id: string;
      created_at: Date;
    }>(
      `
        INSERT INTO public.system_administrators (
          username,
          email,
          password_hash,
          role,
          mfa_secret,
          mfa_enabled,
          ip_whitelist,
          allowed_hours,
          failed_login_attempts,
          account_locked_until,
          is_active,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::system_admin_role,
          $5,
          true,
          $6::inet[],
          $7::tstzrange,
          0,
          NULL,
          true,
          $8::jsonb,
          NOW(),
          NOW()
        )
        RETURNING id, created_at
      `,
      [
        options.username,
        options.email,
        hashedPassword,
        options.role,
        mfaSecret,
        options.ipWhitelist,
        allowedHoursRange,
        JSON.stringify(metadata),
      ],
    );

    let tenantProvision: TenantBootstrapResult | null = null;
    let tenantUserResult: { userId: string; created: boolean } | null = null;

    if (!options.skipTenantUser) {
      tenantProvision = await ensureTenant(client, options.tenantId);
      tenantUserResult = await upsertTenantUser({
        client,
        username: options.username,
        email: options.email,
        hashedPassword,
        tenantId: tenantProvision.tenantId,
        tenantRole: options.tenantRole,
        linkedAdminId: result.rows[0]?.id ?? "",
        force: Boolean(options.force),
      });
    }

    await client.query("COMMIT");

    const createdAdmin = result.rows[0];
    console.log("");
    console.log("✅ System administrator created successfully:");
    console.table({
      Username: options.username,
      Email: options.email,
      Role: options.role,
      AllowedHours: allowedHoursRange,
      IPWhitelist: options.ipWhitelist.join(", "),
      AdminId: createdAdmin?.id ?? "n/a",
    });

    if (tenantProvision && tenantUserResult) {
      console.log("");
      console.log(
        `✅ Tenant access ${
          tenantUserResult.created ? "provisioned" : "updated"
        } for "${tenantProvision.tenantName}" (${tenantProvision.tenantId}) as ${options.tenantRole}.`,
      );
      console.log(
        "   These credentials now work in the tenant portal (standard /v1/auth/login) and will require an immediate password change.",
      );
    }

    console.log("");
    console.log("📌 Store these bootstrap credentials in a secure vault immediately:");
    console.log(`   • Username: ${options.username}`);
    console.log(`   • Password: ${password}`);
    console.log(`   • MFA Secret (TOTP): ${mfaSecret}`);
    console.log("   • Break-glass codes:");
    backupCodes.forEach((code, index) => {
      console.log(`     ${index + 1}. ${code}`);
    });
    console.log("");
    console.log(
      `🔁 Password rotation enforced every ${config.systemAdmin.security.passwordRotationDays} day(s).`,
    );
    console.log(
      "   Ensure the admin signs in, configures MFA, and changes the password immediately.",
    );
    if (!options.skipTenantUser) {
      console.log(
        "   After changing the password via the tenant login, the same password applies to system admin logins.",
      );
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Failed to bootstrap system administrator:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();
