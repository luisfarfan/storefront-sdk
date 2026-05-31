# CatalogSource — patrón de data access para storefronts Proxima

Abstracción canónica para que un storefront sirva catálogo (categorías, marcas, productos) desde fixtures (template demo) o API real (merchant website) sin acoplar componentes al modo.

Creado en `tech-store` (Mayo 2026). Apto para adoptar en cualquier storefront del SDK.

Relacionados:
- Arquitectura general: `proxima-storefronts/docs/architecture.md`
- SDK helpers usados: `proxima-storefronts/docs/sdk-helpers.md`
- Schema CMS website: `proxima-api/docs/cms-website-structure.md`

---

## 1. El problema

Hasta hoy, `tech-store` (y antes `214store`, `nocturna`) servían su catálogo importando arrays hardcodeados:

```ts
// El anti-patrón que estamos enterrando
import { BRANDS, CATEGORIES, PRODUCTS } from "@/lib/fixture-catalog";
```

Esto funcionaba bien para el demo de marketplace (`*.templates.proxima.pe`) — los fixtures son el dataset oficial del template. Pero el mismo storefront también corre detrás del dominio de un comercio real (`tienda-de-juan.com`), y ahí el problema explota:

1. **Fixtures filtrándose en modo live.** El home, las listas, el PDP renderizaban GPUs RTX 4090 a un comercio que vende ropa infantil. El catálogo real del merchant (en la API de Proxima) nunca entraba en juego.
2. **Componentes acoplados al shape del fixture.** Las cards leían `p.glow`, `p.glyph`, `p.kind` directamente del JSON estático; no había manera de inyectar otro origen sin romper el render.
3. **Sin per-request scope.** Aún reemplazando los arrays por un fetch a la API, una sola variable de módulo no alcanza: cada request resuelve un `business_id` distinto (cada subdominio de merchant es un tenant), y no se pueden compartir caches entre comercios.

Lo que queremos: un único punto de acceso a catálogo, resuelto por request, con dos implementaciones intercambiables detrás de la misma interfaz. Fixtures para demos del marketplace, API real para websites del comercio. Los componentes no saben (ni les importa) cuál están usando.

---

## 2. La interfaz `CatalogSource`

Tres ejes — `categories`, `brands`, `products` — más helpers de síntesis y de variantes. Lookups por slug que ya tienen los datos pre-cargados son síncronos; búsquedas de producto son async porque en live cada una es un fetch.

```ts
// src/lib/catalog/types.ts

export interface CatalogSource {
  mode: "fixtures" | "live";

  categories: {
    all: Category[];
    tree: CategoryNavNode[];
    bySlug(slug: string): Category | undefined;
    name(slug: string): string;
  };

  brands: {
    all: Brand[];
    bySlug(slug: string): Brand | undefined;
    name(slug: string): string;
  };

  products: {
    bySlug(slug: string): Promise<Product | undefined>;
    byCategory(slug: string): Promise<Product[]>;
    byBrand(slug: string): Promise<Product[]>;
    bestSellers(): Promise<Product[]>;
    onSale(): Promise<Product[]>;
    featured(): Promise<Product[]>;
    relatedFor(slug: string): Promise<Product[]>;
  };

  /** Synthesize storefront-side reviews from a product — same logic in both modes. */
  reviewsFor(p: Product): Review[];
  /** Synthesize storefront-side rating breakdown from a product. */
  breakdown(p: Product): number[];

  /** Variant lookups — needed by add-to-cart from listing cards. */
  variantIdForSlug(slug: string): Promise<number | undefined>;
  slugForVariantId(variantId: number): Promise<string | undefined>;
}
```

Decisiones clave:

- **`mode` expuesto.** Un componente que de veras necesite cambiar comportamiento (por ejemplo, ocultar un CTA si está en modo fixtures porque la cart no funciona) puede leer `catalog.mode`. Pero esto debe ser raro — el 99% del código debe ser mode-agnostic.
- **Lookups por slug sync.** `categories.bySlug`, `brands.bySlug`, `categories.name`, `brands.name` devuelven datos ya cargados. En live, el constructor del source pre-fetchea las dos directorios completos. Permite que los templates Astro hagan `catalog.categories.name(slug)` sin un `await`.
- **Productos siempre async.** En fixtures la promesa resuelve sync-ish, pero la firma es `Promise<…>` para que el mismo `await catalog.products.bySlug(slug)` sirva en ambos modos.
- **Helpers de síntesis inline (`reviewsFor`, `breakdown`).** Ambos modos comparten la misma lógica de generar reviews fake y breakdown de rating. Vive en `synth.ts`, exportado por la interfaz para que los componentes no tengan que importar de dos lados.
- **Variant lookups separados.** El cart trabaja con `variant_id`, no con `slug`. Los listing cards solo conocen el slug. La interfaz expone el mapeo para que el botón add-to-cart funcione sin pedirle al template que recuerde de dónde sacar el id.

