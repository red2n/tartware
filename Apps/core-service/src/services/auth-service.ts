import { UserSchema } from "@tartware/schemas";
import bcrypt from "bcryptjs";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { signAccessToken } from "../lib/jwt.js";

import { userCacheService } from "./user-cache-service.js";

const AuthUserSchema = UserSchema.pick({
  id: true,
  username: true,
  email: true,
  first_name: true,
  last_name: true,
  password_hash: true,
  is_active: true,
  metadata: true,
});

type AuthUser = typeof AuthUserSchema._type;

type AuthResultSuccess = {
  ok: true;
  data: {
    user: Omit<AuthUser, "password_hash">;
    memberships: Awaited<ReturnType<typeof userCacheService.getUserMemberships>>;
    accessToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
  };
};

type AuthResultError = {
  ok: false;
  reason: "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "PASSWORD_REUSE_NOT_ALLOWED";
};

export type AuthResult = AuthResultSuccess | AuthResultError;

const AUTH_USER_SQL = `
  SELECT id, username, email, first_name, last_name, password_hash, is_active, metadata
  FROM public.users
  WHERE username = $1
    AND deleted_at IS NULL
    AND COALESCE(is_deleted, false) = false
  LIMIT 1
`;

const findUserForAuthentication = async (username: string): Promise<AuthUser | null> => {
  try {
    const result = await pool.query<AuthUser>(AUTH_USER_SQL, [username]);
    if (result.rows.length === 0) {
      return null;
    }
    return AuthUserSchema.parse(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user for authentication:", error);
    return null;
  }
};

export const authenticateUser = async (username: string, password: string): Promise<AuthResult> => {
  const user = await findUserForAuthentication(username);
  if (!user) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (!user.is_active) {
    return { ok: false, reason: "ACCOUNT_INACTIVE" };
  }

  const memberships = await userCacheService.getUserMemberships(user.id);
  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  let mustChangePassword = Boolean(metadata.must_change_password);

  if (!mustChangePassword && config.auth.defaultPassword) {
    try {
      const matchesDefault = await bcrypt.compare(config.auth.defaultPassword, user.password_hash);
      mustChangePassword = matchesDefault;
    } catch {
      mustChangePassword = false;
    }
  }

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    type: "access",
    must_change_password: mustChangePassword,
  });

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
      },
      memberships,
      accessToken,
      expiresIn: config.auth.jwt.expiresInSeconds,
      mustChangePassword,
    },
  };
};

const findUserById = async (userId: string): Promise<AuthUser | null> => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, password_hash, is_active, metadata
       FROM public.users
       WHERE id = $1
         AND deleted_at IS NULL
         AND COALESCE(is_deleted, false) = false`,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return AuthUserSchema.parse(result.rows[0]);
  } catch (error) {
    console.error("Error retrieving user for password change:", error);
    return null;
  }
};

export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResultSuccess | AuthResultError> => {
  const user = await findUserById(userId);
  if (!user) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const currentValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentValid) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (!user.is_active) {
    return { ok: false, reason: "ACCOUNT_INACTIVE" };
  }

  if (newPassword === config.auth.defaultPassword) {
    return { ok: false, reason: "PASSWORD_REUSE_NOT_ALLOWED" };
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  try {
    await pool.query(
      `UPDATE public.users
         SET password_hash = $1,
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{must_change_password}', 'false', true),
             updated_at = NOW(),
             version = COALESCE(version, 0) + 1
       WHERE id = $2`,
      [newHash, userId],
    );
  } catch (error) {
    console.error("Failed to update user password:", error);
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  await userCacheService.invalidateUser(userId);

  // Fetch memberships for new token payload
  const memberships = await userCacheService.getUserMemberships(userId);

  const accessToken = signAccessToken({
    sub: userId,
    username: user.username,
    type: "access",
    must_change_password: false,
  });

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
      } satisfies Omit<AuthUser, "password_hash">,
      memberships,
      accessToken,
      expiresIn: config.auth.jwt.expiresInSeconds,
      mustChangePassword: false,
    },
  };
};
