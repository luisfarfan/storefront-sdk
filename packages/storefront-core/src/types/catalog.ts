/** Campaign / Promotion driving this product's price (or matching the
 *  product by targeting rules when direct-sale ties campaign on price).
 *  Sections rendering this product can pull badge / theme / countdown
 *  from here instead of pinning to a campaign by slug. */
export interface StorefrontAppliedCampaign {
  id: number;
  slug?: string | null;
  name?: Record<string, string> | null;
  badge_text?: string | null;
  theme_color?: string | null;
  active_until?: string | null;
  hero_copy?: Record<string, string> | null;
}

/** Lightweight product representation used in listings, search results, and smart collections. */
export interface StorefrontProductSummary {
  id: number;
  name: string;
  slug: string;
  price: number;
  price_formatted?: string | null;
  image_url: string;
  brand_name?: string | null;
  category_name?: string | null;
  /** Promotional badge text, e.g. "OFERTA", "NUEVO" */
  badge?: string | null;
  rating: number;
  currency?: string | null;
  /** First variant id — use this when calling addToCart from a listing card */
  default_variant_id?: number | null;
  /** Campaign whose branding (badge, theme, countdown) should be shown
   *  alongside this product. Populated automatically when an active
   *  Promotion targets the product. */
  applied_promotion?: StorefrontAppliedCampaign | null;
}

/** Pagination metadata returned by listing endpoints. */
export interface StorefrontPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface StorefrontSortOption {
  value: string;
  label: string;
}

export interface StorefrontFacetOption {
  value: string;
  label: string;
  count: number;
}

/** Response from GET /storefront/search */
export interface StorefrontSearchResponse {
  query: string;
  hits: StorefrontProductSummary[];
  total: number;
}

/** Response from GET /storefront/products (all-products listing with facets) */
export interface StorefrontProductListingResponse {
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategorySummary {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
}

export interface StorefrontBrandSummary {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

/** Response from GET /storefront/categories/{slug}/products */
export interface StorefrontCategoryListingResponse {
  category: StorefrontCategorySummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  brand_facets: StorefrontFacetOption[];
}

/** Response from GET /storefront/brands/{slug}/products */
export interface StorefrontBrandListingResponse {
  brand: StorefrontBrandSummary;
  items: StorefrontProductSummary[];
  pagination: StorefrontPagination;
  sort_current: string;
  sort_options: StorefrontSortOption[];
  category_facets: StorefrontFacetOption[];
}

export interface StorefrontCategoryDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  image_url?: string | null;
  description?: string | null;
  product_count: number;
}

export interface StorefrontBrandDirectoryItem {
  id: number;
  name: string;
  slug: string;
  href: string;
  logo_url?: string | null;
  product_count: number;
}

export interface StorefrontCategoryDirectoryResponse {
  items: StorefrontCategoryDirectoryItem[];
  total: number;
}

export interface StorefrontBrandDirectoryResponse {
  items: StorefrontBrandDirectoryItem[];
  total: number;
}

/** Shared params for product listing endpoints — sort, pagination, filters. */
export interface StorefrontListingParams {
  /** Page number, starting at 1 */
  page?: number;
  /** Items per page (1–60). Default: 24 */
  pageSize?: number;
  /** "newest" | "price_asc" | "price_desc" | "popular". Default: "newest" */
  sort?: string;
  /** Locale for translated names, e.g. "es", "en" */
  locale?: string;
  /** ISO currency code, e.g. "PEN", "USD" */
  currency?: string;
}

/** Coupon validation result from GET /commerce/coupons/validate */
export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  /** Amount to deduct from the order total */
  discount_amount?: number;
  /** "percentage" | "fixed" */
  discount_type?: string;
  discount_value?: number;
  /** Error message when valid=false */
  error?: string;
}

/**
 * A single node in the category navigation tree.
 * `children` contains nodes at the next depth level (up to `max_depth`).
 */
export interface CategoryNavNode {
  id: number;
  slug: string;
  name: string;
  /** Storefront href — always `/categoria/{slug}` */
  href: string;
  image_url?: string | null;
  product_count: number;
  children: CategoryNavNode[];
}

export interface CategoryNavTreeResponse {
  nodes: CategoryNavNode[];
  total: number;
}