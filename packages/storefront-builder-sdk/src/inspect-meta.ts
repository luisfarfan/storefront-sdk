export type CmsAttributeMetaInput = {
  attribute_key?: string | null;
  attributeKey?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  localizable?: boolean | null;
  ui?: string | null;
};

export type CmsEditorKind =
  | "section"
  | "item"
  | "text"
  | "media"
  | "link"
  | "number"
  | "boolean"
  | "datetime"
  | "collection"
  | "list"
  | "object"
  | "structured"
  | "unknown";

const EDITOR_KIND_LABELS: Record<CmsEditorKind, string> = {
  section: "Sección",
  item: "Ítem",
  text: "Texto",
  media: "Media",
  link: "Enlace",
  number: "Número",
  boolean: "Sí/No",
  datetime: "Fecha/hora",
  collection: "Colección",
  list: "Lista",
  object: "Objeto",
  structured: "Estructura",
  unknown: "Campo",
};

/** Maps CMS attribute `type` (+ optional `ui`) to a stable editor kind for inspect chrome. */
export function resolveEditorKind(type: string | null | undefined, ui?: string | null): CmsEditorKind {
  const t = (type ?? "").trim().toLowerCase();
  const u = (ui ?? "").trim().toLowerCase();

  if (t === "smart_collection_id") {
    return "collection";
  }
  if (t === "array") {
    return "list";
  }
  if (t === "object") {
    return u ? "structured" : "object";
  }
  if (t === "image" || t === "video") {
    return "media";
  }
  if (t === "link" || t === "url") {
    return "link";
  }
  if (t === "number" || t === "color") {
    return "number";
  }
  if (t === "boolean") {
    return "boolean";
  }
  if (t === "datetime") {
    return "datetime";
  }
  if (t === "text" || t === "textarea" || t === "slug" || t === "rich_text") {
    return "text";
  }
  return "unknown";
}

export function resolveEditorKindLabel(kind: CmsEditorKind | string): string {
  return EDITOR_KIND_LABELS[kind as CmsEditorKind] ?? EDITOR_KIND_LABELS.unknown;
}

export function buildEditableAttributeProps(
  meta: CmsAttributeMetaInput | null | undefined,
  name: string,
  overrides?: Partial<{
    label: string;
    type: string;
    ui: string;
    localizable: boolean;
    attributeKey: string;
  }>,
) {
  const attributeKey =
    overrides?.attributeKey ??
    meta?.attribute_key ??
    meta?.attributeKey ??
    name;
  const type = overrides?.type ?? meta?.type ?? "text";
  const uiFromMeta =
    typeof meta === "object" && meta && "ui" in meta
      ? String((meta as Record<string, unknown>).ui ?? "")
      : "";
  const ui = overrides?.ui ?? (uiFromMeta.trim() ? uiFromMeta.trim() : null);
  const label = overrides?.label ?? meta?.label ?? name;
  const localizable = overrides?.localizable ?? meta?.localizable ?? false;
  const editorKind = resolveEditorKind(type, ui);

  return {
    name,
    attributeKey,
    type,
    label,
    ui: ui && ui.trim() ? ui.trim() : undefined,
    localizable: localizable === true,
    editorKind,
    editorKindLabel: resolveEditorKindLabel(editorKind),
    inspectTitle: label?.trim() || name,
  };
}

export function buildSectionInspectTitle(sectionName?: string | null, sectionType?: string | null): string {
  return (sectionName ?? sectionType ?? "Sección").trim() || "Sección";
}

export function buildEditableItemInspectTitle(options: {
  itemLabel?: string | null;
  itemType?: string | null;
  itemIndex?: number | string | null;
  parentAttributeKey?: string | null;
}): string {
  const label = (options.itemLabel ?? "").trim();
  const type = (options.itemType ?? "").trim();
  const index =
    options.itemIndex != null && options.itemIndex !== "" ? Number(options.itemIndex) : null;
  const position = index != null && Number.isFinite(index) ? ` #${index + 1}` : "";
  const base = label || type || "Ítem";
  const parent = (options.parentAttributeKey ?? "").trim();
  return parent ? `${base}${position} · ${parent}` : `${base}${position}`;
}
