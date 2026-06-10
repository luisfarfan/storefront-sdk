export interface StorefrontBusinessProfile {
  business_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tagline: string | null;
  currency_code: string;
  timezone: string;
  contact: {
    email: string | null;
    support_email: string | null;
    support_phone: string | null;
    whatsapp: string | null;
    /** Pre-built `https://wa.me/{digits}` link derived from `whatsapp`. */
    whatsapp_url: string | null;
  };
  social: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    youtube: string | null;
    twitter: string | null;
    linkedin: string | null;
  };
  legal: {
    terms_url: string | null;
    privacy_url: string | null;
    /** Peru-specific "Libro de Reclamaciones" URL. */
    complaints_book_url: string | null;
  };
  presence_mode: "physical" | "virtual" | "both";
  primary_location: StorefrontBusinessLocation | null;
  locations: StorefrontBusinessLocation[];
}

export interface StorefrontBusinessLocation {
  id: string | null;
  kind: "store" | "pickup_point" | "showroom";
  label: string;
  is_primary: boolean;
  address_line: string;
  ubigeo_code: string | null;
  reference: string | null;
  phone: string | null;
  hours_text: string | null;
  show_on_website: boolean;
  is_active: boolean;
  sort_order: number;
  warehouse_id: number | null;
  ubigeo: {
    code: string;
    department: string;
    province: string;
    district: string;
    full_name: string;
  } | null;
}

/**
 * Fetch the public business profile for a tenant. Call this once per request
 * and cache the result on `Astro.locals` so the footer (and any other
 * profile-aware component) reads from memory, not over the wire.
 *
 * @example
 * const profile = await fetchBusinessProfile(
 *   { baseUrl: env.apiUrl, serviceKey: env.serviceKey },
 *   website.business_id
 * );
 */

export interface StorefrontCampaign {
  id: number;
  slug: string | null;
  name: Record<string, string>;
  description: Record<string, string> | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  target_type: "product" | "category" | "brand" | "global";
  target_ids: number[];
  active_from: string | null;
  active_until: string | null;
  smart_collection_id: number | null;
  display_config: {
    badge_text?: string | null;
    hero_copy?: Record<string, string> | null;
    theme_color?: string | null;
    show_countdown?: boolean | null;
  } | null;
}

export interface StorefrontPaymentMethod {
  code: string;
  name_es: string;
  description_es: string | null;
  category: string;
  kind: "offline" | "online" | "hybrid";
  icon_url: string | null;
}
