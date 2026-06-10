/**
 * Environment variables needed by server-side `process*` helpers.
 * Typically populated from `import.meta.env` in an Astro API route.
 */
export interface BuyerServerEnv {
  apiUrl: string;
  domain: string;
  serviceKey?: string;
}

/** Recommended options for the buyer session cookie. Apply to both `buyer_token` and `buyer_refresh_token`. */
export const BUYER_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
} as const;

export const BUYER_COOKIE_NAME = "buyer_token";
export const BUYER_REFRESH_COOKIE_NAME = "buyer_refresh_token";