# SEO Skill — Proxima Storefronts

> **Instalación:** `proxima skills install seo` · Golden reference: `apps/214store` en proxima-storefronts.

> **Arquitectura: API-driven + SDK automático.**
> El SEO viene de la API. El SDK lo procesa y genera todos los artefactos.
> Para 1000 websites: cero lógica SEO en el storefront. Solo configurar las variables de entorno y los campos del Website en el admin.

Run `/seo` from any storefront app directory to audit or implement SEO.

---

## Arquitectura completa

```
┌─────────────────────────────────────────────────────────┐
│  PROXIMA API                                            │
│                                                         │
│  cms_page_seo (admin override)      ← highest priority │
│  + resolved_data.entity             ← auto by API      │
│  → _build_entity_seo()                                  │
│  → composition.seo {                                    │
│       meta_title, meta_description, og_image, og_type,  │
│       canonical_url, robots,                            │
│       entity_name, entity_image }                       │
│                                                         │
│  Catalog changes (product/category/brand)               │
│  → catalog_indexnow.py              ← fire-and-forget  │
│  → POST https://api.indexnow.org    ← search engines   │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐  ┌─────────────────────────────────┐
│  SDK             │  │  STOREFRONT (Astro SSR)          │
│  storefront-core │  │                                  │
│                  │  │  resolver.ts → page.seo          │
│  buildPageSeo()  │  │  StorefrontShell.astro           │
│  buildProductJsonLd()  │  → buildPageSeo(page.seo, …)  │
│  buildBreadcrumbJsonLd() │  → <SiteLayout seo={pageSeo}> │
│  buildWebSiteJsonLd()  │                                │
│  buildOrganizationJsonLd() │  ProductDetail.astro       │
│  generateSitemapXml()  │  → buildProductJsonLd()        │
│  generateRobotsTxt()   │  → buildBreadcrumbJsonLd()     │
│  notifyIndexNow()      │                                │
└──────────────────┘  │  CategoryPage / BrandPage        │
                       │  → buildBreadcrumbJsonLd()       │
                       │                                  │
                       │  /sitemap.xml → generateSitemapXml()
                       │  /robots.txt  → generateRobotsTxt()
                       │  /{key}.txt   → IndexNow verify  │
                       │  /api/catalog/webhook → IndexNow │
                       └─────────────────────────────────┘
```

---

## SDK: funciones disponibles

Todas en `@proxima-io/storefront-core`:

| Función | Para qué |
|---|---|
| `buildPageSeo(seoData, website, locale, url)` | Resuelve todos los campos SEO de una página → `PageSeoMeta` |
| `buildWebSiteJsonLd(website)` | JSON-LD `WebSite` global (SearchAction box) |
| `buildOrganizationJsonLd(website)` | JSON-LD `Organization` (requiere `logo_url`) |
| `buildProductJsonLd(product, website)` | JSON-LD `Product` con `Offer`, precio, disponibilidad |
| `buildBreadcrumbJsonLd(items, siteUrl)` | JSON-LD `BreadcrumbList` para cualquier página |
| `generateSitemapXml(website, apiUrl)` | XML completo: content pages + categorías + marcas + productos |
| `generateRobotsTxt(website)` | robots.txt con Disallow privados + Sitemap directive |
| `notifyIndexNow(apiKey, siteUrl, urls)` | Ping directo a IndexNow para URLs específicas |

---

## Flujo SEO por tipo de página

### Meta tags (todas las páginas)

```
API composition.seo
  ↓
resolver.ts: page.seo = composition.seo
  ↓
StorefrontShell.astro:
  const pageSeo = buildPageSeo(page?.seo, website, locale, canonicalUrl)
  → <SiteLayout seo={pageSeo} />
  ↓
SiteLayout.astro renderiza:
  <title>, <meta description>, <link canonical>, <meta robots>
  og:title, og:description, og:url, og:type, og:image, og:site_name, og:locale
  twitter:card, twitter:title, twitter:description, twitter:image, twitter:site
  <link rel="icon">
  JSON-LD: WebSite + Organization (global, en todas las páginas)
```

### Product pages (`/producto/{slug}`)

