# @proxima-io/storefront-core

Cliente HTTP para la API Proxima. Cubre autenticación de compradores, carrito, órdenes,
libro de direcciones, wishlist, búsqueda, listados de catálogo y analytics.

## Instalación

```bash
pnpm add @proxima-io/storefront-core
```

---

## Arquitectura: composition-first

El storefront usa un modelo **composition-first**: cada página se resuelve con una sola
llamada a `fetchProximaComposition`, que devuelve el layout CMS completo con todos los datos
ya embebidos (productos, categorías, marcas via smart collections; entidad principal via
`resolved_data`). **No se necesitan llamadas adicionales al catálogo para el primer render.**

Las funciones de catálogo de este SDK (`searchStorefront`, `fetchCategoryProducts`, etc.)
son para **interacciones client-side** que ocurren después del primer render: filtros,
paginación, búsqueda en vivo.

```
Cada página:
  fetchProximaWebsite(domain)          → resuelve el website (cachear)
  fetchProximaComposition(config, ws)  → layout + datos completos para SSR

Interacciones posteriores (client-side):
  searchStorefront(...)                → resultados de búsqueda
  fetchCategoryProducts(...)           → paginación / filtros en CLP
  fetchBrandProducts(...)              → paginación / filtros en BLP
  fetchStorefrontProducts(...)         → listado general con filtros
```

---

## Website & Composición

### `fetchProximaWebsite(config)`

Resuelve el website por dominio. Llamar una vez por request y cachear el resultado.

```ts
const website = await fetchProximaWebsite({
  baseUrl: import.meta.env.PROXIMA_API_URL,
  domain: Astro.url.hostname,
});
```

### `fetchProximaComposition(config, website)`

Obtiene la composición completa de una página: secciones CMS, SEO y datos resueltos.
Es la llamada principal para el render SSR de cualquier página.

```ts
const composition = await fetchProximaComposition(
  { ...config, path: Astro.url.pathname },
  website,
);
// composition.sections    → secciones CMS con datos de smart collections
// composition.resolved_data → entidad principal (product, category, brand, blog)
// composition.seo         → meta tags
// composition.resolver_kind → tipo de página ("product_detail", "category_detail", …)
```

### `makeBuilderPreviewWebsite(config)`

Crea un `ProximaWebsiteResponse` sintético para el preview del Builder visual.

```ts
const website = makeBuilderPreviewWebsite({
  websiteId: Astro.url.searchParams.get('builder_website_id'),
  businessId: Astro.url.searchParams.get('builder_business_id'),
  domain: Astro.url.hostname,
});
```

### `fetchProximaWebsiteList(config)`

Lista todos los websites del tenant. Requiere `serviceKey`. Uso: scripts de build o CI.

```ts
const websites = await fetchProximaWebsiteList({ baseUrl, serviceKey });
```

---

## Catálogo storefront

Estas funciones se usan para interacciones client-side después del primer render SSR,
o para sitemap / navegación. **No usarlas para el render inicial de página** — esos datos
ya vienen en la composición.

### `searchStorefront(config, website, params)`

Búsqueda de productos por texto. Usar para la barra de búsqueda y la página de resultados
(`resolver_kind: "search"` tiene `resolved_data = null` — los resultados se deben pedir aquí).

```ts
const results = await searchStorefront(config, website, { q: 'zapatillas', limit: 10 });
// results.hits: StorefrontProductSummary[]
// results.total: number
```

### `fetchStorefrontProducts(config, website, params?)`

Listado general de productos con filtros y paginación. Para la página de todos los productos
cuando el usuario cambia filtros o avanza de página.

```ts
const listing = await fetchStorefrontProducts(config, website, {
  page: 2, pageSize: 24, sort: 'price_asc',
  category: 'zapatillas', brand: 'nike',
});
// listing.items, listing.pagination, listing.brand_facets, listing.category_facets
```

> **Nota:** `fetchProximaProducts` está obsoleta. Usar `fetchStorefrontProducts` en su lugar.

