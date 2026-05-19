export type DeliveryMode = "managed_template" | "external_headless" | "custom_managed";

export type WebsiteKind = "landing" | "catalog" | "ecommerce";

export type ResolverKind =
  | "content_page"
  | "product_list"
  | "product_detail"
  | "cart"
  | "checkout"
  | "buyer_login"
  | "buyer_account";

export interface WebsiteCapabilities {
  cms_pages: boolean;
  catalog?: boolean;
  cart?: boolean;
  checkout?: boolean;
  buyer_auth?: boolean;
  orders?: boolean;
  payments?: string[];
}

export interface ThemeTokens {
  surface?: string;
  surfaceMuted?: string;
  ink?: string;
  muted?: string;
  primary?: string;
  accent?: string;
  border?: string;
  fontBody?: string;
  fontDisplay?: string;
  radius?: string;
  density?: "compact" | "comfortable" | "editorial";
  [key: string]: string | undefined;
}

export interface AnimationConfig {
  motion?: "quiet" | "balanced" | "expressive";
  reveal?: "fade-up" | "clip" | "none";
  stagger?: number;
  [key: string]: unknown;
}
