export type CmsSectionRecord = {
  id: number | string;
  name?: string | null;
  type: string;
  attributes?: Record<string, any>;
  attributes_meta?: Record<
    string,
    {
      attribute_definition_id?: number | string | null;
      name?: string | null;
      label?: string | null;
      type?: string | null;
      order?: number | null;
    }
  >;
};

export type CmsSectionMeta = {
  pageId: number | string | null;
  sectionId: number | string;
  sectionType: string;
  sectionName: string;
  attributesMeta?: CmsSectionRecord['attributes_meta'];
};

export type CmsShellSectionMap = {
  ticker?: CmsSectionMeta;
  header?: CmsSectionMeta;
  mega_menu?: CmsSectionMeta;
  footer?: CmsSectionMeta;
};

export function isCmsPreview(url: URL) {
  return url.searchParams.get('cms_preview') === '1';
}

export function getPreviewRobots(robots: string, preview: boolean) {
  return preview ? 'noindex,nofollow' : robots;
}

/**
 * Reads CMS page id from composition payloads that may use `page.id`,
 * top-level `page_id`, or camelCase `pageId`.
 */
export function resolveCmsCompositionPageId(composition: unknown): number | string | null {
  if (!composition || typeof composition !== 'object') {
    return null;
  }
  const c = composition as Record<string, unknown>;
  const page = c.page;
  if (page && typeof page === 'object' && !Array.isArray(page)) {
    const id = (page as Record<string, unknown>).id;
    if (id != null && id !== '') {
      return id as number | string;
    }
  }
  if (c.page_id != null && c.page_id !== '') {
    return c.page_id as number | string;
  }
  if (c.pageId != null && c.pageId !== '') {
    return c.pageId as number | string;
  }
  return null;
}

/**
 * Normalizes a section from the composition API so preview/DOM helpers always see
 * snake_case `attributes_meta` and `attribute_definition_id` (also accepts camelCase).
 */
export function normalizeCmsSection(section: unknown): CmsSectionRecord {
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return { id: '', type: '', attributes: {} };
  }
  const s = section as Record<string, any>;
  const rawMeta = s.attributes_meta ?? s.attributesMeta;
  let attributes_meta: CmsSectionRecord['attributes_meta'] = undefined;
  if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
    attributes_meta = {};
    for (const [key, val] of Object.entries(rawMeta)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const v = val as Record<string, unknown>;
        const rawId = v['attribute_definition_id'] ?? v['attributeDefinitionId'] ?? null;
        const attrDefId = (typeof rawId === 'string' || typeof rawId === 'number') ? rawId : null;
        attributes_meta[key] = {
          ...v,
          attribute_definition_id: attrDefId,
        };
      }
    }
  }
  return {
    id: s.id as CmsSectionRecord['id'],
    name: s.name,
    type: String(s.type || ''),
    attributes:
      s.attributes && typeof s.attributes === 'object' && !Array.isArray(s.attributes)
        ? s.attributes
        : {},
    attributes_meta,
  };
}

export function toSectionMeta(
  pageId: number | string | null | undefined,
  section?: CmsSectionRecord | null,
): CmsSectionMeta | undefined {
  if (!section) {
    return undefined;
  }

  return {
    pageId: pageId ?? null,
    sectionId: section.id,
    sectionType: section.type,
    sectionName: section.name || section.type,
    attributesMeta: section.attributes_meta,
  };
}

export function findSectionByType(
  sections: unknown[] = [],
  type: string,
  index = 0,
) {
  const normalized = sections.map((section) => normalizeCmsSection(section));
  const matches = normalized.filter((section) => section.type === type);
  return matches[index];
}

export function getShellSectionMap(
  pageId: number | string | null | undefined,
  sections: unknown[] = [],
): CmsShellSectionMap {
  return {
    ticker: toSectionMeta(pageId, findSectionByType(sections, 'ticker')),
    header: toSectionMeta(pageId, findSectionByType(sections, 'header')),
    mega_menu: toSectionMeta(pageId, findSectionByType(sections, 'mega_menu')),
    footer: toSectionMeta(pageId, findSectionByType(sections, 'footer')),
  };
}

export function getAttributeMeta(
  section: CmsSectionRecord | null | undefined,
  name: string,
) {
  return section?.attributes_meta?.[name];
}
