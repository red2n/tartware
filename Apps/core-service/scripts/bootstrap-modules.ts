import { randomUUID } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import bcrypt from "bcryptjs";
import ipaddr from "ipaddr.js";
import { authenticator } from "otplib";

import { config } from "../src/config.js";
import { pool, query } from "../src/lib/db.js";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_DEFINITIONS,
  MODULE_IDS,
  type ModuleDefinition,
  type ModuleId,
} from "../src/modules/module-registry.js";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown> | null;
};

type SystemAdminRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: Date;
};

// Environment variables for controlling password/secret display
const SUPPRESS_BOOTSTRAP_PASSWORD = process.env.SUPPRESS_BOOTSTRAP_PASSWORD === "1";
const SHOW_BOOTSTRAP_PASSWORD = process.env.SHOW_BOOTSTRAP_PASSWORD === "1";
const SUPPRESS_BOOTSTRAP_MFA_SECRET = process.env.SUPPRESS_BOOTSTRAP_MFA_SECRET === "1";

const rl = createInterface({ input, output, terminal: true });

const moduleCatalog: ModuleDefinition[] = MODULE_IDS.map((id) => MODULE_DEFINITIONS[id]);

const question = async (prompt: string): Promise<string> => {
  const answer = await rl.question(prompt);
  return answer.trim();
};

const confirm = async (prompt: string, defaultValue = false): Promise<boolean> => {
  const suffix = defaultValue ? " [Y/n]: " : " [y/N]: ";
  const answer = (await question(`${prompt}${suffix}`)).toLowerCase();
  if (!answer) {
    return defaultValue;
  }
  return answer === "y" || answer === "yes";
};

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const normalizeModules = (value: unknown): ModuleId[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_ENABLED_MODULES;
  }
  const next = new Set<ModuleId>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const normalized = entry.trim().toLowerCase();
    if (MODULE_IDS.includes(normalized as ModuleId)) {
      next.add(normalized as ModuleId);
    }
  }
  return next.size > 0 ? Array.from(next) : DEFAULT_ENABLED_MODULES;
};

const fetchTenant = async (identifier: string): Promise<TenantRow | null> => {
  const byId = isUuid(identifier);
  const { rows } = await query<TenantRow>(
    `
      SELECT id, name, slug, config
        FROM public.tenants
       WHERE COALESCE(is_deleted, false) = false
         AND deleted_at IS NULL
         AND ${byId ? "id = $1::uuid" : "slug = $1"}
       LIMIT 1
    `,
    [identifier],
  );
  return rows[0] ?? null;
};

const printModuleCatalog = () => {
  console.log("\n📦 Available SaaS Modules\n-------------------------");
  moduleCatalog.forEach((module, index) => {
    console.log(
      `${index + 1}. ${module.name} (${module.id}) [${module.tier}] – ${module.description}`,
    );
  });
};

const promptModuleSelection = async (current: ModuleId[]): Promise<ModuleId[] | null> => {
  console.log(`\nCurrent modules: ${current.join(", ")}`);
  const listOnly = await confirm("List only for this tenant?", false);
  if (listOnly) {
    return null;
  }

  console.log(
    "\nEnter the module numbers (comma separated) you want enabled for this tenant.\n" +
      "Example: 1,3,5. Leave blank to keep the current set.",
  );

  const selection = await question("Module selection: ");
  if (!selection) {
    return current;
  }

  const indices = selection
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= moduleCatalog.length);

  if (indices.length === 0) {
    console.log("⚠️  No valid module numbers detected; keeping current configuration.");
    return current;
  }

  const nextModules = Array.from(
    new Set(indices.map((index) => moduleCatalog[index - 1]?.id).filter(Boolean)),
  ) as ModuleId[];

  if (!nextModules.includes("core")) {
    console.log("ℹ️  Core module is required and has been added automatically.");
    nextModules.unshift("core");
  }

  return nextModules;
};

const updateTenantModules = async (tenantId: string, modules: ModuleId[]): Promise<void> => {
  const finalModules = modules.length === 0 ? DEFAULT_ENABLED_MODULES : modules;
  await query(
    `
      UPDATE public.tenants
         SET config = jsonb_set(
               COALESCE(config, '{}'::jsonb),
               '{modules}',
               to_jsonb($2::text[]),
               true
             ),
             updated_at = NOW(),
             version = COALESCE(version, 0) + 1
       WHERE id = $1::uuid
    `,
    [tenantId, finalModules],
  );
  console.log(`✅ Updated tenant modules to: ${finalModules.join(", ")}`);
};

const listSystemAdmins = async (): Promise<SystemAdminRow[]> => {
  const { rows } = await query<SystemAdminRow>(`
    SELECT id, username, email, role, created_at
      FROM public.system_administrators
     ORDER BY created_at ASC
  `);
  return rows;
};

const promptAdminBootstrap = async (hasAdmins: boolean): Promise<boolean> => {
  if (!hasAdmins) {
    console.log("\n⚠️  No system administrators found. Bootstrap is required.");
    return true;
  }
  return confirm("\nWould you like to bootstrap an additional system administrator?", false);
};

