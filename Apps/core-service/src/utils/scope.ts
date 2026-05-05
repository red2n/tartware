import type { AuthUser } from "../types/auth.js";

export const hasScope = (user: AuthUser | undefined, requiredScope: string): boolean => {
  if (!user) {
    return false;
  }
  if (!user.scope) {
    return false;
  }
  const normalizedScopes = Array.isArray(user.scope) ? user.scope : user.scope.split(" ");
  return normalizedScopes.includes(requiredScope);
};
