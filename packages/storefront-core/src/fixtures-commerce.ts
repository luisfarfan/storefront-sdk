/**
 * Per-app commerce fixtures — logic lives in SDK; JSON is injected per website.
 */
import type {
  BuyerProfile,
  Cart,
  CartItem,
  CategoryNavNode,
  CategoryNavTreeResponse,
  CustomerAddress,
  GuestOrderPayload,
  GuestOrderResult,
  Order,
  OrderListResponse,
  ProductListingFilters,
  ProductListingSortOption,
  ProximaWebsiteResponse,
  StorefrontBrandListingResponse,
  StorefrontCategoryListingResponse,
  StorefrontProductListingResponse,
  StorefrontProductSummary,
  StorefrontSearchResponse,
  StorefrontSortOption,
  UbigeoResult,
} from "./index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StorefrontDataMode = "fixtures" | "live";

/** Raw catalog entity as stored in apps/{slug}/src/fixtures/catalog-items.json */
export type FixtureCatalogItem = Record<string, unknown>;

export interface FixtureBundleInput {
  catalog: FixtureCatalogItem[];
  categoryNavTree: CategoryNavTreeResponse;
  cart?: Cart | null;
  categoryProductMap?: Record<string, string[]>;
  customerAddresses?: CustomerAddress[];
}

export interface FixtureProductListingParams {
  filters?: ProductListingFilters;
  sort?: ProductListingSortOption | string;
  page?: number;
  page_size?: number;
  currency?: string;
  locale?: string;
}

export interface FixtureSearchParams {
  q: string;
  limit?: number;
  currency?: string;
  locale?: string;
}

export interface FixtureCartMutationParams {
  token?: string | null;
  sessionId?: string | null;
  variantId: number;
  quantity?: number;
}

export class FixtureGuestOrderError extends Error {
  constructor(
    public readonly code: "CART_NOT_FOUND" | "OUT_OF_STOCK" | "SERVER_ERROR" | "VARIANT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "FixtureGuestOrderError";
  }
}

export interface FixtureBundle extends FixtureBundleInput {
  getCart(sessionId?: string | null): Cart;
  addToCart(sessionId: string | null | undefined, variantId: number, quantity: number): Cart;
  updateCartItem(sessionId: string | null | undefined, variantId: number, quantity: number): Cart;
  removeCartItem(sessionId: string | null | undefined, variantId: number): Cart;
  getCategoryNavTree(): CategoryNavTreeResponse;
  getCategoryProducts(
    slug: string,
    params?: FixtureListingParams,
  ): StorefrontCategoryListingResponse;
  getBrandProducts(
    slug: string,
    params?: FixtureBrandListingParams,
  ): StorefrontBrandListingResponse;
  getProductListing(params?: FixtureProductListingParams): StorefrontProductListingResponse;
  searchProducts(params: FixtureSearchParams): StorefrontSearchResponse;
  getCustomerAddresses(): CustomerAddress[];
  processGuestCheckout(sessionId: string, payload: GuestOrderPayload): GuestOrderResult;
}

export interface FixtureListingParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  brand?: string;
  currency?: string;
  locale?: string;
}

export interface FixtureBrandListingParams extends FixtureListingParams {
  category?: string;
}

export interface StorefrontDataSourceConfig {
  mode: StorefrontDataMode;
  fixtures: FixtureBundle;
  apiConfig: { baseUrl: string };
  website: Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency">;
}

export interface StorefrontCartParams {
  token?: string | null;
  sessionId?: string | null;
}

