import { apiError, authHeaders } from '../internal/http.js';
import type { ProximaApiConfig, ProximaWebsiteResponse } from '../types/cms.js';
import {
  MissingFieldsError,
  type BuyerProfile,
  type BuyerProfileUpdateParams,
  type BuyerRegisterParams,
  type BuyerSession,
  type MissingField,
  type RegistrationForm,
} from '../types/buyer.js';

/**
 * Fetch the merchant-configured registration form schema.
 * Call this server-side in your /register page to know which fields to render
 * and which are required. `email` and `password` are always prepended by the API.
 *
 * @example
 * // src/pages/register.astro
 * const form = await fetchRegistrationForm({ baseUrl: env.apiUrl }, website);
 * // Pass `form` as a prop to a client component that renders the dynamic form
 */
export async function fetchRegistrationForm(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">
): Promise<RegistrationForm> {
  const url = new URL("/api/v1/store/auth/registration-form", config.baseUrl);
  const res = await fetch(url, {
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) {
    throw apiError(res.status, await res.json().catch(() => ({})));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Buyer Auth — client-side functions
// ---------------------------------------------------------------------------

/**
 * Register a new customer. The merchant decides which fields are required —
 * call fetchRegistrationForm() first to know what to collect.
 *
 * Throws MissingFieldsError when the merchant marked fields as required but
 * they were omitted, so you can mark exactly which inputs are invalid.
 *
 * @example
 * try {
 *   const session = await registerBuyer(config, website, { email, password, fullName });
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     e.missingFields.forEach(({ field }) => markError(field));
 *   }
 * }
 */
export async function registerBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: BuyerRegisterParams
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/register", config.baseUrl);
  const body: Record<string, any> = {
    email: params.email,
    password: params.password,
  };
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.registrationSource !== undefined)  body.registration_source = params.registrationSource;
  if (params.metadata !== undefined)            body.metadata = params.metadata;
  if (params.address !== undefined)             body.address = params.address;
  if (params.captchaToken)                      body.captcha_token = params.captchaToken;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Parse MISSING_REQUIRED_FIELDS into structured MissingFieldsError
    if (res.status === 422 && typeof data.detail === "string" && data.detail.startsWith("MISSING_REQUIRED_FIELDS:")) {
      try {
        const raw = data.detail.replace("MISSING_REQUIRED_FIELDS:", "").trim();
        // API returns Python repr: [{'field': 'phone', 'msg': 'FIELD_REQUIRED'}, ...]
        // Safe to JSON.parse after normalizing Python single-quotes
        const normalized = raw.replace(/'/g, '"');
        const missingFields: MissingField[] = JSON.parse(normalized);
        throw new MissingFieldsError(missingFields);
      } catch (e) {
        if (e instanceof MissingFieldsError) throw e;
        // If parsing failed, fall through to generic error
      }
    }
    throw apiError(res.status, data);
  }
  return res.json();
}

/**
 * Authenticate a customer with email and password.
 * Returns a BuyerSession with access_token and refresh_token.
 * Throws { status: 401 } on wrong credentials.
 */
export async function loginBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; password: string; captchaToken?: string | null }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/login", config.baseUrl);
  const body: Record<string, any> = { email: params.email, password: params.password };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Invalidate the current session server-side. Best-effort — always clear the cookie too. */
export async function logoutBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/logout", config.baseUrl);
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.token}`,
      "X-Business-ID": website.business_id,
    },
  });
}

/**
 * Exchange a refresh token for a new access token.
 * Call this when you get a 401 on any authenticated request.
 * Throws { status: 401 } if the refresh token is expired or revoked.
 *
 * @example
 * // In Astro middleware:
 * try {
 *   const session = await refreshBuyerToken(config, website, { refreshToken });
 *   // Set new access_token cookie
 * } catch {
 *   // Clear both cookies, redirect to login
 * }
 */
export async function refreshBuyerToken(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { refreshToken: string }
): Promise<BuyerSession> {
  const url = new URL("/api/v1/store/auth/refresh", config.baseUrl);
  url.searchParams.set("refresh_token", params.refreshToken);
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Business-ID": website.business_id },
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/** Fetch the authenticated customer's full profile. */
export async function fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me", config.baseUrl);
  const res = await fetch(url, {
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

/**
 * Update the authenticated customer's profile. Only the fields you include
 * in `params` are changed — it's a partial update.
 */
export async function updateBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string } & BuyerProfileUpdateParams
): Promise<BuyerProfile> {
  const url = new URL("/api/v1/store/me/profile", config.baseUrl);
  const body: Record<string, any> = {};
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.avatarUrl !== undefined)           body.avatar_url = params.avatarUrl;
  if (params.password !== undefined)            body.password = params.password;

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(website.business_id, params.token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---------------------------------------------------------------------------
// Password recovery & email verification
// ---------------------------------------------------------------------------

/**
 * Send a password reset email. Always resolves — even if the email doesn't exist.
 * Always show: "Si el email existe, recibirás un enlace para restablecer tu contraseña."
 */
export async function forgotPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; captchaToken?: string | null }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/forgot-password", config.baseUrl);
  const body: Record<string, any> = { email: params.email };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Business-ID": website.business_id },
    body: JSON.stringify(body),
  });
}

/**
 * Reset the customer's password using the token from the reset email link.
 * The token is the `?token=` query param in the reset URL.
 * On success, all active sessions are revoked — redirect to login.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function resetPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string; newPassword: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/reset-password", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token, new_password: params.newPassword }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Verify the customer's email using the token from the verification email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function verifyEmail(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/verify-email", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token }),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}

/**
 * Re-send the email verification link. Requires the customer to be authenticated.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED } if already verified.
 */
export async function resendVerification(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const url = new URL("/api/v1/store/auth/resend-verification", config.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(website.business_id, params.token),
  });
  if (!res.ok) throw apiError(res.status, await res.json().catch(() => ({})));
}