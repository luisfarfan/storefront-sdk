import type { APIRoute } from 'astro';
import {
  processBuyerLogin,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

const env = {
  apiUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_DOMAIN,
};

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: string; password?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, next } = body;
  if (!email || !password) {
    return Response.json({ ok: false, error: 'Email y contraseña requeridos' }, { status: 422 });
  }

  try {
    const { access_token, refresh_token, next: redirectTo } = await processBuyerLogin(env, {
      email,
      password,
      next,
    });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true, next: redirectTo ?? '/' });
  } catch (e: any) {
    const status = e.status ?? 500;
    const error = e.data?.detail ?? 'Credenciales incorrectas';
    return Response.json({ ok: false, error }, { status });
  }
};