export interface StorefrontDataSource {
  getCart(params?: StorefrontCartParams): Promise<Cart>;
  addToCart(params: FixtureCartMutationParams): Promise<Cart>;
  updateCartItem(params: FixtureCartMutationParams & { quantity: number }): Promise<Cart>;
  removeCartItem(params: Omit<FixtureCartMutationParams, "quantity">): Promise<Cart>;
  getCategoryNavTree(params?: { maxDepth?: number; locale?: string }): Promise<CategoryNavTreeResponse>;
  getCategoryProducts(
    slug: string,
    params?: FixtureListingParams & { brand?: string; q?: string },
  ): Promise<StorefrontCategoryListingResponse>;
  getBrandProducts(
    slug: string,
    params?: FixtureBrandListingParams & { q?: string },
  ): Promise<StorefrontBrandListingResponse>;
  getProductListing(params?: FixtureProductListingParams): Promise<StorefrontProductListingResponse>;
  searchProducts(params: FixtureSearchParams): Promise<StorefrontSearchResponse>;
  getCustomerAddresses(params?: { token?: string | null }): Promise<CustomerAddress[]>;
  getBuyerProfile(params: { token: string }): Promise<BuyerProfile>;
  getOrders(params: { token: string; page?: number; size?: number }): Promise<OrderListResponse>;
  getOrder(params: { token: string; orderId: string }): Promise<Order>;
  searchUbigeo(params: { q: string }): Promise<UbigeoResult[]>;
  processGuestCheckout(payload: GuestOrderPayload): Promise<GuestOrderResult>;
}

export interface ResolveStorefrontDataSourceOptions {
  request: Request;
  fixtures: FixtureBundle;
  apiConfig: { baseUrl: string; domain?: string; serviceKey?: string };
  resolveMode: (host: string) => StorefrontDataMode;
  getRequestHost: (request: Request) => string;
  getFixtureWebsite: () => Pick<
    ProximaWebsiteResponse,
    "business_id" | "locale" | "currency" | "data_mode"
  >;
  fetchLiveWebsite: () => Promise<
    Pick<ProximaWebsiteResponse, "business_id" | "locale" | "currency" | "data_mode">
  >;
}

export interface ValidateFixtureBundleOptions {
  /** Product slugs referenced from composition fixtures (e.g. home.json collections) */
  compositionProductSlugs?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SORT_OPTIONS: StorefrontSortOption[] = [
  { value: "newest", label: "Más recientes" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name_asc", label: "Nombre A–Z" },
];

const EMPTY_CART: Cart = {
  id: "fixture-empty-cart",
  session_id: null,
  customer_id: null,
  items: [],
  totals: { subtotal: 0, formatted_subtotal: "S/ 0.00", currency: "PEN" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localizedString(value: unknown, locale = "es"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, string>;
    return record[locale] ?? record.es ?? Object.values(record)[0] ?? "";
  }
  return String(value);
}

function resolveImage(item: FixtureCatalogItem): string {
  const imageUrl = item.image_url as Record<string, string> | undefined;
  if (imageUrl?.medium ?? imageUrl?.large) return imageUrl.medium ?? imageUrl.large ?? "";
  const images = item.images as string[] | undefined;
  if (Array.isArray(images) && images[0]) return images[0];
  const image = item.image as string | null | undefined;
  return image ?? "";
}

function catalogItemToSummary(item: FixtureCatalogItem, currency: string): StorefrontProductSummary {
  const variant = Array.isArray(item.variants) ? (item.variants[0] as Record<string, unknown>) : null;
  const price = Number(item.price ?? variant?.price ?? 0);
  return {
    id: Number(item.id),
    slug: String(item.slug),
    name: localizedString(item.name),
    price,
    price_formatted: null,
    image_url: resolveImage(item),
    brand_name: localizedString((item.brand as Record<string, unknown>)?.name),
    category_name: localizedString((item.category as Record<string, unknown>)?.name) || null,
    badge: (item.badge as string | null) ?? null,
    rating: 0,
    currency,
    default_variant_id: Number(item.default_variant_id ?? variant?.id ?? item.id),
  };
}

function brandSlugFromCatalog(item: FixtureCatalogItem): string {
  const brand = item.brand as Record<string, unknown> | undefined;
  return String(brand?.slug ?? "");
}

function categorySlugFromCatalog(item: FixtureCatalogItem): string {
  const category = item.category as Record<string, unknown> | undefined;
  return String(category?.slug ?? "");
}

function variantStock(variant: Record<string, unknown> | null | undefined, item: FixtureCatalogItem): number {
  if (variant && variant.stock != null) return Number(variant.stock);
  if (item.stock != null) return Number(item.stock);
  return 999;
}

function itemHasStock(item: FixtureCatalogItem): boolean {
  const variants = Array.isArray(item.variants) ? item.variants : [];
  if (variants.length > 0) {
    return variants.some((v) => variantStock(v as Record<string, unknown>, item) > 0);
  }
  return variantStock(null, item) > 0;
}

function findCatalogVariant(
  catalog: FixtureCatalogItem[],
  variantId: number,
): { item: FixtureCatalogItem; variant: Record<string, unknown> } | null {
  for (const item of catalog) {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    for (const raw of variants) {
      const variant = raw as Record<string, unknown>;
      if (Number(variant.id) === variantId) return { item, variant };
    }
    if (Number(item.default_variant_id) === variantId && variants[0]) {
      return { item, variant: variants[0] as Record<string, unknown> };
    }
  }
  return null;
}

function findCategoryNode(slug: string, nodes: CategoryNavNode[]): CategoryNavNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategoryNode(slug, node.children ?? []);
    if (child) return child;
  }
  return null;
}

function resolveSort(sort?: string): string {
  return sort && SORT_OPTIONS.some((o) => o.value === sort) ? sort : "newest";
}

function sortItems(items: StorefrontProductSummary[], sort: string): StorefrontProductSummary[] {
  const copy = [...items];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price_desc":
      return copy.sort((a, b) => b.price - a.price);
    case "name_asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
    case "newest":
    default:
      return copy.sort((a, b) => b.id - a.id);
  }
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, totalPages };
}

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function recalcTotals(cart: Cart, locale: string): Cart {
  const subtotal = cart.items.reduce(
    (sum, line) => sum + (line.metadata?.unit_price ?? 0) * line.quantity,
    0,
  );
  const currency = cart.totals.currency || "PEN";
  return {
    ...cart,
    totals: {
      subtotal,
      formatted_subtotal: formatMoney(subtotal, currency, locale),
      currency,
    },
  };
}