```
ProductDetail.astro:
  const productJsonLd = buildProductJsonLd(product, website)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { label: "Inicio", href: "/" },
    { label: "Productos", href: "/productos" },
    { label: product.name }
  ], siteUrl)
```

JSON-LD emitido: `Product` (name, sku, brand, price, currency, availability, image) + `BreadcrumbList`

### Category pages (`/categoria/{slug}`)

```
CategoryPage.astro:
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { label: "Inicio", href: "/" },
    { label: "Productos", href: "/productos" },
    { label: category.name, href: basePath }
  ], siteUrl)
```

### Brand pages (`/marca/{slug}`)

```
BrandPage.astro:
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { label: "Inicio", href: "/" },
    { label: "Marcas", href: "/marcas" },
    { label: brand.name, href: basePath }
  ], siteUrl)
```

---

## Archivos requeridos en cada storefront

Estos archivos deben existir. Copiados de `214store`, son genéricos — no requieren cambios:

| Archivo | Función | Cache |
|---|---|---|
| `src/pages/sitemap.xml.ts` | Sitemap dinámico (content pages + categorías + marcas + productos) | 1h CDN + 24h stale |
| `src/pages/robots.txt.ts` | robots.txt con Disallow + Sitemap directive | 24h CDN |
| `src/pages/[indexnow_key].txt.ts` | Verificación de clave IndexNow | 24h CDN |
| `src/pages/api/catalog/webhook.ts` | Webhook para IndexNow desde la API | N/A |

### `src/pages/sitemap.xml.ts` (boilerplate)

```typescript
import type { APIRoute } from "astro";
import { resolveWebsiteOnly } from "@/lib/resolver";
import { generateSitemapXml } from "@proxima-io/storefront-core";

export const GET: APIRoute = async () => {
  try {
    const website = await resolveWebsiteOnly();
    const xml = await generateSitemapXml(
      website,
      import.meta.env.PROXIMA_API_URL ?? "http://localhost:8000"
    );
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    const empty = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
  }
};
```

### `src/pages/robots.txt.ts` (boilerplate)

```typescript
import type { APIRoute } from "astro";
import { resolveWebsiteOnly } from "@/lib/resolver";
import { generateRobotsTxt } from "@proxima-io/storefront-core";

export const GET: APIRoute = async () => {
  try {
    const website = await resolveWebsiteOnly();
    return new Response(generateRobotsTxt(website), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("User-agent: *\nAllow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};
```

---

## Variables de entorno

### Storefront `.env`

```env
# IndexNow — mismo valor que INDEXNOW_API_KEY en la API
# Generar: https://www.bing.com/indexnow  o  usar un UUID random
# Sin este valor, IndexNow se ignora silenciosamente en dev
PROXIMA_INDEXNOW_KEY=tu-clave-aqui

# Webhook secret — mismo valor que STOREFRONT_WEBHOOK_SECRET en la API
PROXIMA_WEBHOOK_SECRET=tu-secret-aqui
```

### Proxima API `.env`

```env
# IndexNow — clave de plataforma. El mismo valor va en PROXIMA_INDEXNOW_KEY de cada storefront.
INDEXNOW_API_KEY=tu-clave-aqui
```

> **Nota:** El mismo `INDEXNOW_API_KEY` se usa para todos los storefronts de la plataforma.
> Cada storefront sirve `GET /{clave}.txt` para verificación. IndexNow lo valida automáticamente.

---

## Configurar SEO en el admin (Website record)

| Campo | Efecto |
|---|---|
| `og_image_url` | Imagen OG por defecto en todas las páginas |
| `favicon_url` | `<link rel="icon">` |
| `twitter_handle` | `twitter:site` (con o sin @) |
| `logo_url` | JSON-LD `Organization.logo` |
| `PageSEO` por página | Override admin: meta_title, meta_description, og_image, robots |

---

## IndexNow: cómo funciona

IndexNow notifica a Bing, Yandex y (cada vez más) Google cuando una URL cambia.
**Es gratis y sin límite práctico.**

```
Producto/Categoría/Marca se crea o edita
  ↓
Proxima API: catalog_indexnow.py  (fire-and-forget)
  1. Consulta dominios publicados del business en DB
  2. POST https://api.indexnow.org/indexnow
     { host, key, keyLocation, urlList }
  ↓
Buscadores recrawlan en segundos ⚡ (vs. días con sitemap)
```