El `Product`/`Brand`/`Category` shape es **de cada storefront**, no del SDK. Tech-store tiene `glow`, `glyph`, `kind`, `bestSeller` porque su UI los necesita. Otro storefront tendrá los suyos. El `CatalogSource` no impone el shape — solo lo distribuye.

---

## 3. Distribución vía `Astro.locals`

Astro provee un objeto `Astro.locals` por request. El middleware (o, en `tech-store`, el helper `prepareStorefrontRoute`) resuelve el source una vez al inicio del request y lo guarda ahí:

```ts
// env.d.ts — declarar el slot en App.Locals

declare namespace App {
  interface Locals {
    catalogSource?: import("@/lib/catalog").CatalogSource;
  }
}
```

Importante: la declaración usa `import(...)` inline en vez de `import` top-level. Un `import` top-level convierte este archivo en un módulo y el `namespace App` deja de mergear con el de Astro. Mantenerlo como ambient declaration es lo que permite que `App.Locals.catalogSource` exista globalmente.

Wire-up en el middleware:

```ts
// src/lib/storefront-route.ts (extracto)

if (!astro.locals.catalogSource) {
  const env = getProximaEnv(import.meta.env);
  astro.locals.catalogSource = await resolveCatalogSource({
    mode: resolved.dataMode,
    baseUrl: env.baseUrl ?? "",
    businessId: String(resolved.website.business_id ?? ""),
    locale: resolved.website.locale ?? "es",
    currency: resolved.website.currency ?? "PEN",
  });
}
```

Reglas:

- **Una sola resolución por request.** El `if (!astro.locals.catalogSource)` protege contra doble-init si dos layers del middleware llaman al helper.
- **Componentes leen, no inicializan.** Dentro de un `.astro`: `const catalog = Astro.locals.catalogSource;` — y siempre con `?.` porque en error paths (404, 500) el middleware puede no haber corrido.
- **Helpers `.ts` puros reciben el source por argumento.** Funciones que viven fuera de Astro (mappers, builders de composición) no tienen acceso a `Astro.locals`. Reciben `CatalogSource` como param explícito.

---

## 4. Las dos implementaciones

### 4.1 `FixturesCatalogSource`

Envuelve los JSON estáticos del storefront (`src/fixtures/catalog-items.json`, `src/fixtures/category-nav-tree.json`). Constructor sync — los fixtures se cargan en memoria al bundle time y se reutilizan en cada request.

```ts
// src/lib/catalog/fixtures-source.ts (extracto)

export function createFixturesCatalogSource(): CatalogSource {
  return {
    mode: "fixtures",

    categories: {
      all: CATEGORIES,
      tree: NAV_TREE_NODES,
      bySlug: (slug) => categoriesBySlug.get(slug),
      name: (slug) => categoriesBySlug.get(slug)?.name ?? slug,
    },

    brands: {
      all: BRANDS,
      bySlug: (slug) => brandsBySlug.get(slug),
      name: (slug) => brandsBySlug.get(slug)?.name ?? slug.toUpperCase(),
    },

    products: {
      bySlug: async (slug) => getProduct(slug),
      byCategory: async (cat) => PRODUCTS.filter((p) => p.cat === cat),
      byBrand: async (brand) => PRODUCTS.filter((p) => p.brand === brand),
      bestSellers: async () =>
        PRODUCTS.filter((p) => p.bestSeller > 0).sort((a, b) => a.bestSeller - b.bestSeller),
      onSale: async () => PRODUCTS.filter((p) => p.oldPrice !== null),
      featured: async () => [/* slugs curados */].map(getProduct).filter(Boolean) as Product[],
      relatedFor: async (slug) => {
        const item = bySlug.get(slug);
        const ui = item ? uiMeta(item) : {};
        const slugs = Array.isArray(ui.related_slugs)
          ? (ui.related_slugs as string[])
          : [/* defaults */];
        return slugs.map(getProduct).filter(Boolean) as Product[];
      },
    },

    reviewsFor,
    breakdown,

    variantIdForSlug: async (slug) => {
      const item = bySlug.get(slug);
      const id = Number(item?.default_variant_id);
      return Number.isFinite(id) ? id : undefined;
    },
    slugForVariantId: async (variantId) => {
      for (const item of CATALOG) {
        if (Number(item.default_variant_id) === variantId) return String(item.slug);
      }
      return undefined;
    },
  };
}
```

