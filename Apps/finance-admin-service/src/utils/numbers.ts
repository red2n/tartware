export const toNumberOrFallback = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
