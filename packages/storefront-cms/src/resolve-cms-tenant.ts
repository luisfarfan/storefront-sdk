import { isCmsPreview } from './cms-preview';

export type CmsTenantIds = {
  websiteId: string;
  businessId: string;
};

/**
 * Resolves website + business for CMS composition and storefront headers.
 * In CMS preview (`cms_preview=1`), optional query params override env defaults:
 * - `builder_website_id` or `website_id`
 * - `builder_business_id` or `business_id`
 */
export function resolveCmsTenantFromUrl(
  url: URL,
  fallback: CmsTenantIds,
): CmsTenantIds {
  if (!isCmsPreview(url)) {
    return fallback;
  }
  const w =
    url.searchParams.get('builder_website_id') ||
    url.searchParams.get('website_id');
  const b =
    url.searchParams.get('builder_business_id') ||
    url.searchParams.get('business_id');
  return {
    websiteId: (w && w.trim()) || fallback.websiteId,
    businessId: (b && b.trim()) || fallback.businessId,
  };
}