const parseIpList = (value: string): string[] => {
  if (!value) {
    return ["127.0.0.1/32", "::1/128"];
  }
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  
  // Validate each IP/CIDR entry
  const invalidEntries: string[] = [];
  const validEntries = entries.filter((entry) => {
    const valid = isValidIpOrCidr(entry);
    if (!valid) {
      invalidEntries.push(entry);
    }
    return valid;
  });
  
  if (invalidEntries.length > 0) {
    console.log(`⚠️  Invalid IP/CIDR entries ignored: ${invalidEntries.join(", ")}`);
  }
  
  // Return defaults if no valid entries
  return validEntries.length > 0 ? validEntries : ["127.0.0.1/32", "::1/128"];
};

const isValidUsername = (username: string): boolean => {
  // Alphanumeric, underscores, hyphens, 3-32 chars
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
};

const isValidEmail = (email: string): boolean => {
  // Validate input
  if (!email) {
    return false;
  }
  
  // Check basic structure and length
  if (email.length > 254) {
    return false;
  }
  
  // Split into local and domain parts
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }
  
  const [local, domain] = parts;
  if (!local || !domain) {
    return false;
  }
  
  // Validate local part: alphanumeric start/end, can contain _, -, dots (no consecutive dots)
  if (!/^[a-zA-Z0-9]/.test(local) || !/[a-zA-Z0-9]$/.test(local)) {
    return false;
  }
  if (/\.\./.test(local)) {
    return false;  // No consecutive dots
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(local)) {
    return false;  // Only allowed characters
  }
  
  // Validate domain part: alphanumeric labels separated by dots, no underscores, no trailing hyphens
  if (!/^[a-zA-Z0-9]/.test(domain) || !/[a-zA-Z0-9]$/.test(domain)) {
    return false;
  }
  if (/\.\./.test(domain)) {
    return false;  // No consecutive dots
  }
  if (/_/.test(domain)) {
    return false;  // No underscores in domain
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return false;  // Only allowed characters
  }
  
  // Each domain label must not start or end with hyphen
  const domainLabels = domain.split('.');
  for (const label of domainLabels) {
    if (!label || /^-/.test(label) || /-$/.test(label)) {
      return false;
    }
  }
  
  // Ensure domain has valid TLD (at least 2 chars after last dot)
  const tldMatch = domain.match(/\.([a-zA-Z]{2,})$/);
  return tldMatch !== null;
};

const isValidIpOrCidr = (value: string): boolean => {
  try {
    // Check if it's a CIDR range
    if (value.includes("/")) {
      const parts = value.split("/");
      // Must have exactly 2 parts: IP and prefix
      if (parts.length !== 2) {
        return false;
      }
      
      const [ip, prefixStr] = parts;
      const prefix = Number.parseInt(prefixStr, 10);
      
      // Check for NaN
      if (Number.isNaN(prefix)) {
        return false;
      }
      
      // Parse the IP part
      const addr = ipaddr.process(ip);
      
      // Validate prefix length based on IP version
      const kind = addr.kind();
      if (kind === "ipv4") {
        return prefix >= 0 && prefix <= 32;
      } else if (kind === "ipv6" || kind === "ipv4-mapped") {
        return prefix >= 0 && prefix <= 128;
      }
      return false;
    } else {
      // Just validate it's a valid IP address
      ipaddr.process(value);
      return true;
    }
  } catch {
    return false;
  }
};

const promptAdminDetails = async () => {
  let username: string;
  while (true) {
    const inputUsername = (await question("\nAdmin username [sysadmin]: ")) || "sysadmin";
    if (isValidUsername(inputUsername)) {
      username = inputUsername;
      break;
    } else {
      console.log("❌ Invalid username. Usernames must be 3-32 characters and contain only letters, numbers, underscores, or hyphens.");
    }
  }
  const emailDefault = `${username}@example.com`;
  let email: string;
  while (true) {
    const inputEmail = (await question(`Admin email [${emailDefault}]: `)) || emailDefault;
    if (isValidEmail(inputEmail)) {
      email = inputEmail;
      break;
    } else {
      console.log("❌ Invalid email format. Please enter a valid email address.");
    }
  }

  const roleChoices = ["SYSTEM_ADMIN", "SYSTEM_OPERATOR", "SYSTEM_AUDITOR", "SYSTEM_SUPPORT"] as const;
  console.log("\nRoles:");
  roleChoices.forEach((role, index) => console.log(`${index + 1}. ${role}`));
  const roleSelection = await question("Choose role number [1]: ");
  const roleIndex = Number.parseInt(roleSelection || "1", 10);
  const role = roleChoices[roleIndex - 1] ?? "SYSTEM_ADMIN";

  const passwordPrompt =
    "\nTemporary password (leave blank to use AUTH_DEFAULT_PASSWORD env value): ";
  const rawPassword = await question(passwordPrompt);
  const password = rawPassword || config.auth.defaultPassword;
  if (!password || password.length < 12) {
    console.log("⚠️  Strong passwords (12+ characters) are recommended.");
  }
  const hashedPassword = await bcrypt.hash(password, 12);

  const ipInput = await question(
    "Allowed IPs/CIDRs (comma separated) [127.0.0.1/32,::1/128]: ",
  );
  const ipWhitelist = parseIpList(ipInput);

  const allowAllHours = await confirm(
    "Allow 24x7 access (otherwise provide custom tstzrange later)?",
    true,
  );
  const allowedHours = allowAllHours
    ? "[2000-01-01T00:00:00Z,2100-01-01T00:00:00Z)"
    : await question("Enter tstzrange (e.g., [2024-01-01T09:00:00Z,2024-01-01T17:00:00Z)): ");

  const mfaSecret = authenticator.generateSecret();

  return {
    username,
    email,
    role,
    hashedPassword,
    ipWhitelist,
    allowedHours: allowedHours || null,
    mfaSecret,
    plaintextPassword: password,
  };
};