function sessionKey(sessionId?: string | null): string {
  return sessionId?.trim() || "__fixture_default__";
}

function cloneCart(cart: Cart): Cart {
  return structuredClone(cart);
}

function buildLineMetadata(
  item: FixtureCatalogItem,
  variant: Record<string, unknown>,
  currency: string,
  locale: string,
): NonNullable<CartItem["metadata"]> {
  const unitPrice = Number(variant.price ?? item.price ?? 0);
  return {
    name: localizedString(item.name),
    slug: String(item.slug),
    brand: localizedString((item.brand as Record<string, unknown>)?.name) || null,
    image: resolveImage(item) || null,
    unit_price: unitPrice,
    unit_price_string: formatMoney(unitPrice, currency, locale),
  };
}

// ---------------------------------------------------------------------------
// In-memory cart (fixtures mode — per-process, demo/dev)
// ---------------------------------------------------------------------------

function createCartStore(template: Cart | null, locale: string, currency: string) {
  const seed = cloneCart(template ?? EMPTY_CART);
  seed.totals.currency = seed.totals.currency || currency;
  const carts = new Map<string, Cart>();
  let nextItemId = Math.max(1, ...(seed.items.map((i) => i.id)), 100);
  let sessionCounter = 0;

  function ensureCart(sessionId?: string | null): Cart {
    const key = sessionKey(sessionId);
    if (!carts.has(key)) {
      const initial = cloneCart(seed);
      if (sessionId) {
        initial.session_id = sessionId;
      } else if (!initial.session_id) {
        initial.session_id = `fixture-session-${++sessionCounter}`;
      }
      carts.set(key, recalcTotals(initial, locale));
    }
    return carts.get(key)!;
  }

  function persist(sessionId: string | null | undefined, cart: Cart): Cart {
    const key = sessionKey(sessionId ?? cart.session_id);
    carts.set(key, recalcTotals(cart, locale));
    return cloneCart(carts.get(key)!);
  }

  return {
    getCart(sessionId?: string | null) {
      return cloneCart(ensureCart(sessionId));
    },

    _addToCart(
      catalog: FixtureCatalogItem[],
      sessionId: string | null | undefined,
      variantId: number,
      quantity: number,
    ): Cart {
      const match = findCatalogVariant(catalog, variantId);
      if (!match) throw new FixtureGuestOrderError("VARIANT_NOT_FOUND", `Variant ${variantId} not found`);

      const stock = variantStock(match.variant, match.item);
      if (stock < quantity) throw new FixtureGuestOrderError("OUT_OF_STOCK", "Insufficient stock");

      const cart = ensureCart(sessionId);
      if (!cart.session_id) cart.session_id = sessionId ?? `fixture-session-${++sessionCounter}`;

      const existing = cart.items.find((line) => line.product_variant_id === variantId);
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (stock < newQty) throw new FixtureGuestOrderError("OUT_OF_STOCK", "Insufficient stock");
        existing.quantity = newQty;
      } else {
        cart.items.push({
          id: nextItemId++,
          product_variant_id: variantId,
          quantity,
          metadata: buildLineMetadata(match.item, match.variant, currency, locale),
        });
      }
      return persist(sessionId, cart);
    },

    _updateCartItem(
      catalog: FixtureCatalogItem[],
      sessionId: string | null | undefined,
      variantId: number,
      quantity: number,
    ): Cart {
      const cart = ensureCart(sessionId);
      const line = cart.items.find((item) => item.product_variant_id === variantId);
      if (!line) throw new FixtureGuestOrderError("VARIANT_NOT_FOUND", `Variant ${variantId} not in cart`);

      if (quantity <= 0) {
        cart.items = cart.items.filter((item) => item.product_variant_id !== variantId);
        return persist(sessionId, cart);
      }

      const match = findCatalogVariant(catalog, variantId);
      const stock = match ? variantStock(match.variant, match.item) : 999;
      if (stock < quantity) throw new FixtureGuestOrderError("OUT_OF_STOCK", "Insufficient stock");

      line.quantity = quantity;
      return persist(sessionId, cart);
    },

    _removeCartItem(sessionId: string | null | undefined, variantId: number): Cart {
      const cart = ensureCart(sessionId);
      cart.items = cart.items.filter((item) => item.product_variant_id !== variantId);
      return persist(sessionId, cart);
    },

    _clearCart(sessionId: string | null | undefined): void {
      const key = sessionKey(sessionId);
      const empty = cloneCart(EMPTY_CART);
      empty.session_id = sessionId ?? null;
      empty.totals.currency = currency;
      carts.set(key, recalcTotals(empty, locale));
    },
  };
}

