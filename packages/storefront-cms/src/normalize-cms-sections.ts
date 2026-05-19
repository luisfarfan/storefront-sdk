import { normalizeCmsSection, type CmsSectionRecord } from './cms-preview.js';

export function normalizeCmsSections(sections: unknown): CmsSectionRecord[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => normalizeCmsSection(section));
}