Usado para:

- Demos del marketplace en `*.templates.proxima.pe` (sin API call, resiliente a caídas).
- Build-time prerender de páginas estáticas (ver §7 sobre `output: "static"`).
- Tests unitarios de componentes.

El módulo también exporta `PRERENDER_PRODUCT_SLUGS`, `PRERENDER_CATEGORY_SLUGS`, `PRERENDER_BRAND_SLUGS` como arrays sync para `getStaticPaths()` durante `astro build` (cuando todavía no hay `Astro.locals`).

### 4.2 `LiveCatalogSource`

Async factory. Pre-fetchea categorías + marcas una vez por request; los productos se piden bajo demanda.

```ts
// src/lib/catalog/live-source.ts (extracto)

export async function createLiveCatalogSource(cfg: LiveSourceConfig): Promise<CatalogSource> {
  // Prefetch categories + brands once per request — they back all sync lookups.
  const [tree, brandsRes] = await Promise.all([
    fetchCategoryNavTree(sdkConfig(cfg), sdkWebsite(cfg), { maxDepth: 3 }),
    fetchBrandsDirectory(sdkConfig(cfg), sdkWebsite(cfg)),
  ]);

  const categoriesAll = flattenTree(tree.nodes);
  const categoriesBySlug = new Map(categoriesAll.map((c) => [c.slug, c]));

  const brandsAll = brandsRes.items.map(brandToLocal);
  const brandsBySlug = new Map(brandsAll.map((b) => [b.slug, b]));

  return {
    mode: "live",
    categories: { all: categoriesAll, tree: tree.nodes, bySlug: (s) => categoriesBySlug.get(s), name: (s) => categoriesBySlug.get(s)?.name ?? s },
    brands: { all: brandsAll, bySlug: (s) => brandsBySlug.get(s), name: (s) => brandsBySlug.get(s)?.name ?? s.toUpperCase() },
    products: {
      bySlug: (slug) => fetchProductBySlug(cfg, slug),
      byCategory: async (slug) => {
        const res = await fetchCategoryProducts(sdkConfig(cfg), sdkWebsite(cfg), { slug, page: 1, page_size: 24 });
        return res.items.map(summaryToProduct);
      },
      byBrand: async (slug) => {
        const res = await fetchBrandProducts(sdkConfig(cfg), sdkWebsite(cfg), { slug, page: 1, page_size: 24 });
        return res.items.map(summaryToProduct);
      },
      bestSellers: () => listing(cfg, {}, "newest", 12),
      onSale: () => listing(cfg, {}, "newest", 12),
      featured: () => listing(cfg, {}, "newest", 4),
      relatedFor: async (slug) => {
        const product = await fetchProductBySlug(cfg, slug);
        if (!product?.cat) return [];
        const sameCategory = await listing(cfg, { category: product.cat }, "newest", 8);
        return sameCategory.filter((p) => p.slug !== slug).slice(0, 4);
      },
    },
    reviewsFor,
    breakdown,
    variantIdForSlug: async (slug) => (await fetchProductBySlug(cfg, slug))?.variantId,
    slugForVariantId: async () => undefined, // reverse lookup needs dedicated endpoint
  };
}
```

Headers de autenticación — toda llamada lleva `X-Business-ID` y `Accept-Language`:

```ts
function headers(cfg: LiveSourceConfig): Record<string, string> {
  return {
    "X-Business-ID": cfg.businessId,
    "Accept-Language": cfg.locale,
  };
}
```

Endpoints SDK que toca:

| Operación | Helper / endpoint |
|---|---|
| Categorías (tree) | `fetchCategoryNavTree` (`GET /storefront/categories/nav-tree`) |
| Marcas (directory) | `fetchBrandsDirectory` (`GET /storefront/brands`) |
| Productos por categoría | `fetchCategoryProducts` (`GET /storefront/categories/{slug}/products`) |
| Productos por marca | `fetchBrandProducts` (`GET /storefront/brands/{slug}/products`) |
| Listing genérico | `fetchProductListing` (`GET /storefront/products`) |
| Producto por slug | `fetch` directo a `GET /api/v1/storefront/products/{slug}` (sin SDK helper aún) |

