export type CmsSectionRecord = {
  id: number | string;
  name?: string | null;
  type: string;
  attributes?: Record<string, any>;
  attributes_meta?: Record<string, CmsAttributeMeta>;
  attributesMeta?: Record<string, CmsAttributeMeta>;
};

export type CmsAttributeMeta = {
  attribute_key?: string | null;
  attributeKey?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  order?: number | null;
  localizable?: boolean | null;
  /** Present on datetime-type attributes — carries countdown target resolved by the API. */
  schedule?: {
    countdown_target_at: string | null;
    countdown_target_source: "section_attribute" | "config.display.countdown_target_at" | "active_until" | null;
  } | null;
};

export type CmsSectionMeta = {
  pageId: number | string | null;
  sectionId: number | string;
  sectionType: string;
  sectionName: string;
  attributesMeta?: Record<string, CmsAttributeMeta>;
};

export function isCmsPreview(url: URL) {
  return url.searchParams.get("cms_preview") === "1";
}

export function getPreviewRobots(robots: string, preview: boolean) {
  return preview ? "noindex,nofollow" : robots;
}

export function resolveCmsCompositionPageId(composition: unknown): number | string | null {
  if (!composition || typeof composition !== "object") return null;
  const c = composition as Record<string, unknown>;
  const page = c.page;
  if (page && typeof page === "object" && !Array.isArray(page)) {
    const id = (page as Record<string, unknown>).id;
    if (id != null && id !== "") return id as number | string;
  }
  if (c.page_id != null && c.page_id !== "") return c.page_id as number | string;
  if (c.pageId != null && c.pageId !== "") return c.pageId as number | string;
  return null;
}

export function normalizeCmsSection(section: unknown): CmsSectionRecord {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return { id: "", type: "", attributes: {} };
  }
  const s = section as Record<string, any>;
  const rawMeta = s.attributes_meta ?? s.attributesMeta;
  let attributes_meta: Record<string, CmsAttributeMeta> | undefined;
  if (rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)) {
    attributes_meta = {};
    for (const [key, val] of Object.entries(rawMeta)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        attributes_meta[key] = {
          ...(val as Record<string, unknown>),
          attribute_key:
            (val as CmsAttributeMeta).attribute_key ??
            (val as CmsAttributeMeta).attributeKey ??
            key,
        };
      }
    }
  }
  return {
    id: s.id as number | string,
    name: s.name,
    type: String(s.type || ""),
    attributes:
      s.attributes && typeof s.attributes === "object" && !Array.isArray(s.attributes)
        ? s.attributes
        : {},
    attributes_meta,
  };
}

export function toSectionMeta(
  pageId: number | string | null | undefined,
  section?: CmsSectionRecord | null,
): CmsSectionMeta | undefined {
  if (!section) return undefined;
  return {
    pageId: pageId ?? null,
    sectionId: section.id,
    sectionType: section.type,
    sectionName: section.name || section.type,
    attributesMeta: section.attributes_meta ?? section.attributesMeta,
  };
}

export function getAttributeMeta(section: CmsSectionRecord | null | undefined, name: string) {
  return (section?.attributes_meta ?? section?.attributesMeta)?.[name];
}

/**
 * Creates the attribute accessor helpers used by every section component.
 * Replaces the 4-line boilerplate copy-pasted across ~21 sections.
 *
 * Usage (in section frontmatter):
 * ```ts
 * const { key, label, type } = getSectionAttr(props.attributesMeta);
 * // then:
 * attributeKey={key("hero_products")}
 * type={type("hero_products", "smart_collection_id")}
 * label={label("hero_products", "Productos")}
 * ```
 */
export function getSectionAttr(attributesMeta?: Record<string, unknown> | null) {
  const meta = (name: string): Record<string, unknown> =>
    (attributesMeta?.[name] ?? {}) as Record<string, unknown>;

  return {
    key: (name: string): string =>
      String(meta(name).attribute_key ?? meta(name).attributeKey ?? name),
    label: (name: string, fallback = ""): string =>
      String(meta(name).label ?? fallback),
    type: (name: string, fallback = "text"): string =>
      String(meta(name).type ?? fallback),
    meta,
  };
}

export {
  buildEditableAttributeProps,
  buildEditableItemInspectTitle,
  buildSectionInspectTitle,
  resolveEditorKind,
  resolveEditorKindLabel,
  type CmsEditorKind,
} from "./inspect-meta";
