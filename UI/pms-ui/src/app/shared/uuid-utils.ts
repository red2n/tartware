/**
 * Generate a UUID v4 string.
 * Uses native crypto.randomUUID() if available (secure contexts),
 * otherwise falls back to a math-based generator.
 */
export function generateUUID(): string {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts (HTTP via IP)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