#### Mapper layer

Cada endpoint devuelve un shape distinto y hay que reducirlo al `Product` local. Tres mappers:

- **`summaryToProduct`** — de `StorefrontProductSummary` (lo que devuelven los listings). Shape ligero, sin specs ni descripción. Defaults sensatos para campos UI (`glow`, `glyph`, `kind`).
- **`detailToProduct`** — de la respuesta cruda de `/products/{slug}`. Incluye specs, variantes, description. Trata `image_url` como string (lo nuevo) o `{small,medium,large}` (fallback fixtures).
- **`apiCompositionItemToProduct`** — si tu storefront además consume el composition envelope del CMS (resolver de smart collections), conviene tener un mapper desde los items resueltos del envelope. Vive junto a los otros porque comparte defaults.

```ts
// Extracto: summaryToProduct
function summaryToProduct(s: StorefrontProductSummary): Product {
  return {
    id: `p${s.id}`,
    slug: s.slug,
    name: s.name,
    brand: deriveBrandSlug(s.brand_name ?? ""),
    cat: deriveCategorySlug(s.category_name ?? ""),
    kind: "gpu",
    price: s.price,
    oldPrice: null,
    rating: s.rating ?? 0,
    reviews: 0,
    stock: 0,
    sold: 0,
    badge: s.badge ?? null,
    bestSeller: 0,
    free: true,
    warranty: "12 meses",
    images: 1,
    glow: "rgba(255,255,255,.1)",
    glyph: "gpu",
    spec: "",
    sku: s.slug,
    specs: [],
    desc: "",
    variantId: s.default_variant_id ?? undefined,
    imageUrl: s.image_url,
  };
}
```

Nota sobre slugs: la API summary devuelve `brand_name` y `category_name` como strings localizados, no slugs. `deriveBrandSlug` los normaliza (`"NVIDIA Corp"` → `"nvidia-corp"`). No es perfecto — si la marca de verdad tiene un slug oficial distinto, el listing y el `bySlug` pueden divergir. Cuando la API exponga `brand_slug` / `category_slug` en el summary, swap.

---

## 5. Reglas para componentes

### 5.1 En `.astro`

```astro
---
const catalog = Astro.locals.catalogSource;
const categoryName = catalog?.categories.name(slug) ?? slug;
const products = (await catalog?.products.byCategory(slug)) ?? [];
---

<h1>{categoryName}</h1>
{products.map(p => <ProductCard product={p} />)}
```

Reglas:

- Siempre `?.` — `Astro.locals.catalogSource` puede ser `undefined` en error paths.
- `await` directo en frontmatter Astro. No hace falta `Astro.props` ni nada extra.
- Fallback razonable después del `??` — el render no debe romper si el catálogo no resolvió.

### 5.2 En helpers `.ts`

Reciben el source como parámetro explícito:

```ts
// src/lib/builders/home-composition.ts
export async function buildHomeComposition(
  catalog: CatalogSource,
  websiteSlug: string,
): Promise<Composition> {
  const featured = await catalog.products.featured();
  // …
}
```

No importes `Astro.locals` desde fuera de Astro — no existe. Si un helper necesita el source, el caller (un `.astro`) lo pasa.

### 5.3 Mode-agnostic por default

Los componentes nunca deben hacer ramificación por `catalog.mode` salvo razón muy fuerte (un toast del builder diciendo "modo demo", por ejemplo). El shape `Product` es idéntico en ambos modos; cualquier campo faltante en live llega con un default. Si te tienta `if (catalog.mode === "fixtures")`, considera si el default del mapper no resuelve el caso.

### 5.4 Builder / CMS preview

El builder de Proxima abre el storefront en un iframe con `?cms_preview=1`. En ese contexto **siempre se sirve la composición que el usuario está editando** (no la guardada, no la del merchant en live). El `CatalogSource` para preview debe ser el mismo del modo en el que ya estás (fixtures si es template demo, live si es merchant): el preview solo cambia la fuente de composición, no la del catálogo. No pisar el catálogo del comercio.

---

## 6. Adoptar el patrón en un storefront nuevo

Pasos concretos (~30 min para un storefront pequeño, ~2-3h con un montón de componentes que limpiar):

### 6.1 Crear `src/lib/catalog/`

Copia los cinco archivos del `tech-store`:

