import type { APIRoute } from 'astro';
import {
  processBuyerRegister,
  MissingFieldsError,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

const env = {
  apiUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_DOMAIN,
};

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const { access_token, refresh_token } = await processBuyerRegister(env, {
      email: body.email as string,
      password: body.password as string,
      first_name: body.first_name as string,
      last_name: body.last_name as string,
      phone: body.phone as string | undefined,
      accept_marketing: (body.accept_marketing as boolean) ?? false,
    });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof MissingFieldsError) {
      return Response.json(
        { ok: false, error: 'Campos requeridos faltantes', fields: e.fields },
        { status: 422 }
      );
    }
    const status = e.status ?? 500;
    const error = e.data?.detail ?? 'Error al registrar';
    return Response.json({ ok: false, error }, { status });
  }
};
