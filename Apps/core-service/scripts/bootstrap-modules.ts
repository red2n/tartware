import { randomUUID } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import bcrypt from "bcryptjs";
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
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const isValidUsername = (username: string): boolean => {
  // Alphanumeric, underscores, hyphens, 3-32 chars
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
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
  const email = (await question(`Admin email [${emailDefault}]: `)) || emailDefault;

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
  console.log(`   • MFA Key:   ${adminDetails.mfaSecret}`);
  console.log(
    "   ⚠️  Store the MFA secret in a secure vault and rotate the password after first login.",
  );
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
