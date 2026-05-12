import { hashIdentifier as hash } from "@tartware/config";

export const hashIdentifier = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return hash(value);
};
