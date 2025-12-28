import { createHash } from "node:crypto";

export const hashIdentifier = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  return createHash("sha256").update(value).digest("hex");
};