Para que funcione en producción: setear `INDEXNOW_API_KEY` en la API y `PROXIMA_INDEXNOW_KEY` en cada storefront.

---

## Audit Checklist

```bash
# Meta tags en home
curl -s http://tustore.localhost/ | grep -E '<title|og:|twitter:|canonical|robots|icon'

# robots.txt
curl -s http://tustore.localhost/robots.txt

# sitemap (debe tener URLs reales)
curl -s http://tustore.localhost/sitemap.xml | grep '<loc>' | wc -l

# IndexNow key verification
curl -s http://tustore.localhost/{PROXIMA_INDEXNOW_KEY}.txt
# debe retornar el mismo valor de la clave

# Product JSON-LD
curl -s http://tustore.localhost/producto/{slug} | grep -A5 '"@type":"Product"'

# Breadcrumbs JSON-LD en categoría
curl -s http://tustore.localhost/categoria/{slug} | grep 'BreadcrumbList'
```

### Checks por tipo de página

| Página | Esperado |
|---|---|
| Home `/` | title=`{website.name}`, og:type=`website`, JSON-LD WebSite+Organization |
| Producto | title=`{product.name} \| {website.name}`, og:type=`product`, og:image=product, JSON-LD Product+BreadcrumbList |
| Categoría | title=`{category.name} \| {website.name}`, JSON-LD BreadcrumbList |
| Marca | title=`{brand.name} \| {website.name}`, JSON-LD BreadcrumbList |
| `/robots.txt` | Disallow /cuenta /carrito /checkout /api/ /dev/, Sitemap directive |
| `/sitemap.xml` | Home priority 1.0, categorías 0.8, marcas 0.7, productos 0.9 |

---

## Implementar SEO en un nuevo storefront

1. **Copiar estos archivos de `214store` sin cambios:**
   - `src/layouts/SiteLayout.astro`
   - `src/views/StorefrontShell.astro`
   - `src/pages/sitemap.xml.ts`
   - `src/pages/robots.txt.ts`
   - `src/pages/[indexnow_key].txt.ts`
   - `src/pages/api/catalog/webhook.ts`

2. **En `ProductDetail.astro`**, importar del SDK:
   ```typescript
   import { buildProductJsonLd, buildBreadcrumbJsonLd } from "@proxima-io/storefront-core";
   const productJsonLd = buildProductJsonLd(product, website);
   const breadcrumbJsonLd = buildBreadcrumbJsonLd([...], siteUrl);
   ```

3. **En `CategoryPage.astro` y `BrandPage.astro`**, importar del SDK:
   ```typescript
   import { buildBreadcrumbJsonLd } from "@proxima-io/storefront-core";
   const breadcrumbJsonLd = buildBreadcrumbJsonLd([...], siteUrl);
   ```

4. **Variables de entorno** (`.env` del storefront):
   ```env
   PROXIMA_INDEXNOW_KEY=mismo-valor-que-INDEXNOW_API_KEY-en-la-API
   PROXIMA_WEBHOOK_SECRET=mismo-valor-que-STOREFRONT_WEBHOOK_SECRET-en-la-API
   ```

5. **En el admin / API**, configurar en el Website record:
   - `og_image_url`, `favicon_url`, `twitter_handle`, `logo_url`

Eso es todo. El SDK hace el resto automáticamente.

---

## Solución de problemas

| Síntoma | Causa | Fix |
|---|---|---|
| og:image genérica en todas las páginas | `website.og_image_url` no seteado | Setear en admin |
| Title muestra solo `website.name` en PDP | `composition.seo.entity_name` vacío | Verificar `_build_entity_seo()` en la API |
| Sitemap vacío | API offline o `website.pages` vacío | Modo live + website manifest deployado |
| `/{key}.txt` retorna 404 | `PROXIMA_INDEXNOW_KEY` no seteado o no coincide | Verificar env var |
| IndexNow no dispara | `INDEXNOW_API_KEY` no seteado en la API | Setear en API .env |
| BreadcrumbList no aparece en SERP | JSON-LD malformado | Validar en https://validator.schema.org |