// ---------------------------------------------------------------------------
// Listing builders
// ---------------------------------------------------------------------------

function filterCatalogItems(
  catalog: FixtureCatalogItem[],
  filters: ProductListingFilters = {},
): FixtureCatalogItem[] {
  return catalog.filter((item) => {
    if (filters.brand && brandSlugFromCatalog(item) !== filters.brand) return false;
    if (filters.category && categorySlugFromCatalog(item) !== filters.category) return false;
    const price = Number(item.price ?? (item.variants as Record<string, unknown>[] | undefined)?.[0]?.price ?? 0);
    if (filters.price_min != null && price < filters.price_min) return false;
    if (filters.price_max != null && price > filters.price_max) return false;
    if (filters.in_stock && !itemHasStock(item)) return false;
    return true;
  });
}

function buildFacets(catalog: FixtureCatalogItem[]) {
  const brandCounts = new Map<string, { label: string; count: number }>();
  const categoryCounts = new Map<string, { label: string; count: number }>();

  for (const item of catalog) {
    const brandSlug = brandSlugFromCatalog(item);
    const brandLabel = localizedString((item.brand as Record<string, unknown>)?.name);
    if (brandSlug) {
      const current = brandCounts.get(brandSlug);
      brandCounts.set(brandSlug, { label: brandLabel, count: (current?.count ?? 0) + 1 });
    }
    const catSlug = categorySlugFromCatalog(item);
    const catLabel = localizedString((item.category as Record<string, unknown>)?.name);
    if (catSlug) {
      const current = categoryCounts.get(catSlug);
      categoryCounts.set(catSlug, { label: catLabel, count: (current?.count ?? 0) + 1 });
    }
  }

  return {
    brand_facets: [...brandCounts.entries()].map(([value, { label, count }]) => ({
      value,
      label,
      count,
    })),
    category_facets: [...categoryCounts.entries()].map(([value, { label, count }]) => ({
      value,
      label,
      count,
    })),
  };
}

