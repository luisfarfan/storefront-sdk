import { fetchProximaWebsite } from '../cms/website.js';
import {
  forgotPassword,
  loginBuyer,
  logoutBuyer,
  refreshBuyerToken,
  registerBuyer,
  resetPassword,
  verifyEmail,
} from '../buyer/auth.js';
import { addToCart, fetchCart, removeCartItem, updateCartItem } from '../cart/cart.js';
import { createOrder } from '../orders/orders.js';
import { initiateGuestOrder } from '../orders/guest.js';
import { deleteCustomerAddress, setDefaultAddress } from '../addresses/address-book.js';
import type { BuyerRegisterParams } from '../types/buyer.js';
import type { CheckoutRequest } from '../types/cart.js';
import type { CustomerAddress } from '../types/address.js';
import type { Cart } from '../types/cart.js';
import type { BuyerServerEnv } from '../types/server-env.js';
import type { GuestOrderPayload, GuestOrderResult } from '../types/guest-order.js';

// ---------------------------------------------------------------------------
// Server-side Handler Helpers (for Astro API routes)
//
// These orchestrators combine fetchProximaWebsite + SDK calls so that Astro
// API routes become thin wrappers (~10 lines) that only deal with cookies
// and redirects. Use them in `src/pages/api/buyer/**` files.
// ---------------------------------------------------------------------------

/**
 * Resolve the website then call loginBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 */
export async function processBuyerLogin(
  env: BuyerServerEnv,
  params: { email: string; password: string; next?: string; captchaToken?: string | null }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await loginBuyer({ baseUrl: env.apiUrl }, website, { email: params.email, password: params.password, captchaToken: params.captchaToken });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: params.next || "/" };
}

/**
 * Resolve the website then call registerBuyer.
 * Returns { access_token, refresh_token, next } on success, throws on failure.
 * Propagates MissingFieldsError so the API route can return structured 422 errors.
 */
export async function processBuyerRegister(
  env: BuyerServerEnv,
  params: BuyerRegisterParams & { next?: string }
): Promise<{ access_token: string; refresh_token: string | null; next: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const { next, ...registerParams } = params;
  const session = await registerBuyer({ baseUrl: env.apiUrl }, website, registerParams);
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null, next: next || "/" };
}

/**
 * Call logoutBuyer (best-effort — never throws).
 * Always clear the session cookie regardless of the result.
 */
export async function processBuyerLogout(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await logoutBuyer({ baseUrl: env.apiUrl }, website, { token: params.token });
  } catch {
    // Best-effort — caller must always clear the cookie regardless
  }
}

/**
 * Resolve the website then exchange a refresh token for a new access token.
 * Use this in Astro middleware to silently refresh expired sessions.
 * Throws { status: 401 } if the refresh token is expired — clear cookies and redirect to login.
 */
export async function processRefreshToken(
  env: BuyerServerEnv,
  params: { refreshToken: string }
): Promise<{ access_token: string; refresh_token: string | null }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const session = await refreshBuyerToken({ baseUrl: env.apiUrl }, website, { refreshToken: params.refreshToken });
  return { access_token: session.access_token, refresh_token: session.refresh_token ?? null };
}

/**
 * Resolve the website then send a password reset email.
 * Never throws — always show a generic confirmation message.
 */
export async function processForgotPassword(
  env: BuyerServerEnv,
  params: { email: string; captchaToken?: string | null }
): Promise<void> {
  try {
    const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
    await forgotPassword({ baseUrl: env.apiUrl }, website, { email: params.email, captchaToken: params.captchaToken });
  } catch {
    // Never expose whether the email exists
  }
}

/**
 * Reset the customer's password with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } on bad token.
 */
export async function processResetPassword(
  env: BuyerServerEnv,
  params: { token: string; newPassword: string }
): Promise<void> {
  await resetPassword({ baseUrl: env.apiUrl }, params);
}

/**
 * Verify the customer's email with the token from the email link.
 * Throws { status: 400, data.detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } on bad token.
 */
export async function processVerifyEmail(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void> {
  await verifyEmail({ baseUrl: env.apiUrl }, params);
}

/**
 * Resolve the website then add a variant to the cart.
 * Token is optional (guest cart supported).
 */
export async function processAddToCart(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return addToCart({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId, quantity: params.quantity });
}

/**
 * Resolve the website then remove a variant from the cart.
 * Token is optional (guest cart supported).
 */
export async function processRemoveCartItem(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return removeCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId });
}

/**
 * Resolve the website then update the quantity of a variant in the cart.
 * Token is optional (guest cart supported).
 */
export async function processUpdateCartItem(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null; variantId: number; quantity: number }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return updateCartItem({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId, variantId: params.variantId, quantity: params.quantity });
}

/**
 * Resolve the website then fetch the current cart.
 * Token is optional (guest cart supported).
 */
export async function processGetCart(
  env: BuyerServerEnv,
  params: { token?: string | null; sessionId?: string | null }
): Promise<Cart> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return fetchCart({ baseUrl: env.apiUrl }, website, { token: params.token, sessionId: params.sessionId });
}

/**
 * Resolve the website then call POST /checkout.
 * Returns { orderId } on success, throws on failure.
 */
export async function processBuyerCheckout(
  env: BuyerServerEnv,
  params: { token: string; checkout: CheckoutRequest }
): Promise<{ orderId: string }> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  const order = await createOrder({ baseUrl: env.apiUrl }, website, { token: params.token, checkout: params.checkout });
  return { orderId: order.id };
}

/** Resolve website then set the customer's default address. */
export async function processSetDefaultAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<CustomerAddress> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return setDefaultAddress({ baseUrl: env.apiUrl }, website, params);
}

/** Resolve website then delete a saved address. */
export async function processDeleteAddress(
  env: BuyerServerEnv,
  params: { token: string; addressId: number }
): Promise<void> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return deleteCustomerAddress({ baseUrl: env.apiUrl }, website, params);
}

/**
 * Resolve website then call initiateGuestOrder.
 * Server-side helper for Astro API routes.
 */
export async function processGuestCheckout(
  env: BuyerServerEnv,
  payload: GuestOrderPayload
): Promise<GuestOrderResult> {
  const website = await fetchProximaWebsite({ baseUrl: env.apiUrl, domain: env.domain, serviceKey: env.serviceKey });
  return initiateGuestOrder({ baseUrl: env.apiUrl }, website, payload);
}