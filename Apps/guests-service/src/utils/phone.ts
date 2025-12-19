export const normalizePhoneNumber = (
  value: string | null | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const withoutExtension = value.split(/(?:ext\.?|x)/i)[0] ?? value;
  let digits = withoutExtension.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    const normalized = `+${digits.replace(/[^\d]/g, "")}`;
    return normalized.length > 1 ? normalized : undefined;
  }

  digits = digits.replace(/^00/, "");
  const numeric = digits.replace(/\D/g, "");

  if (numeric.length === 0) {
    return undefined;
  }

  if (numeric.length === 10) {
    return `+1${numeric}`;
  }

  if (numeric.length >= 11 && numeric.length <= 15) {
    return `+${numeric}`;
  }

  return undefined;
};
