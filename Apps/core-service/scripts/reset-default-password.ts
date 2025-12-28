import bcrypt from "bcryptjs";

import { config } from "../src/config.js";
import { pool } from "../src/lib/db.js";
import { userCacheService } from "../src/services/user-cache-service.js";

const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to reset passwords in production environment.");
    process.exit(1);
  }

  console.log("🔐 Resetting user passwords to default value...");

  try {
    const hashed = await bcrypt.hash(config.auth.defaultPassword, 10);
    const result = await pool.query(
      `
        UPDATE public.users
           SET password_hash = $1,
               updated_at = NOW(),
               version = COALESCE(version, 0) + 1
         WHERE COALESCE(is_active, true) = true
      `,
      [hashed],
    );

    console.log(`✅ Reset ${result.rowCount} user password(s) to the default password.`);
    console.log(
      "ℹ️  Each user will be prompted to change their password on next login (must_change_password flag).",
    );

    const deletedKeys = await userCacheService.invalidateAllUsers();
    console.log(`🧹 Cleared ${deletedKeys} cached user entries after password reset.`);
  } catch (error) {
    console.error("❌ Failed to reset user passwords:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
