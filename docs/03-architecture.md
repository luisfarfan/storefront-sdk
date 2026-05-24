# 03 — Arquitectura de archivos

Estructura recomendada para un storefront Proxima en Astro.

---

## Estructura completa

```
src/
  lib/
    proxima.ts          # Config + getWebsite() cacheado
    session.ts          # Helpers para cookies de buyer

  layouts/
    BaseLayout.astro    # HTML base: analytics, bridge, theme tokens, fonts

  middleware/
    index.ts            # Validación de sesión + refresh automático

  sections/
    index.ts            # Section router: type → Astro component
    HeroSection.astro
    ProductGridSection.astro
    CategoryGridSection.astro
    HeaderSection.astro
    FooterSection.astro
    SearchSection.astro
    # ... una sección por section type

  components/
    ProductCard.astro
    SearchBar.astro       # client:load
    CartDrawer.astro      # client:load
    WishlistButton.astro  # client:load
    BuyerMenu.astro       # client:load

  pages/
    [...path].astro       # Catch-all: maneja TODAS las rutas via composición

    api/
      buyer/
        login.ts          # POST — processBuyerLogin
        register.ts       # POST — processBuyerRegister
        logout.ts         # POST — processBuyerLogout
        refresh.ts        # POST — processRefreshToken (para middleware)
        profile.ts        # GET/PATCH — fetchBuyerProfile / updateBuyerProfile

      cart/
        index.ts          # GET — processGetCart
        add.ts            # POST — processAddToCart
        remove.ts         # DELETE — processRemoveCartItem
        merge.ts          # POST — mergeGuestCart (tras login)
        checkout.ts       # POST — processBuyerCheckout

      coupon/
        validate.ts       # GET — validateCoupon

      wishlist/
        index.ts          # GET/POST/DELETE
```

---

## El catch-all `[...path].astro`

El corazón del routing. Una sola página maneja todas las rutas:

```astro
---
// src/pages/[...path].astro
import BaseLayout from '../layouts/BaseLayout.astro';
import { fetchProximaComposition } from '@proxima-io/storefront-core';
import { getWebsite, proximaConfig } from '../lib/proxima';
import { SECTION_MAP } from '../sections';

const website = await getWebsite();
const path = '/' + (Astro.params.path ?? '');

let composition;
try {
  composition = await fetchProximaComposition({ ...proximaConfig, path }, website);
} catch (e: any) {
  if (e.status === 404) return Astro.redirect('/404');
  throw e;
}

const { sections, seo, resolver_kind, resolved_data } = composition;
---

<BaseLayout {website} {seo}>
  {sections.map(section => {
    const Component = SECTION_MAP[section.type];
    if (!Component) return null;
    return (
      <Component
        section={section}
        website={website}
        resolverKind={resolver_kind}
        resolvedData={resolved_data}
      />
    );
  })}
</BaseLayout>
```

### ¿Por qué un solo catch-all y no páginas por resolver_kind?

Porque **el comercio configura sus propias secciones** para cada tipo de página.
No hay garantía de que `/categoria/zapatillas` y `/categoria/ropa` tengan las mismas secciones.
El catch-all resuelve la composición y renderiza lo que viene — siempre funciona.

Si necesitas lógica específica por tipo de página (e.g. agregar structured data para PDPs),
hazlo dentro del catch-all con un switch en `resolver_kind`:

```astro
---
// Structured data para PDPs
const ldJson = resolver_kind === 'product_detail'
  ? buildProductSchema(resolved_data.product)
  : null;
---
{ldJson && <script type="application/ld+json" set:html={JSON.stringify(ldJson)} />}
```

---

## El section router `sections/index.ts`

```ts
// src/sections/index.ts
import type { Component } from 'astro';

// Importar todos tus componentes de sección
import HeroSection from './HeroSection.astro';
import ProductGridSection from './ProductGridSection.astro';
import CategoryGridSection from './CategoryGridSection.astro';
import HeaderSection from './HeaderSection.astro';
import FooterSection from './FooterSection.astro';
import SearchSection from './SearchSection.astro';
import BannerSection from './BannerSection.astro';

/**
 * Mapea section.type → componente Astro.
 * Agregar aquí cada nuevo section type que implementes.
 *
 * La clave debe coincidir EXACTAMENTE con el `key` del SectionType
 * registrado en el admin de Proxima.
 */
export const SECTION_MAP: Record<string, any> = {
  header:        HeaderSection,
  hero:          HeroSection,
  product_grid:  ProductGridSection,
  category_grid: CategoryGridSection,
  search:        SearchSection,
  banner:        BannerSection,
  footer:        FooterSection,
};
```

