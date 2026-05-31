---
name: add-page
description: >
  Agregar una página nueva a un storefront Proxima. Usar cuando: "agregar página de X",
  "crear una página de contacto", "nueva página /promos", "agregar una landing", "el
  comercio necesita una página de Y". Cubre la ruta Astro, la declaración en
  proxima.website.json, el prerender correcto, y el deploy.
---

# Skill: add-page

Agregar una página a un storefront Astro. Una página vive en **hasta 3 lugares**:

```
1. src/pages/<ruta>.astro          — la ruta Astro (thin: prepareStorefrontRoute + PageRouter)
2. proxima.website.json            — la declaración en pages[] (resolver_kind, path, scaffold_sections)
3. PageRouter.astro + una View     — renderiza la composición de ese resolver_kind
```

> En el monorepo Proxima las apps viven en `apps/{slug}/`. En un repo standalone la
> ruta base es la raíz del proyecto (`src/pages/`, `proxima.website.json` en la raíz).
> Adaptá los paths según tu layout.

---

## Decisión 1 — ¿Qué tipo de página? (resolver_kind)

El `resolver_kind` le dice al `PageRouter` qué View montar y cómo resolver la composición.

| Intent del comercio | `resolver_kind` | `path` en manifest | Notas |
|---------------------|-----------------|--------------------|-------|
| Contenido estático editable (landing, FAQ, devoluciones, promos, "gracias") | `content_page` | **requerido** (ej. `/promociones`) | Solo secciones de CMS, sin entidad |
| Listado de catálogo (PLP global) | `product_list` | requerido (ej. `/catalogo`) | Una section `product_listing` con filtros por URL |
| Detalle de producto por slug | `product_detail` | `/producto/{slug}` | Dinámica — resuelve por la entidad de la URL |
| Detalle de categoría por slug | `category_detail` | `/categoria/{slug}` | Dinámica |
| Detalle de marca por slug | `brand_detail` | `/marca/{slug}` | Dinámica |
| Búsqueda | `buyer_search` | `/buscar` | Search es client-side JS |
| Comparador | `product_compare` | `/comparar` | State en JS/localStorage |
| Carrito / checkout | `cart` / `checkout` | `/carrito` / `/checkout` | Estado de usuario (cookies) |
| Auth | `buyer_login`, `buyer_register`, `buyer_password_reset` | `/login`, etc. | Form actions → `/api/buyer/*` |
| Cuenta / pedidos | `buyer_account`, `order_list`, `order_detail` | `/cuenta`, `/pedidos`, `/cuenta/pedidos/{order_id}` | Requieren `buyer_token` |

> El 90% de las páginas nuevas que pide un comercio son **`content_page`** (una landing o página
> informativa). Los resolver_kind de catálogo y commerce ya vienen en el template; rara vez se agregan.

### Mapeo resolver_kind → entidad / View

| resolver_kind | Entidad que resuelve | Param de URL | Fuente de datos |
|---------------|----------------------|--------------|-----------------|
| `content_page`, `product_list`, `buyer_search`, `product_compare` | ninguna (solo CMS + catálogo cacheado) | — | composición de página |
| `product_detail` | producto | `{slug}` | `catalogSource` per-request |
| `category_detail` | categoría | `{slug}` | `catalogSource` per-request |
| `brand_detail` | marca | `{slug}` | `catalogSource` per-request |
| `cart`, `checkout`, `buyer_login`, `buyer_register`, `buyer_account`, `order_list`, `order_detail` | usuario / sesión | cookie `buyer_token` | estado server-side |

---

## Decisión 2 — `prerender` true o false (LA decisión crítica)

| Tipo de página | `prerender` | Por qué |
|----------------|-------------|---------|
| Home `/`, `/catalogo`, `/ofertas`, content_pages estáticas, `/buscar`, `/comparar` | `true` | Contenido del CMS + catálogo, ambos cacheables |
| `/categoria/[slug]`, `/marca/[slug]`, `/producto/[slug]` | **`false`** | Slugs del catálogo del merchant, no del build |
| `/carrito`, `/checkout`, `/login`, `/cuenta`, `/pedidos`, `/cuenta/pedidos/[id]` | **`false`** | Estado del usuario (cookies, sesión) — nunca cacheable |
| `/api/buyer/*` | **`false`** | Rutas API server-side |