const bootstrapAdmin = async () => {
  const adminDetails = await promptAdminDetails();
  const adminId = randomUUID();

  await query(
    `
      INSERT INTO public.system_administrators (
        id,
        username,
        email,
        password_hash,
        role,
        mfa_secret,
        mfa_enabled,
        ip_whitelist,
        allowed_hours,
        metadata,
        is_active,
        created_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5::system_admin_role,
        $6,
        true,
        $7::inet[],
        $8::tstzrange,
        $9::jsonb,
        true,
        NOW()
      )
    `,
    [
      adminId,
      adminDetails.username,
      adminDetails.email,
      adminDetails.hashedPassword,
      adminDetails.role,
      adminDetails.mfaSecret,
      adminDetails.ipWhitelist,
      adminDetails.allowedHours,
      JSON.stringify({ trusted_devices: ["bootstrap-device"] }),
    ],
  );

  console.log("\n✅ System administrator bootstrapped successfully:");
  console.log(`   • Username:  ${adminDetails.username}`);
  console.log(`   • Email:     ${adminDetails.email}`);
  console.log(`   • Role:      ${adminDetails.role}`);
  if (
    !SUPPRESS_BOOTSTRAP_PASSWORD &&
    (SHOW_BOOTSTRAP_PASSWORD || process.stdout.isTTY)
  ) {
    console.log(`   • Temp Pass: ${adminDetails.plaintextPassword}`);
    console.log(
      "   ⚠️  WARNING: The plaintext password is displayed above. " +
      "If running in a CI/CD or logged environment, clear logs and rotate the password immediately."
    );
  } else {
    console.log("   • Temp Pass: [hidden]");
    console.log(
      "   ⚠️  The plaintext password was not displayed for security reasons. " +
      "Set SHOW_BOOTSTRAP_PASSWORD=1 or use --show-password to display it (not recommended in CI/CD)."
    );
  }
  if (!SUPPRESS_BOOTSTRAP_MFA_SECRET) {
    console.log(`   • MFA Key:   ${adminDetails.mfaSecret}`);
    console.log(
      "   ⚠️  WARNING: The MFA secret is displayed above. This sensitive secret should be:\n" +
      "      - Stored immediately in a secure vault or password manager\n" +
      "      - Never shared in logs, screenshots, or unsecured communication\n" +
      "      - Protected from terminal history exposure\n" +
      "      - Rotated along with the password after first login",
    );
  } else {
    console.log("   • MFA Key:   [hidden]");
    console.log(
      "   ⚠️  The MFA secret was not displayed for security reasons. " +
      "Set SUPPRESS_BOOTSTRAP_MFA_SECRET=0 to display it (not recommended in CI/CD).",
    );
  }
};

const run = async () => {
  try {
    console.log("Tartware SaaS Module & Admin Bootstrap\n======================================");
    printModuleCatalog();

    if (await confirm("\nManage modules for a tenant now?", true)) {
      const identifier = await question(
        "\nEnter tenant slug or UUID (or press Enter to skip): ",
      );
      if (identifier) {
        const tenant = await fetchTenant(identifier);
        if (!tenant) {
          console.error("❌ Tenant not found. Check the slug/UUID and try again.");
        } else {
          const tenantConfig = (tenant.config ?? {}) as { modules?: unknown };
          const currentModules = normalizeModules(tenantConfig.modules);
          const nextModules = await promptModuleSelection(currentModules);
          if (nextModules && nextModules.join(",") !== currentModules.join(",")) {
            await updateTenantModules(tenant.id, nextModules);
          } else if (nextModules) {
            console.log("ℹ️  No module changes detected for this tenant.");
          }
        }
      }
    }

    const admins = await listSystemAdmins();
    if (admins.length > 0) {
      console.log("\nExisting system administrators:");
      admins.forEach((admin) =>
        console.log(` - ${admin.username} (${admin.email}) [${admin.role}]`),
      );
    }

    if (await promptAdminBootstrap(admins.length === 0)) {
      await bootstrapAdmin();
    } else {
      console.log("\nℹ️  Skipped system administrator bootstrap.");
    }
  } catch (error) {
    console.error("❌ Bootstrap script failed:", error);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
};

run();
