const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const toNumberOrFallback = (value: unknown, fallback = 0): number => {
  const numeric = toOptionalNumber(value);
  return numeric ?? fallback;
};

export const toNonNegativeInt = (value: unknown, fallback = 0): number => {
  const numeric = toOptionalNumber(value);
  if (numeric === undefined) {
    return fallback;
  }
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(numeric));
};
