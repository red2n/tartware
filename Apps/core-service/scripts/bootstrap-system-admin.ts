import { randomBytes } from "node:crypto";

import type { SystemAdminRole } from "@tartware/schemas";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";

import { config } from "../src/config.js";
import { pool } from "../src/lib/db.js";

type CliOptions = {
  username?: string;
  email?: string;
  role: SystemAdminRole;
  ipWhitelist: string[];
  allowedHours?: string;
  force?: boolean;
};

const VALID_ROLES: SystemAdminRole[] = [
  "SYSTEM_ADMIN",
  "SYSTEM_OPERATOR",
  "SYSTEM_AUDITOR",
  "SYSTEM_SUPPORT",
] as const;

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

const main = async (): Promise<void> => {
  const options = parseArgs();
  console.log("🔐 Bootstrapping initial system administrator...");

  try {
    const existing = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM public.system_administrators",
    );
    const count = Number(existing.rows[0]?.count ?? "0");
    if (count > 0 && !options.force) {
      console.error(
        "✗ System administrators already exist. Pass --force if you intend to add another bootstrap account.",
      );
      process.exit(1);
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
    };

    const result = await pool.query<{
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

    console.log("");
    console.log("📌 Store these bootstrap credentials in a secure vault immediately:");
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
  } catch (error) {
    console.error("❌ Failed to bootstrap system administrator:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
