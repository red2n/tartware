/**
 * DEV DOC
 * Module: locales/index.ts
 * Purpose: Locale registry and resolution for document rendering.
 * Ownership: document-service
 *
 * Resolution walks from the most specific tag to the least — `fr-CA` falls back
 * to `fr`, then to `en`. A folio must render in *some* language; the worst
 * acceptable outcome is English labels, never raw keys.
 */
import { normalizeDocumentLocale } from "@tartware/schemas";

import { en } from "./en.js";
import { fr } from "./fr.js";

/** The locale used when nothing better matches. */
export const FALLBACK_LOCALE = "en";

const LOCALES: Record<string, Record<string, string>> = { en, fr };

/** Locale tags this service has string tables for. */
export const supportedLocales = (): string[] => Object.keys(LOCALES).sort();

/**
 * Resolve a requested tag to a string table.
 *
 * Returns the tag actually used alongside the table, so the response can tell a
 * caller that their `de-AT` request was served in English rather than letting
 * them assume otherwise.
 */
export const resolveLocale = (
  requested: string | undefined,
): { locale: string; strings: Record<string, string> } => {
  const canonical = normalizeDocumentLocale(requested);
  const segments = canonical.split("-");

  // "fr-CA" → try "fr-CA", then "fr".
  for (let length = segments.length; length > 0; length -= 1) {
    const candidate = segments.slice(0, length).join("-");
    const exact = LOCALES[candidate] ?? LOCALES[candidate.toLowerCase()];
    if (exact) return { locale: candidate, strings: exact };
  }

  return { locale: FALLBACK_LOCALE, strings: en };
};

/** Every registered table, for the boot-time template coverage check. */
export const allLocales = (): Array<{
  locale: string;
  strings: Record<string, string>;
}> => Object.entries(LOCALES).map(([locale, strings]) => ({ locale, strings }));
