/**
 * Editorial overrides for items inside a smart collection / product list
 * (e.g. per-product badge "SUPER OFERTA"). API may send snake_case or camelCase.
 */
export type ProductItemOverride = {
  item_key?: string | null;
  itemKey?: string | null;
  slug?: string | null;
  product_id?: string | number | null;
  productId?: string | number | null;
  /** Primary editorial label shown as a badge on the card */
  item_badge?: string | null;
  label?: string | null;
  badge?: string | null;
  [key: string]: unknown;
};

function overrideMatchesProduct(
  override: ProductItemOverride,
  product: { slug?: string | null; id?: string | number | null },
): boolean {
  const slug = product.slug != null ? String(product.slug) : '';
  const id = product.id != null ? String(product.id) : '';
  const keys = [
    override.item_key,
    override.itemKey,
    override.slug,
  ].filter((v) => v != null && String(v).trim() !== '') as string[];
  for (const k of keys) {
    if (k === slug) return true;
  }
  const pid = override.product_id ?? override.productId;
  if (pid != null && String(pid) === id) return true;
  return false;
}

function pickBadge(override: ProductItemOverride): string | undefined {
  const raw =
    override.item_badge ??
    override.label ??
    override.badge ??
    (typeof override.custom_label === 'string' ? override.custom_label : null);
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

/**
 * Merges per-item editorial fields into resolved catalog rows.
 * `overrides` is typically `section.attributes.item_overrides` (array).
 */
export function mergeProductItemOverrides<T extends { slug?: string | null; id?: string | number | null }>(
  products: T[],
  overrides: unknown,
): Array<T & { item_badge?: string }> {
  if (!Array.isArray(overrides) || overrides.length === 0) {
    return products as Array<T & { item_badge?: string }>;
  }
  return products.map((p) => {
    const o = overrides.find((entry) =>
      entry && typeof entry === 'object'
        ? overrideMatchesProduct(entry as ProductItemOverride, p)
        : false,
    ) as ProductItemOverride | undefined;
    if (!o) return p as T & { item_badge?: string };
    const item_badge = pickBadge(o);
    if (!item_badge) return p as T & { item_badge?: string };
    return { ...p, item_badge };
  });
}

/**
 * Reads overrides from common API shapes: top-level `item_overrides` or nested under `products`.
 */
export function extractItemOverridesFromSectionAttributes(
  attrs: Record<string, unknown> | undefined | null,
): unknown {
  if (!attrs || typeof attrs !== 'object') return undefined;
  const a = attrs as Record<string, unknown>;
  return (
    a.item_overrides ??
    a.itemOverrides ??
    (a.products as Record<string, unknown> | undefined)?.item_overrides ??
    (a.products as Record<string, unknown> | undefined)?.itemOverrides
  );
}
