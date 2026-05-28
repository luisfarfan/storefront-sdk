# 07 — Commerce

Auth de compradores, carrito, checkout, wishlist, órdenes, búsqueda y cupones.

---

## Arquitectura general

Todos los flujos de commerce siguen el mismo patrón:

```
Browser → POST /api/[recurso]   (API route en el storefront)
            ↓
        process*() / fetch*()   (helper del SDK)
            ↓
        Proxima API             (server-to-server, con service key)
            ↓
        Response → Cookie / JSON
```

Las credenciales del buyer (tokens) se guardan en **httpOnly cookies** — nunca
en localStorage. El SDK provee los nombres y opciones de cookie estándar.

---

## Auth — Registro y login

### Registro

```ts
// src/pages/api/buyer/register.ts
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
  const body = await request.json();

  try {
    const { access_token, refresh_token } = await processBuyerRegister(env, {
      email: body.email,
      password: body.password,
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone,                  // opcional
      accept_marketing: body.accept_marketing ?? false,
    });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof MissingFieldsError) {
      return Response.json({ ok: false, error: 'Campos requeridos faltantes', fields: e.fields }, { status: 422 });
    }
    return Response.json({ ok: false, error: e.data?.detail ?? 'Error inesperado' }, { status: e.status ?? 500 });
  }
};
```

### Login

```ts
// src/pages/api/buyer/login.ts
import type { APIRoute } from 'astro';
import {
  processBuyerLogin,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, next, captchaToken } = await request.json();

  try {
    const { access_token, refresh_token, next: redirectTo } =
      await processBuyerLogin(env, { email, password, next, captchaToken });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true, next: redirectTo ?? '/' });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail ?? 'Credenciales incorrectas' }, { status: e.status ?? 401 });
  }
};
```

> **Cloudflare Turnstile:** cuando la API tiene `TURNSTILE_ENABLED=true`, `captchaToken`
> es obligatorio. Recógelo del widget `<div class="cf-turnstile">` en el frontend y
> pásalo en el body del POST. El SDK lo envía como `captcha_token` al API.
> Lo mismo aplica a `processBuyerRegister` y `processForgotPassword`.

### Logout

```ts
// src/pages/api/buyer/logout.ts
import type { APIRoute } from 'astro';
import { processBuyerLogout, BUYER_COOKIE_NAME, BUYER_REFRESH_COOKIE_NAME } from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;

  if (token) {
    try { await processBuyerLogout(env, { token }); } catch {}
  }

  cookies.delete(BUYER_COOKIE_NAME, { path: '/' });
  cookies.delete(BUYER_REFRESH_COOKIE_NAME, { path: '/' });

  return Response.json({ ok: true });
};
```

### Refresh automático (middleware)