```
src/lib/catalog/
  ├── types.ts            # interface CatalogSource, Product, Brand, Category
  ├── synth.ts            # reviewsFor, breakdown
  ├── fixtures-source.ts  # createFixturesCatalogSource()
  ├── live-source.ts      # createLiveCatalogSource()
  └── index.ts            # resolveCatalogSource(), re-exports
```

### 6.2 Ajustar `Product` / `Brand` / `Category`

Cada storefront tiene campos UI distintos. Edita `types.ts` con los que tu UI necesita. Ejemplos:

- `tech-store` tiene `glow`, `glyph`, `kind`, `bestSeller`, `spec`.
- Un storefront fashion podría necesitar `colors[]`, `sizes[]`, `materialTags`.
- Un storefront food podría necesitar `weight`, `caloriesPer100g`, `dietary`.

Los nombres y tipos quedan dentro del storefront — no son contrato con la API.

### 6.3 Adaptar mappers en live-source

`summaryToProduct` y `detailToProduct` son los puntos donde se traduce la respuesta del backend al `Product` local. Cualquier campo UI nuevo en tu `Product` necesita o (a) llegar de la API y mapearse, o (b) un default sensato dentro del mapper.

Si tu storefront persiste datos extra en `ui_meta` del producto (vía el flow de `proxima.website.json` + manifest), el detailToProduct puede leerlos:

```ts
const ui = (d.ui_meta as Record<string, unknown>) ?? {};
return {
  // ...
  glow: String(ui.glow ?? "rgba(255,255,255,.1)"),
  kind: String(ui.kind ?? "default"),
};
```

### 6.4 Wire el middleware

En `prepareStorefrontRoute` (o el equivalente en tu storefront — algunos usan `src/middleware.ts` puro):

```ts
import { resolveCatalogSource } from "@/lib/catalog";

if (!astro.locals.catalogSource) {
  const env = getProximaEnv(import.meta.env);
  astro.locals.catalogSource = await resolveCatalogSource({
    mode: resolved.dataMode,
    baseUrl: env.baseUrl ?? "",
    businessId: String(resolved.website.business_id ?? ""),
    locale: resolved.website.locale ?? "es",
    currency: resolved.website.currency ?? "PEN",
  });
}
```

`resolved.dataMode` viene de `getDataMode()` (revisa `proxima-storefronts/docs/architecture.md` §data-mode-resolution): combina `PROXIMA_DATA_MODE` env, el `data_mode` del website, y la allowlist de hosts de template-demo.

### 6.5 Declarar `Astro.locals`

```ts
// env.d.ts
declare namespace App {
  interface Locals {
    catalogSource?: import("@/lib/catalog").CatalogSource;
  }
}
```

Mantén el `import(...)` inline. No agregues `import` top-level a este archivo o la augmentation deja de mergear.

### 6.6 Refactor componentes

Patrón de migración (mecánico):

```diff
---
- import { PRODUCTS, CATEGORIES, BRANDS } from "@/lib/fixture-catalog";
- const products = PRODUCTS.filter(p => p.cat === slug);
+ const catalog = Astro.locals.catalogSource;
+ const products = (await catalog?.products.byCategory(slug)) ?? [];
---
```

```diff
- const brandName = BRANDS.find(b => b.slug === slug)?.name ?? slug;
+ const brandName = Astro.locals.catalogSource?.brands.name(slug) ?? slug;
```

### 6.7 Bulk find-replace para los type-only imports

Los componentes importaban `import type { Product } from "@/lib/fixture-catalog"`. Ahora viven en `@/lib/catalog`:

```bash
# Desde la raíz del storefront
grep -rl '"@/lib/fixture-catalog"' src/ \
  | xargs sed -i '' 's|"@/lib/fixture-catalog"|"@/lib/catalog"|g'
```

Verifica con `tsc --noEmit` que nada quedó importando del módulo viejo. El `fixture-catalog.ts` original puede borrarse una vez que el dataset migró a `src/fixtures/*.json` y los componentes ya leen del source.

---

## 7. Gotchas que ya descubrimos

### 7.1 `output: "static"` + `prerender = true` + merchant mode

Si una página `[slug].astro` tiene `export const prerender = true` y define `getStaticPaths()` desde fixtures, en build solo se generan los slugs del fixture. Cuando el storefront corre detrás de un merchant con slugs reales distintos (`/categoria/zapatillas` cuando el fixture solo tiene `gpus`), Astro renderiza con `Astro.params.slug = ""` o tira 404 según la config.