function buildProductListing(
  input: FixtureBundleInput,
  params: FixtureProductListingParams = {},
): StorefrontProductListingResponse {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(12, params.page_size ?? 24));
  const sort = resolveSort(params.sort);
  const currency = params.currency ?? "PEN";

  const filtered = filterCatalogItems(input.catalog, params.filters ?? {});
  let items = filtered.map((item) => catalogItemToSummary(item, currency));
  items = sortItems(items, sort);
  const paged = paginate(items, page, pageSize);
  const facets = buildFacets(input.catalog);

  return {
    items: paged.items,
    pagination: {
      page,
      page_size: pageSize,
      total: paged.total,
      total_pages: paged.totalPages,
    },
    sort_current: sort,
    sort_options: [...SORT_OPTIONS],
    ...facets,
  };
}

function buildSearchResults(
  input: FixtureBundleInput,
  params: FixtureSearchParams,
): StorefrontSearchResponse {
  const q = params.q.trim().toLowerCase();
  const limit = Math.min(60, Math.max(1, params.limit ?? 24));
  const currency = params.currency ?? "PEN";

  if (!q) return { query: params.q, hits: [], total: 0 };

  const hits = input.catalog
    .filter((item) => {
      const name = localizedString(item.name).toLowerCase();
      const slug = String(item.slug).toLowerCase();
      const brand = localizedString((item.brand as Record<string, unknown>)?.name).toLowerCase();
      return name.includes(q) || slug.includes(q) || brand.includes(q);
    })
    .slice(0, limit)
    .map((item) => catalogItemToSummary(item, currency));

  return { query: params.q, hits, total: hits.length };
}

function buildCategoryListing(
  input: FixtureBundleInput,
  slug: string,
  params: FixtureListingParams = {},
): StorefrontCategoryListingResponse {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(12, params.pageSize ?? 24));
  const sort = resolveSort(params.sort);
  const currency = params.currency ?? "PEN";

  const catalogBySlug = new Map(input.catalog.map((item) => [String(item.slug), item]));
  const treeNode = findCategoryNode(slug, input.categoryNavTree.nodes);
  const category = {
    id: treeNode?.id ?? 0,
    name: treeNode?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    slug,
    image_url: treeNode?.image_url ?? null,
  };

  const productSlugs =
    input.categoryProductMap?.[slug] ?? input.catalog.map((item) => String(item.slug));

  let items = productSlugs
    .map((productSlug) => catalogBySlug.get(productSlug))
    .filter((item): item is FixtureCatalogItem => !!item)
    .map((item) => catalogItemToSummary(item, currency));

  if (params.brand) {
    items = items.filter((item) => {
      const raw = catalogBySlug.get(item.slug);
      return raw ? brandSlugFromCatalog(raw) === params.brand : false;
    });
  }

  items = sortItems(items, sort);

  const brandCounts = new Map<string, { label: string; count: number }>();
  for (const productSlug of productSlugs) {
    const raw = catalogBySlug.get(productSlug);
    if (!raw) continue;
    const brandSlug = brandSlugFromCatalog(raw);
    const brandLabel = localizedString((raw.brand as Record<string, unknown>)?.name);
    if (!brandSlug) continue;
    const current = brandCounts.get(brandSlug);
    brandCounts.set(brandSlug, { label: brandLabel, count: (current?.count ?? 0) + 1 });
  }

  const paged = paginate(items, page, pageSize);

  return {
    category,
    items: paged.items,
    pagination: {
      page,
      page_size: pageSize,
      total: paged.total,
      total_pages: paged.totalPages,
    },
    sort_current: sort,
    sort_options: [...SORT_OPTIONS],
    brand_facets: [...brandCounts.entries()].map(([value, { label, count }]) => ({
      value,
      label,
      count,
    })),
  };
}