**Regla mental:** `prerender = true` solo si el contenido es idéntico para todo visitante
y derivable del CMS/catálogo en build/cache. Si depende del slug de la URL (catálogo del
merchant) o del usuario (cookies), `prerender = false`.

### El gotcha de `[slug]` (bug real, evitalo siempre)

Una ruta dinámica `[slug].astro` **NUNCA** debe ser `prerender = true` con `getStaticPaths()` leyendo de
fixtures. Los slugs son del catálogo del merchant, no fixtures de build-time. Si lo hacés, Astro sirve el
path con 200 pero `Astro.params.slug = ""` → la sección no encuentra la entidad → **página vacía**.

**Fix siempre:** `export const prerender = false` para toda ruta `[slug]` de merchant. Así
`Astro.params.slug` y el `Astro.locals.catalogSource` per-request quedan poblados correctamente.

---

## Paso a paso

### a) Crear la ruta Astro

Las rutas son **thin**: solo llaman `prepareStorefrontRoute` y montan `PageRouter`. Toda la lógica
vive en el PageRouter + la View. Crear `src/pages/<ruta>.astro`:

```astro
---
export const prerender = true; // o false según la Decisión 2

import { prepareStorefrontRoute } from "@/lib/storefront-route";
import PageRouter from "@/router/PageRouter.astro";

const ctx = await prepareStorefrontRoute(Astro);
---

<PageRouter {...ctx} />
```

Para una ruta dinámica, el archivo va en una carpeta con el param entre corchetes
(`src/pages/coleccion/[slug].astro`) y **siempre** `prerender = false` (ver gotcha arriba).

### b) Declarar la página en `proxima.website.json`

Agregar un objeto al array `pages[]`:

```json
{
  "resolver_kind": "content_page",
  "path": "/promociones",
  "label": "Promociones",
  "scaffold_sections": [
    { "section_type": "page_hero", "order": 1, "values": { "title": { "es": "..." } } },
    { "section_type": "product_grid", "order": 2, "values": { "products_collection": { "_": "auto:on_sale_products" } } }
  ]
}
```

Reglas de los `values` del scaffold:
- Texto localizable → `{ "es": "texto" }`
- Valor no-localizable (URL, boolean, número, array, placeholder de SC) → `{ "_": valor }`
- Smart collection → `{ "_": "auto:<placeholder>" }`; el placeholder debe existir en
  `smart_collection_placeholders` del manifest (ej. `featured_products`, `on_sale_products`, `brands`).
  Ver skill `add-smart-collection`.

> El scaffold **solo** aplica cuando la página aún no tiene secciones del comercio. Si la página ya
> existe con contenido del merchant, el deploy no la re-scaffoldea (no pisa contenido).

### c) Si es `content_page` con section types nuevos

Si la página usa una sección que **no existe** en `section_types[]` del manifest, primero hay que
crearla (componente Astro + registro + schema). Eso es otro skill: **`add-section`**. Reutilizá
section types existentes cuando puedas.

### d) Deploy

```bash
proxima deploy {slug}
```

El deploy aplica el manifest a la API: crea/actualiza section types y crea la `Page` con sus
`Section` scaffold. Output esperado incluye `Pages: + created /promociones`.

> **`proxima deploy` vs `proxima template:publish`:** `deploy` aplica el manifest a **un website
> específico** (un comercio). `template:publish` publica el manifest como **plantilla del
> marketplace** (para instanciar en nuevos comercios). Si la página es parte del template base,
> publicar también con `template:publish`.

### e) Verificar

1. La página renderea en `http://<storefront>/<ruta>` (levantar dev: `npm run dev`).
2. `prerender` correcto: una página dinámica `[slug]` debe responder con el slug poblado (probar
   con un slug que **no** esté en fixtures — debe resolver vía API, no quedar vacía).
3. Para auth/cart/checkout: el header `Cache-Control` debe ser `private, no-store` (lo setea
   `prepareStorefrontRoute` según el tipo).
4. La página aparece en el Builder y el comercio puede editar sus secciones.

---

## Ejemplo 1 — content_page estática `/promociones`

**Ruta** `src/pages/promociones.astro`:

```astro
---
export const prerender = true;

import { prepareStorefrontRoute } from "@/lib/storefront-route";
import PageRouter from "@/router/PageRouter.astro";

const ctx = await prepareStorefrontRoute(Astro);
---

<PageRouter {...ctx} />
```

**Manifest** — agregar a `pages[]`:

```json
{
  "resolver_kind": "content_page",
  "path": "/promociones",
  "label": "Promociones",
  "scaffold_sections": [
    {
      "section_type": "deals_page_hero",
      "order": 1,
      "values": {
        "badge_text": { "es": "Campaña" },
        "title_line1": { "es": "Promos" },
        "title_accent": { "es": "del mes" },
        "body": { "es": "Descuentos seleccionados por tiempo limitado." },
        "social_proof": { "es": "Miles de clientes ya aprovecharon" }
      }
    },
    {
      "section_type": "product_grid",
      "order": 2,
      "values": {
        "title": { "es": "En oferta" },
        "products_collection": { "_": "auto:on_sale_products" }
      }
    }
  ]
}
```

Deploy: `proxima deploy {slug}`. Reusa `deals_page_hero` y `product_grid` si ya existen,
así no hace falta crear secciones.

---

## Ejemplo 2 — página dinámica `/coleccion/[slug]` (prerender=false)

**Ruta** `src/pages/coleccion/[slug].astro`:

```astro
---
// Slugs de colección son del catálogo del merchant, no del build. SSR cada request
// para que Astro.params.slug y Astro.locals.catalogSource queden poblados.
export const prerender = false;

import { prepareStorefrontRoute } from "@/lib/storefront-route";
import PageRouter from "@/router/PageRouter.astro";

const ctx = await prepareStorefrontRoute(Astro);
---

<PageRouter {...ctx} />
```

**Manifest** — el `path` usa `{slug}` como placeholder del param:

```json
{
  "resolver_kind": "category_detail",
  "path": "/coleccion/{slug}",
  "label": "Colección",
  "scaffold_sections": [
    {
      "section_type": "category_listing",
      "order": 1,
      "values": {
        "breadcrumb_home_label": { "es": "Inicio" },
        "breadcrumb_catalog_label": { "es": "Catálogo" }
      }
    }
  ]
}
```

La section component (ej. `CategoryListingSection.astro`) lee `Astro.params.slug` como fallback cuando
el override del CMS viene vacío, y resuelve la entidad vía `Astro.locals.catalogSource`.

---

## Gotchas

- **`content_page` REQUIERE `path`** en el manifest. Los resolver_kind de entidad
  (`product_detail`, `category_detail`, `brand_detail`) usan paths con placeholder
  (`/producto/{slug}`); los de commerce/auth tienen path fijo conocido por el PageRouter.
- **`[slug]` NUNCA `prerender = true`** con `getStaticPaths()` de fixtures. Es el bug clásico:
  página vacía porque `Astro.params.slug = ""`. Siempre `prerender = false` en rutas dinámicas.
- **Cache-Control:** auth/cart/checkout deben ser `private, no-store`. Lo setea
  `prepareStorefrontRoute` según el tipo de página — no lo hardcodees, solo elegí el resolver_kind
  correcto.
- **Empty states:** si la página puede no tener datos (categoría sin productos, SC vacía), el
  section component debe `return null` en live y mostrar empty state en `cmsPreview`. Ver el
  patrón en `add-section`.
- **El scaffold no pisa contenido:** si la página ya existe con secciones del merchant, el deploy
  no re-scaffoldea. Para forzar el scaffold inicial, la página debe estar vacía o no existir.
- **Section types deben existir antes:** si el scaffold referencia un `section_type` no declarado
  en `section_types[]`, el deploy falla con error de validación. Declararlo primero (`add-section`).

---

## Skills relacionados

- `add-section` — crear/registrar un section type nuevo (si la página lo necesita).
- `add-smart-collection` — declarar placeholders de catálogo dinámico para los slots de la página.
- `debug-storefront` — si la página queda vacía o no renderea como esperabas.

> Si trabajás dentro del monorepo Proxima, hay docs más detallados: `docs/pages.md` (implementación
> por página, fetches, cookies, checklist de paridad), `docs/architecture.md` (reglas de prerender),
> y `cms-template-lifecycle.md` en proxima-api (deploy / publish / instantiate). Si instalaste este
> skill via `proxima skills install`, este skill es autocontenido y no los necesitás.
