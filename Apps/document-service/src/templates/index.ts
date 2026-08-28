/**
 * DEV DOC
 * Module: templates/index.ts
 * Purpose: Template registry and the boot-time locale coverage check.
 * Ownership: document-service
 *
 * Templates are data, so the thing that can go wrong with them is a label that
 * exists in one language and not another. {@link assertTemplateCoverage} turns
 * that into a boot failure instead of a French folio with English gaps in it.
 */
import { type DocumentTemplate, findMissingStringKeys } from "@tartware/schemas";

import { allLocales } from "../locales/index.js";

import { FOLIO_STANDARD } from "./folio-standard.js";

const TEMPLATES: Record<string, DocumentTemplate> = {
  [FOLIO_STANDARD.id]: FOLIO_STANDARD,
};

/** Look up a template by id. */
export const getTemplate = (id: string): DocumentTemplate | undefined => TEMPLATES[id];

/** Every registered template id, sorted. */
export const listTemplates = (): DocumentTemplate[] =>
  Object.values(TEMPLATES).sort((a, b) => a.id.localeCompare(b.id));

/** One template's untranslated keys in one locale. */
export type TemplateCoverageGap = {
  template: string;
  locale: string;
  missing: string[];
};

/** Find every key a registered template needs that some locale does not supply. */
export const findCoverageGaps = (): TemplateCoverageGap[] => {
  const gaps: TemplateCoverageGap[] = [];
  for (const template of listTemplates()) {
    for (const { locale, strings } of allLocales()) {
      const missing = findMissingStringKeys(template, strings);
      if (missing.length > 0) {
        gaps.push({ template: template.id, locale, missing });
      }
    }
  }
  return gaps;
};

/**
 * Refuse to start with an untranslated template.
 *
 * A missing key renders as the key itself, which is survivable but visible to a
 * guest. Catching it at boot costs nothing; catching it at check-out costs a
 * reprint.
 */
export const assertTemplateCoverage = (): void => {
  const gaps = findCoverageGaps();
  if (gaps.length === 0) return;

  const detail = gaps
    .map((gap) => `${gap.template}/${gap.locale}: ${gap.missing.join(", ")}`)
    .join("; ");
  throw new Error(`Document templates have untranslated keys — ${detail}`);
};