function buildBrandListing(
  input: FixtureBundleInput,
  slug: string,
  params: FixtureBrandListingParams = {},
): StorefrontBrandListingResponse {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(12, params.pageSize ?? 24));
  const sort = resolveSort(params.sort);
  const currency = params.currency ?? "PEN";

  const brandProducts = input.catalog.filter((item) => brandSlugFromCatalog(item) === slug);
  const brandName =
    brandProducts.length > 0
      ? localizedString((brandProducts[0].brand as Record<string, unknown>)?.name)
      : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let items = brandProducts.map((item) => catalogItemToSummary(item, currency));
  items = sortItems(items, sort);
  const paged = paginate(items, page, pageSize);

  return {
    brand: { id: 0, name: brandName, slug, logo_url: null },
    items: paged.items,
    pagination: {
      page,
      page_size: pageSize,
      total: paged.total,
      total_pages: paged.totalPages,
    },
    sort_current: sort,
    sort_options: [...SORT_OPTIONS],
    category_facets: [],
  };
}

// ---------------------------------------------------------------------------
// createFixtureBundle
// ---------------------------------------------------------------------------

export function createFixtureBundle(input: FixtureBundleInput): FixtureBundle {
  const locale = "es";
  const currency = input.cart?.totals.currency ?? "PEN";
  const cartStore = createCartStore(input.cart ?? null, locale, currency);

  const bundle: FixtureBundle = {
    ...input,
    cart: input.cart ?? null,
    categoryProductMap: input.categoryProductMap ?? {},
    customerAddresses: input.customerAddresses ?? [],

    getCart(sessionId) {
      return cartStore.getCart(sessionId);
    },

    addToCart(sessionId, variantId, quantity) {
      return cartStore._addToCart(input.catalog, sessionId, variantId, quantity);
    },

    updateCartItem(sessionId, variantId, quantity) {
      return cartStore._updateCartItem(input.catalog, sessionId, variantId, quantity);
    },

    removeCartItem(sessionId, variantId) {
      return cartStore._removeCartItem(sessionId, variantId);
    },

    getCategoryNavTree() {
      return input.categoryNavTree;
    },

    getCategoryProducts(slug, params) {
      return buildCategoryListing(bundle, slug, params);
    },

    getBrandProducts(slug, params) {
      return buildBrandListing(bundle, slug, params);
    },

    getProductListing(params) {
      return buildProductListing(bundle, params);
    },

    searchProducts(params) {
      return buildSearchResults(bundle, params);
    },

    getCustomerAddresses() {
      return input.customerAddresses ?? [];
    },

    processGuestCheckout(sessionId, _payload) {
      const cart = cartStore.getCart(sessionId);
      if (!cart.items.length) {
        throw new FixtureGuestOrderError("CART_NOT_FOUND", "Cart is empty");
      }
      for (const line of cart.items) {
        const match = findCatalogVariant(input.catalog, line.product_variant_id);
        if (!match) {
          throw new FixtureGuestOrderError("VARIANT_NOT_FOUND", "Cart item no longer available");
        }
        if (variantStock(match.variant, match.item) < line.quantity) {
          throw new FixtureGuestOrderError("OUT_OF_STOCK", "Some items are out of stock");
        }
      }
      cartStore._clearCart(sessionId);
      return { orderId: `fixture-order-${Date.now()}` };
    },
  };

  return bundle;
}

// ---------------------------------------------------------------------------
// validateFixtureBundle
// ---------------------------------------------------------------------------

