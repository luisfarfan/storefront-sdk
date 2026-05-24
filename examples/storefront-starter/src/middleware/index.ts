import { defineMiddleware } from 'astro:middleware';
import {
  fetchBuyerProfile,
  processRefreshToken,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';
import { proximaConfig } from '../lib/proxima';

export const onRequest = defineMiddleware(async ({ cookies, locals }, next) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;

  if (!token) {
    locals.buyer = null;
    return next();
  }

  try {
    // Intentar obtener el perfil con el token actual
    locals.buyer = await fetchBuyerProfile(
      { baseUrl: proximaConfig.baseUrl },
      { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
      { token }
    );
    return next();
  } catch (e: any) {
    if (e.status !== 401) throw e;
  }

  // Token expirado — intentar refresh silencioso
  const refreshToken = cookies.get(BUYER_REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) {
    cookies.delete(BUYER_COOKIE_NAME, { path: '/' });
    locals.buyer = null;
    return next();
  }

  try {
    const { access_token, refresh_token } = await processRefreshToken(
      { apiUrl: proximaConfig.baseUrl, domain: proximaConfig.domain },
      { refreshToken }
    );
    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }
    locals.buyer = await fetchBuyerProfile(
      { baseUrl: proximaConfig.baseUrl },
      { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
      { token: access_token }
    );
  } catch {
    // Refresh falló — limpiar sesión
    cookies.delete(BUYER_COOKIE_NAME, { path: '/' });
    cookies.delete(BUYER_REFRESH_COOKIE_NAME, { path: '/' });
    locals.buyer = null;
  }

  return next();
});
