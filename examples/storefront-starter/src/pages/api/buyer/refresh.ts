import type { APIRoute } from 'astro';
import {
  processRefreshToken,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

const env = {
  apiUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_DOMAIN,
};

/**
 * POST /api/buyer/refresh
 *
 * Usado por el middleware para renovar el access token silenciosamente.
 * También puede llamarse desde el cliente si el access token expira.
 */
export const POST: APIRoute = async ({ cookies }) => {
  const refreshToken = cookies.get(BUYER_REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return Response.json({ ok: false, error: 'No refresh token' }, { status: 401 });
  }

  try {
    const { access_token, refresh_token } = await processRefreshToken(env, { refreshToken });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true });
  } catch {
    cookies.delete(BUYER_COOKIE_NAME, { path: '/' });
    cookies.delete(BUYER_REFRESH_COOKIE_NAME, { path: '/' });
    return Response.json({ ok: false, error: 'Session expired' }, { status: 401 });
  }
};
