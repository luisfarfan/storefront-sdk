import type { APIRoute } from 'astro';
import {
  processBuyerLogout,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
} from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;

  if (token) {
    try {
      await processBuyerLogout(
        { apiUrl: import.meta.env.PROXIMA_API_URL, domain: import.meta.env.PROXIMA_DOMAIN },
        { token }
      );
    } catch {
      // Silenciar errores — siempre limpiar las cookies
    }
  }

  cookies.delete(BUYER_COOKIE_NAME, { path: '/' });
  cookies.delete(BUYER_REFRESH_COOKIE_NAME, { path: '/' });

  return Response.json({ ok: true });
};