### `fetchCategoryProducts(config, website, params)`

Productos de una categoría con paginación y filtros. Para los cambios de página / filtro
en las páginas de categoría (CLP) después del SSR inicial.

```ts
const listing = await fetchCategoryProducts(config, website, {
  slug: 'zapatillas', page: 2, sort: 'price_asc', brand: 'adidas',
});
// listing.category, listing.items, listing.pagination, listing.brand_facets
```

### `fetchBrandProducts(config, website, params)`

Productos de una marca con paginación y filtros. Para páginas de marca (BLP).

```ts
const listing = await fetchBrandProducts(config, website, {
  slug: 'nike', page: 1, category: 'running',
});
// listing.brand, listing.items, listing.pagination, listing.category_facets
```

### `fetchCategoriesDirectory(config, website)`

Directorio completo de categorías con conteo de productos. Para menús de navegación y sitemap.

```ts
const { items, total } = await fetchCategoriesDirectory(config, website);
// items: [{ id, name, slug, href, product_count, image_url? }]
```

### `fetchCategoryNavTree(config, website, params?)`

Árbol recursivo de categorías para mega menú de navegación. Cada nodo incluye
`children[]` con subnodos anidados y `href` con la ruta del storefront lista para
renderizar.

```ts
const tree = await fetchCategoryNavTree(config, website, { maxDepth: 3 });
// tree.nodes: CategoryNavNode[]
// node.href = "/categoria/{slug}"
// node.children: CategoryNavNode[]  (recursivo)
```

### `fetchBrandsDirectory(config, website)`

Directorio completo de marcas. Para menús de navegación y sitemap.

```ts
const { items, total } = await fetchBrandsDirectory(config, website);
// items: [{ id, name, slug, href, product_count, logo_url? }]
```

---

## SEO y structured data

### `buildPageSeo(seoData, website, locale, currentUrl)`

Construye el objeto `PageSeoMeta` completo para una página. Prioridad: campos
admin-set > datos de la entidad (producto/categoría) > defaults del website.
Pasar el resultado directamente a `<SiteLayout seo={seo} />`.

```ts
const seo = buildPageSeo(composition.seo, website, website.locale, canonicalUrl);
// seo.title, seo.description, seo.ogImage, seo.canonicalUrl, seo.robots, …
```

### JSON-LD builders (schema.org)

```ts
// En SiteLayout.astro — sitewide
const websiteJsonLd = buildWebSiteJsonLd(website);
const orgJsonLd = buildOrganizationJsonLd(website); // null si no hay logo_url

// En ProductDetail.astro — por producto
const productJsonLd = buildProductJsonLd(product, website);
// product debe satisfacer JsonLdProductMeta: { name, slug, priceRaw, images?, brand?, sku? }

// En cualquier página — breadcrumbs
const breadcrumbJsonLd = buildBreadcrumbJsonLd(
  [{ label: 'Inicio', href: '/' }, { label: 'GPUs', href: '/categoria/gpus' }, { label: product.name }],
  `https://${website.domain}`
);
```

```astro
<!-- En el <head> del layout -->
<script type="application/ld+json" set:html={JSON.stringify(websiteJsonLd)} />
{orgJsonLd && <script type="application/ld+json" set:html={JSON.stringify(orgJsonLd)} />}
```

### `generateSitemapXml(website, apiUrl, options?)`

Genera el `sitemap.xml` completo: páginas estáticas, categorías (árbol), marcas y
productos (paginados). Usa las funciones de catálogo del SDK internamente.

```ts
// apps/{slug}/src/pages/sitemap.xml.ts
import type { APIRoute } from 'astro';
import { resolveWebsiteOnly } from '@/lib/resolver';
import { generateSitemapXml } from '@proxima-io/storefront-core';

