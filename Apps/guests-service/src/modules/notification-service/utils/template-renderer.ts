/**
 * Simple template rendering engine for notification templates.
 *
 * Supported syntax:
 * - `{{variable_name}}` — replaced with value from context
 * - `{{variable_name | fallback_text}}` — replaced with value or fallback if missing
 *
 * Variables are case-insensitive for lookup.
 */

const TEMPLATE_VAR_PATTERN = /\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;

/**
 * Render a template string by substituting `{{variable}}` placeholders
 * with values from the provided context.
 *
 * @param template - The template string containing `{{variable}}` placeholders
 * @param context - Key-value map of variable names to their string values
 * @returns The rendered string with all variables substituted
 */
export const renderTemplate = (
  template: string,
  context: Record<string, string | number | boolean | null | undefined>,
): string => {
  const normalizedContext = new Map<string, string>();
  for (const [key, value] of Object.entries(context)) {
    if (value != null) {
      normalizedContext.set(key.toLowerCase().trim(), String(value));
    }
  }

  return template.replace(
    TEMPLATE_VAR_PATTERN,
    (_match, variableName: string, fallback?: string) => {
      const key = variableName.toLowerCase().trim();
      const resolved = normalizedContext.get(key);
      if (resolved !== undefined) {
        return resolved;
      }
      if (fallback !== undefined) {
        return fallback.trim();
      }
      return `{{${variableName.trim()}}}`;
    },
  );
};

/**
 * Extract all variable names referenced in a template.
 *
 * @param template - The template string to scan
 * @returns Array of unique variable names (lowercased, trimmed)
 */
export const extractTemplateVariables = (template: string): string[] => {
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TEMPLATE_VAR_PATTERN.source, "g");

  match = pattern.exec(template);
  while (match !== null) {
    const varName = match[1];
    if (varName) {
      variables.add(varName.toLowerCase().trim());
    }
    match = pattern.exec(template);
  }

  return [...variables];
};