Ver [03 — Arquitectura](./03-architecture.md#middleware--sesión-del-buyer) para el
middleware completo que refresca el token automáticamente en cada request.

---

## Auth — Recuperación de contraseña

```ts
// src/pages/api/buyer/forgot-password.ts
import { processForgotPassword } from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ request }) => {
  const { email } = await request.json();
  try {
    await processForgotPassword(env, { email });
    return Response.json({ ok: true }); // siempre 200 (no revelar si existe)
  } catch {
    return Response.json({ ok: true }); // idem
  }
};

// src/pages/api/buyer/reset-password.ts
import { processResetPassword } from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ request }) => {
  const { token, password } = await request.json();
  try {
    await processResetPassword(env, { token, password });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
```

---

## Perfil del buyer

```ts
// src/pages/api/buyer/profile.ts
import { fetchBuyerProfile, updateBuyerProfile } from '@proxima-io/storefront-core';

export const GET: APIRoute = async ({ locals }) => {
  // El middleware ya validó el token y lo guardó en locals.buyer
  if (!locals.buyer) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, buyer: locals.buyer });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false }, { status: 401 });

  const body = await request.json();
  try {
    const buyer = await updateBuyerProfile(
      { baseUrl: import.meta.env.PROXIMA_API_URL },
      { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
      { token, ...body }
    );
    return Response.json({ ok: true, buyer });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
```

---

## Carrito

El carrito existe en dos contextos:
- **Guest** — identificado por `session_id` (UUID guardado en cookie)
- **Autenticado** — token del buyer

Al login, el carrito guest se fusiona con el del buyer con `mergeGuestCart`.

### Obtener el carrito

```ts
// src/pages/api/cart/index.ts
import { processGetCart } from '@proxima-io/storefront-core';

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  const cart = await processGetCart(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
    { token, session_id: sessionId }
  );

  return Response.json(cart);
};
```

### Agregar al carrito

La API devuelve **HTTP 422 con `{ code: "OUT_OF_STOCK" }`** cuando el variant no
tiene stock. El API route debe capturar ese código y devolverlo normalizado al
cliente para que el storefront muestre "Sin stock" sin hacer un hard reload.

```ts
// src/pages/api/buyer/cart/add.ts
import type { APIRoute } from 'astro';
import { processAddToCart, BUYER_COOKIE_NAME } from '@proxima-io/storefront-core';

const env = {
  apiUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_WEBSITE_DOMAIN,
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const isAjax = request.headers.get('X-Requested-With') === 'XMLHttpRequest';
  const body = await request.json().catch(() => ({}));
  const variantId = Number(body.variant_id);
  const quantity  = Number(body.quantity ?? 1);

  const token = cookies.get(BUYER_COOKIE_NAME)?.value ?? null;
  let sessionId = cookies.get('proxima_session')?.value ?? null;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookies.set('proxima_session', sessionId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  }

  try {
    const cart = await processAddToCart(env, { token, sessionId, variantId, quantity });
    if (isAjax) return Response.json({ ok: true, cart });
    return Response.redirect(request.headers.get('Referer') ?? '/carrito', 303);
  } catch (err: any) {
    // Normalize API error codes → client-friendly slugs
    const code = (err?.data as any)?.detail?.code
      ?? (err?.data as any)?.code
      ?? null;

    const errorSlug =
      code === 'OUT_OF_STOCK'     ? 'out_of_stock'
      : code === 'VARIANT_NOT_FOUND' ? 'variant_not_found'
      : 'server_error';

    if (isAjax) {
      return Response.json(
        { ok: false, error: errorSlug },
        { status: err?.status ?? 422 }
      );
    }
    return Response.redirect(`/carrito?error=${errorSlug}`, 303);
  }
};
```

### Eliminar del carrito

```ts
// src/pages/api/cart/remove.ts
import { processRemoveCartItem } from '@proxima-io/storefront-core';

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const { item_id } = await request.json();
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  try {
    const cart = await processRemoveCartItem(
      { baseUrl: import.meta.env.PROXIMA_API_URL },
      { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
      { token, session_id: sessionId, item_id }
    );
    return Response.json({ ok: true, cart });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
```

### Fusionar carrito guest → buyer (tras login)

```ts
// src/pages/api/cart/merge.ts
import { mergeGuestCart } from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  const sessionId = cookies.get('proxima_session')?.value;

  if (!token || !sessionId) return Response.json({ ok: true }); // nada que fusionar

  try {
    await mergeGuestCart(
      { baseUrl: import.meta.env.PROXIMA_API_URL },
      website, // ProximaWebsiteResponse
      { token, sessionId }
    );
    // Limpiar la cookie de sesión guest
    cookies.delete('proxima_session', { path: '/' });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true }); // silenciar — mejor perder items guest que bloquear login
  }
};
```

Llamar a `/api/cart/merge` inmediatamente después del login:

```ts
// client-side, tras login exitoso
await fetch('/api/buyer/login', { method: 'POST', body: JSON.stringify({ email, password }) });
await fetch('/api/cart/merge', { method: 'POST' }); // ← fusionar antes de redirect
window.location.href = '/cuenta';
```

---

## Checkout

```ts
// src/pages/api/cart/checkout.ts
import { processBuyerCheckout } from '@proxima-io/storefront-core';

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json();
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  try {
    const order = await processBuyerCheckout(
      { baseUrl: import.meta.env.PROXIMA_API_URL },
      { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
      {
        token,
        address_id: body.address_id,
        delivery_mode: body.delivery_mode,  // "delivery" | "pickup"
        coupon_code: body.coupon_code,      // opcional
        payment_method: body.payment_method,
      }
    );
    return Response.json({ ok: true, order });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.data?.detail }, { status: e.status ?? 400 });
  }
};
```

---

## Cupones

```ts
// src/pages/api/coupon/validate.ts
import { validateCoupon } from '@proxima-io/storefront-core';

export const GET: APIRoute = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const amount = Number(url.searchParams.get('amount') ?? '0');

  if (!code) return Response.json({ ok: false, error: 'Código requerido' }, { status: 400 });

  const result = await validateCoupon(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    website,
    { code, amount }
  );

  return Response.json(result);
  // → { valid: true, code, discount_amount, discount_type, discount_value }
  // → { valid: false, error: "Cupón expirado" }
};
```

---

## Wishlist

```ts
// src/pages/api/wishlist/index.ts
import { fetchWishlist, addToWishlist, removeFromWishlist } from '@proxima-io/storefront-core';

const getToken = (cookies: AstroCookies) => cookies.get(BUYER_COOKIE_NAME)?.value;

export const GET: APIRoute = async ({ cookies }) => {
  const token = getToken(cookies);
  if (!token) return Response.json({ items: [] });

  const wishlist = await fetchWishlist(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID, token }
  );
  return Response.json(wishlist);
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = getToken(cookies);
  if (!token) return Response.json({ ok: false }, { status: 401 });

  const { product_id } = await request.json();
  await addToWishlist(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID, token },
    { product_id }
  );
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const token = getToken(cookies);
  if (!token) return Response.json({ ok: false }, { status: 401 });

  const { product_id } = await request.json();
  await removeFromWishlist(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID, token },
    { product_id }
  );
  return Response.json({ ok: true });
};
```

### Componente WishlistButton (client-side)

```astro
---
// src/components/WishlistButton.astro
interface Props { productId: number }
const { productId } = Astro.props;
---

<button
  class="wishlist-btn"
  data-product-id={productId}
  aria-label="Agregar a favoritos"
>
  ♡
</button>

<script>
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    const productId = btn.dataset.productId;

    btn.addEventListener('click', async () => {
      const isActive = btn.classList.contains('is-active');

      const res = await fetch('/api/wishlist', {
        method: isActive ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: Number(productId) }),
      });

      if (res.ok) {
        btn.classList.toggle('is-active');
        btn.textContent = btn.classList.contains('is-active') ? '♥' : '♡';
      } else if (res.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
      }
    });
  });
</script>
```

---

## Órdenes

```ts
// src/pages/api/orders/index.ts
import { fetchOrders } from '@proxima-io/storefront-core';

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false }, { status: 401 });

  const page = Number(url.searchParams.get('page') ?? '1');

  const orders = await fetchOrders(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
    { token, page }
  );

  return Response.json(orders);
};

// src/pages/api/orders/[id].ts
import { fetchOrder } from '@proxima-io/storefront-core';

export const GET: APIRoute = async ({ params, cookies }) => {
  const token = cookies.get(BUYER_COOKIE_NAME)?.value;
  if (!token) return Response.json({ ok: false }, { status: 401 });

  const order = await fetchOrder(
    { baseUrl: import.meta.env.PROXIMA_API_URL },
    { business_id: import.meta.env.PROXIMA_BUSINESS_ID },
    { token, order_id: Number(params.id) }
  );

  return Response.json(order);
};
```

---

## Búsqueda client-side

La búsqueda es siempre client-side — no hay datos iniciales en la composición.
La sección de búsqueda renderiza el input; el script hace la query:

```astro
---
// src/components/SearchBar.astro
---

<div class="search-bar">
  <input
    type="search"
    id="search-input"
    placeholder="Buscar productos..."
    autocomplete="off"
  />
  <div id="search-results" class="search-results" hidden></div>
</div>

<script>
  import { searchStorefront } from '@proxima-io/storefront-core';

  const input = document.getElementById('search-input') as HTMLInputElement;
  const results = document.getElementById('search-results')!;

  let debounceTimer: ReturnType<typeof setTimeout>;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();

    if (q.length < 2) {
      results.hidden = true;
      return;
    }

    debounceTimer = setTimeout(async () => {
      const data = await searchStorefront(
        { baseUrl: import.meta.env.PUBLIC_PROXIMA_API_URL },
        {
          business_id: window.__PROXIMA_BUSINESS_ID__,
          locale: document.documentElement.lang,
          currency: window.__PROXIMA_CURRENCY__,
        },
        { q, limit: 8 }
      );

      results.innerHTML = data.hits.map(p => `
        <a href="/producto/${p.slug}" class="search-result">
          <img src="${p.image_url}" alt="${p.name}" />
          <span>${p.name}</span>
          <span>${p.price_formatted}</span>
        </a>
      `).join('');

      results.hidden = data.hits.length === 0;
    }, 250);
  });
</script>
```

Las variables globales `__PROXIMA_BUSINESS_ID__` y `__PROXIMA_CURRENCY__` se inyectan
desde el layout:

```astro
<!-- BaseLayout.astro -->
<script define:vars={{ businessId: website.business_id, currency: website.currency }}>
  window.__PROXIMA_BUSINESS_ID__ = businessId;
  window.__PROXIMA_CURRENCY__ = currency;
</script>
```

---

## Direcciones del buyer

```ts
import {
  fetchBuyerAddresses,
  createBuyerAddress,
  updateBuyerAddress,
  deleteBuyerAddress,
  setDefaultBuyerAddress,
} from '@proxima-io/storefront-core';

// GET — listar
const addresses = await fetchBuyerAddresses(
  { baseUrl: apiUrl },
  { business_id },
  { token }
);

// POST — crear
const address = await createBuyerAddress(
  { baseUrl: apiUrl },
  { business_id },
  { token, street: '...', city: '...', country: 'PE', zip_code: '...', is_default: false }
);

// PUT — actualizar
await updateBuyerAddress({ baseUrl: apiUrl }, { business_id }, { token, address_id: 5, street: '...' });

// DELETE — eliminar
await deleteBuyerAddress({ baseUrl: apiUrl }, { business_id }, { token, address_id: 5 });

// PATCH — marcar como default
await setDefaultBuyerAddress({ baseUrl: apiUrl }, { business_id }, { token, address_id: 5 });
```

---

## Resumen de helpers del SDK

| Helper | Cuándo usarlo |
|--------|--------------|
| `processBuyerRegister` | POST /api/buyer/register (soporta `captchaToken`) |
| `processBuyerLogin` | POST /api/buyer/login (soporta `captchaToken`) |
| `processBuyerLogout` | POST /api/buyer/logout |
| `processRefreshToken` | Middleware: refresh silencioso |
| `fetchBuyerProfile` | GET perfil autenticado |
| `updateBuyerProfile` | PATCH datos del perfil |
| `processForgotPassword` | POST olvidé mi contraseña (soporta `captchaToken`) |
| `processResetPassword` | POST resetear contraseña con token |
| `processGetCart` | GET carrito actual |
| `processAddToCart` | POST añadir al carrito — lanza `{ data: { detail: { code: "OUT_OF_STOCK" } } }` si sin stock |
| `processRemoveCartItem` | DELETE quitar item |
| `processUpdateCartItem` | PATCH actualizar cantidad de un item |
| `mergeGuestCart` | POST fusionar carrito guest tras login |
| `processBuyerCheckout` | POST confirmar orden |
| `fetchOrders` | GET historial de órdenes |
| `fetchOrder` | GET detalle de una orden |
| `fetchWishlist` | GET lista de deseos |
| `addToWishlist` | POST añadir producto |
| `removeFromWishlist` | DELETE quitar producto |
| `validateCoupon` | GET validar cupón antes de checkout |
| `searchStorefront` | Búsqueda client-side (autocomplete) |
| `fetchStorefrontProducts` | Paginación: listado general |
| `fetchCategoryProducts` | Paginación: por categoría |
| `fetchBrandProducts` | Paginación: por marca |
| `fetchCategoriesDirectory` | Listar todas las categorías (plano, para sitemap) |
| `fetchCategoryNavTree` | Árbol recursivo de categorías para mega menú de navegación |
| `fetchBrandsDirectory` | Listar todas las marcas |

### Manejo de errores de stock

El API route de agregar al carrito debe normalizar los códigos de error de la API:

```ts
// Errores posibles de processAddToCart
try {
  const cart = await processAddToCart(env, params);
} catch (err: any) {
  const code = err?.data?.detail?.code ?? err?.data?.code ?? null;
  // code === "OUT_OF_STOCK"      → producto sin stock
  // code === "VARIANT_NOT_FOUND" → variant inválido
  // null                         → error de servidor
}
```

En el cliente (`cart-actions.ts`), manejar el slug normalizado:

```ts
const data = await res.json();
if (!data.ok) {
  if (data.error === 'out_of_stock') showToast('Sin stock disponible');
  else showToast('Error al agregar al carrito');
}
```
