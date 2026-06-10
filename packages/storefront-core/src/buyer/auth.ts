import { StorefrontEndpoints, createStorefrontClient } from '../api/index.js';
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

function tenant(config: Pick<ProximaApiConfig, "baseUrl">, website: Pick<ProximaWebsiteResponse, "business_id">) {
  return {
    client: createStorefrontClient(config),
    businessId: website.business_id,
  };
}

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
  const { client, businessId } = tenant(config, website);
  return client.get<RegistrationForm>(StorefrontEndpoints.auth.registrationForm(), { businessId });
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
  const { client, businessId } = tenant(config, website);
  const body: Record<string, unknown> = {
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

  try {
    return await client.post<BuyerSession>(StorefrontEndpoints.auth.register(), body, { businessId });
  } catch (e) {
    const err = e as Error & { status?: number; data?: { detail?: string } };
    if (err.status === 422 && typeof err.data?.detail === "string" && err.data.detail.startsWith("MISSING_REQUIRED_FIELDS:")) {
      try {
        const raw = err.data.detail.replace("MISSING_REQUIRED_FIELDS:", "").trim();
        const normalized = raw.replace(/'/g, '"');
        const missingFields: MissingField[] = JSON.parse(normalized);
        throw new MissingFieldsError(missingFields);
      } catch (parseErr) {
        if (parseErr instanceof MissingFieldsError) throw parseErr;
      }
    }
    throw e;
  }
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
  const { client, businessId } = tenant(config, website);
  const body: Record<string, unknown> = { email: params.email, password: params.password };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  return client.post<BuyerSession>(StorefrontEndpoints.auth.login(), body, { businessId });
}

/** Invalidate the current session server-side. Best-effort — always clear the cookie too. */
export async function logoutBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<void> {
  const { client, businessId } = tenant(config, website);
  await client.post(StorefrontEndpoints.auth.logout(), undefined, {
    businessId,
    token: params.token,
    ignoreErrors: true,
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
  const { client, businessId } = tenant(config, website);
  return client.post<BuyerSession>(StorefrontEndpoints.auth.refresh(), undefined, {
    businessId,
    query: { refresh_token: params.refreshToken },
  });
}

/** Fetch the authenticated customer's full profile. */
export async function fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<BuyerProfile> {
  const { client, businessId } = tenant(config, website);
  return client.get<BuyerProfile>(StorefrontEndpoints.buyer.me(), {
    businessId,
    token: params.token,
  });
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
  const { client, businessId } = tenant(config, website);
  const body: Record<string, unknown> = {};
  if (params.fullName !== undefined)            body.full_name = params.fullName;
  if (params.phone !== undefined)               body.phone = params.phone;
  if (params.docType !== undefined)             body.doc_type = params.docType;
  if (params.docNumber !== undefined)           body.doc_number = params.docNumber;
  if (params.birthDate !== undefined)           body.birth_date = params.birthDate;
  if (params.newsletterSubscribed !== undefined) body.newsletter_subscribed = params.newsletterSubscribed;
  if (params.avatarUrl !== undefined)           body.avatar_url = params.avatarUrl;
  if (params.password !== undefined)            body.password = params.password;

  return client.patch<BuyerProfile>(StorefrontEndpoints.buyer.profile(), body, {
    businessId,
    token: params.token,
  });
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
  const { client, businessId } = tenant(config, website);
  const body: Record<string, unknown> = { email: params.email };
  if (params.captchaToken) body.captcha_token = params.captchaToken;
  await client.post(StorefrontEndpoints.auth.forgotPassword(), body, {
    businessId,
    ignoreErrors: true,
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
  const client = createStorefrontClient(config);
  await client.post(StorefrontEndpoints.auth.resetPassword(), {
    token: params.token,
    new_password: params.newPassword,
  });
}

/**
 * Verify the customer's email using the token from the verification email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function verifyEmail(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void> {
  const client = createStorefrontClient(config);
  await client.post(StorefrontEndpoints.auth.verifyEmail(), { token: params.token });
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
  const { client, businessId } = tenant(config, website);
  await client.post(StorefrontEndpoints.auth.resendVerification(), undefined, {
    businessId,
    token: params.token,
  });
}