**Solución:** poner `export const prerender = false` en las páginas dinámicas (`[slug].astro` de categoría/marca/producto) cuando el storefront tiene la posibilidad de correr en merchant mode. El home y rutas estáticas pueden quedarse prerenderizadas.

### 7.2 Cache TTL de Redis después de mutaciones

La API cachea respuestas del storefront (composiciones, nav tree) en Redis bajo claves `cms:comp:*` y similares con TTL ~60s. Después de un PATCH a una section o un redeploy del manifest, el storefront sigue viendo la versión vieja hasta que expira.

**Mitigación durante desarrollo:** flush manual de Redis tras cambios estructurales:
```bash
redis-cli --scan --pattern 'cms:comp:*' | xargs redis-cli del
```

**Producción:** la API debería invalidar esas keys al final del use case de mutación. Si tu feature mete una nueva ruta cacheada, agrega su invalidation.

### 7.3 `image_url` viene como string, no objeto

La API actual devuelve `image_url: string` en summaries y en el detail. Los fixtures viejos del tech-store tenían `image_url: { small, medium, large }`. `detailToProduct` cubre ambos casos pero si tu mapper no lo hace, vas a obtener `[object Object]` renderizado en las cards.

```ts
const imageUrlStr =
  typeof d.image_url === "string"
    ? d.image_url
    : d.image_url && typeof d.image_url === "object"
      ? String(
          ((d.image_url as Record<string, string>).medium ??
            (d.image_url as Record<string, string>).large ??
            (d.image_url as Record<string, string>).small) || "",
        )
      : "";
```

### 7.4 `brand` en summary es solo `brand_name`

`StorefrontProductSummary.brand_name` es el string localizado de la marca. No viene `brand_slug`. El mapper lo deriva con `deriveBrandSlug(name)` (lowercase + normalize + replace). Si el comercio tiene marcas con caracteres raros o el slug oficial difiere de la slugificación naïve, vas a ver desalineación entre el listing y los `bySlug` lookups.

Workaround temporal: confiar en el slug derivado. Solución real: pedirle a la API que devuelva `brand_slug` y `category_slug` en el summary.

### 7.5 Productos sin imagen en `images[]` pero con `image_url`

Algunos productos vienen con `images: []` (galería vacía) pero sí tienen `image_url` poblado (la imagen principal). El mapper fuerza `images: imagesArr.length || (imageUrlStr ? 1 : 0)` para que la galería del PDP haga fallback al `image_url` único y no renderice un "0 imágenes".

### 7.6 `slugForVariantId` en live no tiene endpoint

El reverse lookup `variantId → slug` no existe en la API. `LiveCatalogSource.slugForVariantId` devuelve `undefined` siempre. Los flows que lo necesitaban (recovery de cart desde solo variant_id) deben persistir el slug al `addToCart` y guardarlo junto al variant_id en el cart state.

---

## 8. Roadmap / mejoras pendientes

- **`slugForVariantId` en live mode.** Requiere endpoint dedicado en la API (`GET /storefront/variants/{id}/product` o similar). No existe — Lucho Tech case.
- **`bestSellers` real.** Hoy es proxy de `newest`. Cuando la API tenga el endpoint de top sellers (ranking por orders del último N), swap directo en `live-source.ts`.
- **`onSale` real.** Mismo proxy de `newest`. Necesita filtro `?on_sale=true` o sort `discount_pct desc`.
- **`featured` real.** Hoy es `newest` con `page_size: 4`. Mejor: consumir una smart collection canónica del website (slot `featured`) que el comercio puede curar desde el admin.
- **`brand_slug` / `category_slug` en `StorefrontProductSummary`.** Quita el `deriveBrandSlug` y elimina toda la desalineación entre listing y lookup.
- **SDK helper para `GET /products/{slug}`.** Hoy `fetchProductBySlug` hace `fetch` raw. Mover a `@proxima-io/storefront-core` cuando el SDK exponga el helper.
- **Cache invalidation hooks en la API.** Para que el TTL de 60s deje de ser el "race condition oficial" después de cada deploy/patch.

---

## Resumen mental

> Una interfaz (`CatalogSource`). Dos implementaciones (fixtures, live). Un slot por request (`Astro.locals.catalogSource`). Componentes que no saben en qué modo están. El día que aparezca un tercer backend (mock E2E, GraphQL, file system local), es otra factory más detrás del mismo `resolveCatalogSource`.
