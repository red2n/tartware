import bcrypt from "bcryptjs";

/**
 * Hash a password using bcrypt with salt rounds of 12
 * @param password - Plain text password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
