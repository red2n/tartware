import { config } from "../config.js";

export const isManualReleaseAuthorized = (token?: string | null): boolean => {
  if (!config.guard.manualRelease.enabled) {
    return false;
  }

  if (!token || token.length === 0) {
    return false;
  }

  if (config.guard.manualRelease.tokens.length === 0) {
    return false;
  }

  return config.guard.manualRelease.tokens.includes(token);
};