---

## `BaseLayout.astro`

El layout base incluye todo lo que va en cada página:

```astro
---
// src/layouts/BaseLayout.astro
import { analytics } from '@proxima-io/storefront-core';
import { CmsPreviewBridge } from '@proxima-io/storefront-builder-sdk';
import { isCmsPreview } from '@proxima-io/storefront-cms';

interface Props {
  website: ProximaWebsiteResponse;
  seo?: { meta_title?: string; meta_description?: string; og_image_url?: string; robots?: string };
}

const { website, seo } = Astro.props;
const isPreview = isCmsPreview(Astro.url);
const themeVars = buildCssVars(website.theme_tokens);
---

<!doctype html>
<html lang={website.locale}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{seo?.meta_title ?? website.name}</title>
    {seo?.meta_description && <meta name="description" content={seo.meta_description} />}
    {seo?.og_image_url && <meta property="og:image" content={seo.og_image_url} />}
    <meta name="robots" content={seo?.robots ?? 'index, follow'} />
    <style set:html={`:root { ${themeVars} }`} />
  </head>
  <body>
    <!-- Builder bridge (solo activo en preview mode) -->
    <CmsPreviewBridge enabled={isPreview} />

    <slot />

    <!-- Analytics — init client-side -->
    <script define:vars={{ apiUrl: import.meta.env.PUBLIC_PROXIMA_API_URL, websiteId: website.id, businessId: website.business_id, locale: website.locale }}>
      import('@proxima-io/storefront-core').then(({ analytics }) => {
        analytics.init({ apiUrl, websiteId, businessId, locale });
      });
    </script>
  </body>
</html>

<script>
  function buildCssVars(tokens) {
    if (!tokens) return '';
    return Object.entries(tokens)
      .map(([k, v]) => `--proxima-${k}: ${v}`)
      .join('; ');
  }
</script>
```

---

## Middleware — Sesión del buyer

El middleware valida el `buyer_token` en cada request y refresca la sesión si está expirada:

```ts
// src/middleware/index.ts
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

  // Token expirado — intentar refresh
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
    if (refresh_token) cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    // Reintentar con el nuevo token
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
```

Añadir `locals.buyer` a `env.d.ts`:

```ts
// src/env.d.ts
/// <reference types="astro/client" />

interface Locals {
  buyer: import('@proxima-io/storefront-core').BuyerProfile | null;
}
```

Desde cualquier página o API route:

```astro
---
// Acceder al buyer desde el middleware
const { buyer } = Astro.locals;
if (!buyer) return Astro.redirect('/login');
---
<p>Hola, {buyer.full_name}!</p>
```

---

## API Routes — Patrones

Cada API route es thin wrapper alrededor de un `process*` helper:

```ts
// src/pages/api/buyer/login.ts
import type { APIRoute } from 'astro';
import {
  processBuyerLogin,
  MissingFieldsError,
  BUYER_AUTH_ERRORS,
  BUYER_COOKIE_NAME,
  BUYER_REFRESH_COOKIE_NAME,
  BUYER_COOKIE_OPTIONS,
} from '@proxima-io/storefront-core';

const env = {
  apiUrl: import.meta.env.PROXIMA_API_URL,
  domain: import.meta.env.PROXIMA_DOMAIN,
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, next } = await request.json();

  try {
    const { access_token, refresh_token, next: redirectTo } =
      await processBuyerLogin(env, { email, password, next });

    cookies.set(BUYER_COOKIE_NAME, access_token, BUYER_COOKIE_OPTIONS);
    if (refresh_token) {
      cookies.set(BUYER_REFRESH_COOKIE_NAME, refresh_token, BUYER_COOKIE_OPTIONS);
    }

    return Response.json({ ok: true, next: redirectTo });
  } catch (e: any) {
    const status = e.status ?? 500;
    const detail = e.data?.detail ?? 'Error inesperado';
    return Response.json({ ok: false, error: detail }, { status });
  }
};
```

El mismo patrón aplica para `register.ts`, `logout.ts`, `cart/add.ts`, etc.
Ver la implementación completa en `examples/storefront-starter/src/pages/api/`.