export const GET: APIRoute = async () => {
  const website = await resolveWebsiteOnly();
  const xml = await generateSitemapXml(
    website,
    import.meta.env.PROXIMA_API_URL,
    { maxProducts: 3000 }
  );
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
```

### `generateRobotsTxt(website)`

Genera `robots.txt` con `Disallow` en rutas privadas del buyer y `Sitemap:` directive.

```ts
// apps/{slug}/src/pages/robots.txt.ts
export const GET: APIRoute = async () => {
  const website = await resolveWebsiteOnly();
  return new Response(generateRobotsTxt(website), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

### `notifyIndexNow(apiKey, siteUrl, urls)`

Notifica a Bing/Yandex (y opcionalmente Google) sobre URLs actualizadas para re-crawl
inmediato. Llamar desde webhooks de catálogo o tras publicar páginas.

```ts
await notifyIndexNow(
  import.meta.env.PROXIMA_INDEXNOW_KEY,
  `https://${website.domain}`,
  [`https://${website.domain}/producto/${slug}`]
);
```

---

## Autenticación de compradores

### Formulario de registro dinámico

```ts
// Obtener el formulario configurado por el comercio
const form = await fetchRegistrationForm(config, website);
// form.mode: "single_step" | "multi_step"
// form.steps[0].fields: RegistrationFormField[]  (email y password ya incluidos)
```

### `registerBuyer(config, website, params)`

Registra un nuevo comprador. Los campos requeridos dependen de la configuración del comercio
(ver `fetchRegistrationForm`). Lanza `MissingFieldsError` si faltan campos obligatorios.

```ts
try {
  const session = await registerBuyer(config, website, {
    email: 'juan@ejemplo.com',
    password: 'secret',
    fullName: 'Juan Pérez',
    phone: '+51999999999',
    docType: 1,           // 1=DNI 2=CE 3=Pasaporte 6=RUC
    docNumber: '12345678',
    birthDate: '1990-05-15',
    newsletterSubscribed: true,
  });
  // session.access_token, session.refresh_token
} catch (e) {
  if (e instanceof MissingFieldsError) {
    // e.missingFields: [{ field: 'phone', msg: 'FIELD_REQUIRED' }]
    e.missingFields.forEach(({ field }) => markFieldError(field));
  }
}
```

### `loginBuyer(config, website, params)`

```ts
const session = await loginBuyer(config, website, { email, password });
// session.access_token, session.refresh_token
```

### `logoutBuyer(config, website, params)`

Invalida el token en el servidor (best-effort).

```ts
await logoutBuyer(config, website, { token });
```

### `refreshBuyerToken(config, website, params)`

Obtiene un nuevo `access_token` usando el `refresh_token`. Usar en middleware Astro para
refrescar sesiones expiradas silenciosamente.

```ts
try {
  const session = await refreshBuyerToken(config, website, { refreshToken });
  // Guardar session.access_token en cookie
} catch {
  // refresh_token expirado → limpiar cookies, redirigir al login
}
```

### `fetchBuyerProfile(config, website, params)`

```ts
const profile = await fetchBuyerProfile(config, website, { token });
// profile.email, profile.full_name, profile.doc_type, profile.newsletter_subscribed, …
```

### `updateBuyerProfile(config, website, params)`

Actualización parcial — solo los campos enviados se modifican.

```ts
const updated = await updateBuyerProfile(config, website, {
  token,
  fullName: 'Juan García',
  newsletterSubscribed: true,
  // password: 'newPass' → cambia la contraseña sin invalidar el token actual
});
```

---

## Recuperación de contraseña

```ts
// 1. Enviar email de recuperación (siempre resuelve, no confirma si el email existe)
await forgotPassword(config, website, { email: 'juan@ejemplo.com' });
// → Mostrar siempre: "Si el email existe, recibirás un enlace."

// 2. Cambiar contraseña con el token del email (?token=xxx)
try {
  await resetPassword(config, { token, newPassword: 'nueva' });
  // → Redirigir al login ("Contraseña actualizada")
} catch (e: any) {
  if (e.data?.detail === BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID) {
    // Token inválido o expirado
  }
}
```

## Verificación de email

```ts
// Verificar con el token del email (?token=xxx)
try {
  await verifyEmail(config, { token });
} catch (e: any) {
  if (e.data?.detail === BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID) { /* … */ }
}

// Reenviar el email de verificación (requiere estar autenticado)
try {
  await resendVerification(config, website, { token: accessToken });
} catch (e: any) {
  if (e.data?.detail === BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED) { /* … */ }
}
```

### `BUYER_AUTH_ERRORS`

Constantes para comparar errores de la API sin hardcodear strings:

```ts
import { BUYER_AUTH_ERRORS } from '@proxima-io/storefront-core';

BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID     // "RESET_TOKEN_INVALID"
BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID    // "VERIFY_TOKEN_INVALID"
BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED  // "EMAIL_ALREADY_VERIFIED"
BUYER_AUTH_ERRORS.EMAIL_TAKEN             // "Email already registered in this store"
BUYER_AUTH_ERRORS.MISSING_REQUIRED_FIELDS // "MISSING_REQUIRED_FIELDS"
```

---

## Carrito

El carrito soporta compradores guest (sin token) y autenticados.

```ts
const cart = await fetchCart(config, website, { token });        // token opcional
const cart = await addToCart(config, website, { variantId: 42, quantity: 1, token });
const cart = await updateCartItem(config, website, { variantId: 42, quantity: 3, token });
const cart = await removeCartItem(config, website, { variantId: 42, token });
```

### `mergeGuestCart(config, website, params)`

Fusiona el carrito guest con el carrito del comprador al hacer login.
Llamar inmediatamente después de un login exitoso si existe una sesión guest activa.

```ts
const sessionId = localStorage.getItem('proxima_session_id');
if (sessionId) {
  await mergeGuestCart(config, website, { token: session.access_token, sessionId });
}
```

### `validateCoupon(config, website, params)`

Valida un cupón antes del checkout. Siempre resuelve — verificar `result.valid`.

```ts
const result = await validateCoupon(config, website, { code: 'PROMO10', amount: 150.00 });
if (result.valid) {
  showDiscount(result.discount_amount); // Monto a descontar
} else {
  showError(result.error); // Mensaje de error (expirado, mínimo no alcanzado, etc.)
}
```

---

## Órdenes

```ts
// Checkout (convierte el carrito en orden)
const order = await createOrder(config, website, {
  token,
  checkout: {
    customer_name: 'Juan Pérez',
    customer_phone: '999888777',
    customer_email: 'juan@ejemplo.com',
    shipping_address: 'Av. Javier Prado 1234, Lima',
    coupon_code: 'PROMO10',  // opcional
  },
});

// Historial de pedidos
const { items, total } = await fetchOrders(config, website, { token, page: 1, size: 10 });

// Detalle de un pedido
const order = await fetchOrder(config, website, { token, orderId: 'ord_abc123' });
```

---

## Libro de direcciones

```ts
const addresses = await fetchCustomerAddresses(config, website, { token });

const address = await createCustomerAddress(config, website, {
  token,
  address: {
    line1: 'Av. Larco 345',
    ubigeo_code: '150122',  // Código ubigeo de 6 dígitos
    reference: 'Frente al parque',
    is_default: true,
    latitude: -12.1219,     // opcional
    longitude: -77.0299,    // opcional
    geocoding_source: 'google_maps',
  },
});

await updateCustomerAddress(config, website, { token, addressId: 5, address: { line1: 'Nueva dirección' } });
await deleteCustomerAddress(config, website, { token, addressId: 5 });
await setDefaultAddress(config, website, { token, addressId: 5 });

// Buscar ubigeos peruanos por texto
const results = await searchUbigeo(config, { q: 'miraflores' });
// [{ code: '150122', department: 'Lima', province: 'Lima', district: 'Miraflores', full_name: '…' }]
```

---

## Wishlist

```ts
// Listar items del wishlist
const items = await fetchWishlist(config, website, { token });

// Agregar producto (idempotente — no crea duplicados)
const item = await addToWishlist(config, website, {
  token,
  productId: 'uuid-del-producto',
  variantId: 'uuid-variante',  // opcional
  notes: 'Lo quiero en azul',  // opcional
});

// Eliminar producto del wishlist (lanza { status: 404 } si no existía)
await removeFromWishlist(config, website, { token, productId: 'uuid-del-producto' });
```

---

## Server-side helpers

Los `process*` helpers combinan `fetchProximaWebsite` + la operación correspondiente.
Diseñados para rutas de API Astro — reducen el boilerplate a ~5 líneas.

```ts
interface BuyerServerEnv {
  apiUrl: string;      // import.meta.env.PROXIMA_API_URL
  domain: string;      // Astro.url.hostname
  serviceKey?: string; // import.meta.env.PROXIMA_SERVICE_KEY
}
```

```ts
// src/pages/api/buyer/login.ts
import {
  processBuyerLogin,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

export const POST = async ({ request, cookies }) => {
  const { email, password } = await request.json();
  const { access_token, refresh_token, next } = await processBuyerLogin(env, { email, password });
  cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
  if (refresh_token) cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
  return Response.redirect(next);
};
```

| Helper | Descripción |
|--------|-------------|
| `processBuyerLogin(env, params)` | Website → login → `{ access_token, refresh_token, next }` |
| `processBuyerRegister(env, params)` | Website → register → `{ access_token, refresh_token, next }`. Propaga `MissingFieldsError` |
| `processBuyerLogout(env, params)` | Logout best-effort, nunca lanza |
| `processRefreshToken(env, params)` | Website → refresh → `{ access_token, refresh_token }` |
| `processForgotPassword(env, params)` | Website → forgot password. Nunca lanza |
| `processResetPassword(env, params)` | Reset password con token del email |
| `processVerifyEmail(env, params)` | Verificar email con token del email |
| `processGetCart(env, params)` | Website → fetch cart |
| `processAddToCart(env, params)` | Website → add to cart |
| `processRemoveCartItem(env, params)` | Website → remove cart item |
| `processBuyerCheckout(env, params)` | Website → create order → `{ orderId }` |
| `processSetDefaultAddress(env, params)` | Website → set default address |
| `processDeleteAddress(env, params)` | Website → delete address |

### Patrón recomendado de middleware (refresh silencioso)

```
1. Leer cookie buyer_token
2. Si no existe → continuar sin sesión
3. Si existe → fetchBuyerProfile
4. Si devuelve 401 → processRefreshToken con buyer_refresh_token
5. Si OK → actualizar cookie buyer_token, continuar
6. Si falla → limpiar ambas cookies, continuar sin sesión
```

**Constantes de cookie:**

```ts
BUYER_COOKIE_NAME         // 'buyer_token'
BUYER_REFRESH_COOKIE_NAME // 'buyer_refresh_token'
BUYER_COOKIE_OPTIONS      // { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 604800 }
```

---

## Analytics

Cliente client-side con queue automático y flush por batch.

```ts
import { analytics } from '@proxima-io/storefront-core';

// En SiteLayout.astro <script> — llamar una sola vez:
analytics.init({
  apiUrl: 'https://api.proxima.io',
  websiteId: 'uuid-website',
  businessId: 'uuid-negocio',
  locale: 'es',
  flushInterval: 3000, // ms (default: 3000)
  debug: false,
});

// En cualquier componente client-side:
analytics.track('product_view', { product_slug: 'titan-mx-pro' });
analytics.track('add_to_cart', { product_slug, variant_id: 42, price: 199.90 });
analytics.track('order_completed', { order_id: 'ord_123', order_total: 399.80 });
analytics.track('search', { query: 'zapatillas', results_count: 24 });
```

- `page_view` se dispara automáticamente al iniciar y en cada `astro:page-load`.
- Los eventos se encolan y se envían en batch a `POST /api/v1/store/events`.
- Al cerrar la pestaña (`visibilitychange: hidden`) se usa `navigator.sendBeacon`.
- Es seguro llamar `analytics.track()` antes de `analytics.init()` — los eventos se reproducen al inicializar.