export function validateFixtureBundle(
  input: FixtureBundleInput,
  options: ValidateFixtureBundleOptions = {},
): string[] {
  const errors: string[] = [];
  const catalogBySlug = new Map(input.catalog.map((item) => [String(item.slug), item]));
  const variantIds = new Set<number>();

  for (const item of input.catalog) {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    for (const v of variants) {
      variantIds.add(Number((v as Record<string, unknown>).id));
    }
    if (item.default_variant_id != null) {
      variantIds.add(Number(item.default_variant_id));
    }
  }

  for (const slug of options.compositionProductSlugs ?? []) {
    if (!catalogBySlug.has(slug)) {
      errors.push(`Composition references product slug "${slug}" not found in catalog fixture`);
    }
  }

  if (input.cart?.items) {
    for (const line of input.cart.items) {
      if (!variantIds.has(line.product_variant_id)) {
        errors.push(
          `Cart item variant_id ${line.product_variant_id} not found in catalog variants`,
        );
      }
    }
  }

  for (const [categorySlug, productSlugs] of Object.entries(input.categoryProductMap ?? {})) {
    for (const productSlug of productSlugs) {
      if (!catalogBySlug.has(productSlug)) {
        errors.push(
          `categoryProductMap["${categorySlug}"] references unknown product slug "${productSlug}"`,
        );
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// createStorefrontDataSource
// ---------------------------------------------------------------------------

export function createStorefrontDataSource(config: StorefrontDataSourceConfig): StorefrontDataSource {
  const { mode, fixtures, apiConfig, website } = config;

  async function live<T>(fn: (m: typeof import("./index.js")) => Promise<T>): Promise<T> {
    const mod = await import("./index.js");
    return fn(mod);
  }

  return {
    async getCart(params = {}) {
      if (mode === "fixtures") return fixtures.getCart(params.sessionId);
      return live((m) => m.fetchCart(apiConfig, website as ProximaWebsiteResponse, params));
    },

    async addToCart(params) {
      if (mode === "fixtures") {
        try {
          return fixtures.addToCart(params.sessionId, params.variantId, params.quantity ?? 1);
        } catch (err) {
          if (err instanceof FixtureGuestOrderError) throw err;
          throw err;
        }
      }
      return live((m) =>
        m.addToCart(apiConfig, website as ProximaWebsiteResponse, {
          token: params.token,
          sessionId: params.sessionId,
          variantId: params.variantId,
          quantity: params.quantity ?? 1,
        }),
      );
    },

    async updateCartItem(params) {
      if (mode === "fixtures") return fixtures.updateCartItem(params.sessionId, params.variantId, params.quantity ?? 0);
      return live((m) =>
        m.updateCartItem(apiConfig, website as ProximaWebsiteResponse, {
          token: params.token,
          sessionId: params.sessionId,
          variantId: params.variantId,
          quantity: params.quantity ?? 0,
        }),
      );
    },

    async removeCartItem(params) {
      if (mode === "fixtures") return fixtures.removeCartItem(params.sessionId, params.variantId);
      return live((m) =>
        m.removeCartItem(apiConfig, website as ProximaWebsiteResponse, {
          token: params.token,
          sessionId: params.sessionId,
          variantId: params.variantId,
        }),
      );
    },

    async getCategoryNavTree(params = {}) {
      if (mode === "fixtures") return fixtures.getCategoryNavTree();
      return live((m) => m.fetchCategoryNavTree(apiConfig, website as ProximaWebsiteResponse, params));
    },

    async getCategoryProducts(slug, params = {}) {
      if (mode === "fixtures") {
        return fixtures.getCategoryProducts(slug, {
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          brand: params.brand,
          currency: website.currency,
          locale: website.locale,
        });
      }
      return live((m) =>
        m.fetchCategoryProducts(apiConfig, website as ProximaWebsiteResponse, {
          slug,
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          brand: params.brand,
          q: params.q,
        }),
      );
    },

    async getBrandProducts(slug, params = {}) {
      if (mode === "fixtures") {
        return fixtures.getBrandProducts(slug, {
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          category: params.category,
          currency: website.currency,
          locale: website.locale,
        });
      }
      return live((m) =>
        m.fetchBrandProducts(apiConfig, website as ProximaWebsiteResponse, {
          slug,
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          category: params.category,
          q: params.q,
        }),
      );
    },

    async getProductListing(params = {}) {
      if (mode === "fixtures") {
        return fixtures.getProductListing({
          ...params,
          currency: website.currency,
          locale: website.locale,
        });
      }
      return live((m) =>
        m.fetchProductListing(apiConfig, website, {
          filters: params.filters,
          sort: params.sort as ProductListingSortOption | undefined,
          page: params.page,
          page_size: params.page_size,
        }),
      );
    },

    async searchProducts(params) {
      if (mode === "fixtures") {
        return fixtures.searchProducts({
          ...params,
          currency: website.currency,
          locale: website.locale,
        });
      }
      return live((m) =>
        m.searchStorefront(apiConfig, website, {
          q: params.q,
          limit: params.limit,
          locale: website.locale,
          currency: website.currency,
        }),
      );
    },

    async getCustomerAddresses(params = {}) {
      if (mode === "fixtures") return fixtures.getCustomerAddresses();
      if (!params.token) return [];
      return live((m) =>
        m.fetchCustomerAddresses(apiConfig, website as ProximaWebsiteResponse, { token: params.token! }),
      );
    },

    async getBuyerProfile(params) {
      if (mode === "fixtures") {
        throw new Error("Buyer profile requires live API");
      }
      return live((m) =>
        m.fetchBuyerProfile(apiConfig, website as ProximaWebsiteResponse, { token: params.token }),
      );
    },

    async getOrders(params) {
      if (mode === "fixtures") {
        return { items: [], total: 0, page: params.page ?? 1, size: params.size ?? 20 };
      }
      return live((m) =>
        m.fetchOrders(apiConfig, website as ProximaWebsiteResponse, {
          token: params.token,
          page: params.page,
          size: params.size,
        }),
      );
    },

    async getOrder(params) {
      if (mode === "fixtures") {
        throw Object.assign(new Error("Order not found"), { status: 404 });
      }
      return live((m) =>
        m.fetchOrder(apiConfig, website as ProximaWebsiteResponse, {
          token: params.token,
          orderId: params.orderId,
        }),
      );
    },

    async searchUbigeo(params) {
      if (mode === "fixtures") return [];
      return live((m) => m.searchUbigeo(apiConfig, { q: params.q }));
    },

    async processGuestCheckout(payload) {
      if (mode === "fixtures") {
        try {
          return fixtures.processGuestCheckout(payload.session_id, payload);
        } catch (err) {
          if (err instanceof FixtureGuestOrderError) throw err;
          throw err;
        }
      }
      return live((m) => {
        const websiteFull = website as ProximaWebsiteResponse;
        return m.initiateGuestOrder(apiConfig, websiteFull, payload).then((result) => ({
          orderId: result.orderId,
        }));
      });
    },
  };
}

/**
 * Resolve mode + website then return a StorefrontDataSource.
 * Apps inject env-specific callbacks; all commerce/live vs fixtures routing stays in SDK.
 */
export async function resolveStorefrontDataSourceForRequest(
  options: ResolveStorefrontDataSourceOptions,
): Promise<StorefrontDataSource> {
  const host = options.getRequestHost(options.request);
  const mode = options.resolveMode(host);

  if (mode === "fixtures") {
    return createStorefrontDataSource({
      mode,
      fixtures: options.fixtures,
      apiConfig: { baseUrl: options.apiConfig.baseUrl },
      website: options.getFixtureWebsite(),
    });
  }

  const website = await options.fetchLiveWebsite();
  return createStorefrontDataSource({
    mode,
    fixtures: options.fixtures,
    apiConfig: { baseUrl: options.apiConfig.baseUrl },
    website,
  });
}
