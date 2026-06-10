# 05 — Smart Collections

Datos dinámicos auto-resueltos en la composición. El comercio los configura; tú los renderizas.

> **Nota:** este doc cubre la API canónica de SCs (tipos, envelope, render).
> Para el envelope **runtime completo** (campos `meta.inactive`, `schedule`,
> `applied_promotion` en items, linked-Promotion countdown) ver el doc
> definitivo en [12-smart-collections.md](./12-smart-collections.md). Para
> campañas (Promotions) que alimentan `applied_promotion` en los items, ver
> [07-commerce.md](./07-commerce.md) § "Campañas y `applied_promotion`" y el
> patrón completo en [04-sections-and-attributes.md](./04-sections-and-attributes.md)
> § "Campaign auto-detect".

---

## ¿Qué es una Smart Collection?

Una Smart Collection es una **query guardada** que el comercio configura en el builder.
Cuando el storefront pide la composición, la API resuelve cada smart collection y
embebe el resultado directamente en el `attributes` de la sección correspondiente.

El developer recibe datos en **`section.values.{name}`** (o como props explícitos desde `SectionRenderer`).

---

## Los 6 tipos

| Tipo | Qué devuelve |
|------|-------------|
| `product_list` | Lista de productos según filtros |
| `category_list` | Árbol de categorías |
| `brand_list` | Lista de marcas |
| `banner` | Una entidad promocionada (producto, categoría o marca) |
| `manual` | Lista curada a mano |
| `search_preview` | Productos que coinciden con un query fijo |

---

## Estructura de la respuesta

```ts
interface SmartCollectionResult {
  type: 'product_list' | 'category_list' | 'brand_list' | 'banner' | 'manual' | 'search_preview';
  items: SmartCollectionItem[];
  meta: {
    limit: number;
    returned: number;
    total?: number;
    truncated?: boolean;
    count: number;
  };
}
```

---

## `product_list` — Renderizar una grilla de productos

El caso más común. El comercio configura: categoría, marca, precio, stock, ordenamiento, límite.

```astro
---
// src/sections/ProductGridSection.astro
const { products } = section.values;
// products: SmartCollectionResult con type="product_list"

// Cada item del product_list:
// { id, slug, name, price, price_formatted, image, brand_name,
//   category_name, badge, rating, currency, default_variant_id }
---
<EditableSection {section}>
  <section class="product-grid">
    <div class="product-grid__items">
      {(products?.items ?? []).map(product => (
        <ProductCard {product} />
      ))}
    </div>
    {products?.meta?.truncated && (
      <a href="/productos" class="product-grid__see-all">
        Ver los {products.meta.total} productos →
      </a>
    )}
  </section>
</EditableSection>
```

```astro
---
// src/components/ProductCard.astro
import WishlistButton from './WishlistButton.astro';
import type { StorefrontProductSummary } from '@proxima-io/storefront-core';

interface Props {
  product: StorefrontProductSummary;
}
const { product } = Astro.props;
---
<article class="product-card">
  <a href={`/producto/${product.slug}`}>
    <div class="product-card__image-wrap">
      <img src={product.image_url} alt={product.name} loading="lazy" />
      {product.badge && <span class="product-card__badge">{product.badge}</span>}
    </div>
    <div class="product-card__info">
      {product.brand_name && <p class="product-card__brand">{product.brand_name}</p>}
      <h3 class="product-card__name">{product.name}</h3>
      <p class="product-card__price">{product.price_formatted}</p>
    </div>
  </a>
  <button
    class="product-card__add-to-cart"
    data-variant-id={product.default_variant_id}
  >
    Agregar al carrito
  </button>
  <WishlistButton productId={product.id} client:idle />
</article>
```

---

## `category_list` — Grilla de categorías

```astro
---
const { categories } = section.values;
// Cada item: { id, slug, name, image_url, parent_id }
---
<div class="category-grid">
  {(categories?.items ?? []).map(cat => (
    <a href={`/categoria/${cat.slug}`} class="category-card">
      {cat.image_url && <img src={cat.image_url} alt={cat.name} />}
      <span>{cat.name}</span>
    </a>
  ))}
</div>
```

---

## `brand_list` — Grilla de marcas

```astro
---
const { brands } = section.values;
// Cada item: { id, slug, name, logo_url }
---
<div class="brand-grid">
  {(brands?.items ?? []).map(brand => (
    <a href={`/marca/${brand.slug}`} class="brand-logo">
      {brand.logo_url
        ? <img src={brand.logo_url} alt={brand.name} />
        : <span>{brand.name}</span>
      }
    </a>
  ))}
</div>
```

---

## `banner` — Entidad promocionada

```astro
---
const { featured } = section.values;
// featured: { type: "banner", items: [{ entity_type, entity_id, cta_text, cta_href, image_override, ...entity_data }] }
const banner = featured?.items?.[0];
---
{banner && (
  <div class="banner" style={banner.image_override ? `background-image: url(${banner.image_override})` : ''}>
    <h2>{banner.name}</h2>
    <a href={banner.cta_href ?? `/${banner.entity_type}/${banner.slug}`}>
      {banner.cta_text ?? 'Ver más'}
    </a>
  </div>
)}
```

---

## `manual` — Lista curada

Mezcla de productos, categorías y marcas elegidos manualmente:

```astro
---
const { picks } = section.values;
// picks.items: [{ type: "product" | "category" | "brand", ...entity_data }]
---
{(picks?.items ?? []).map(item => (
  <div>
    {item.type === 'product' && <ProductCard product={item} />}
    {item.type === 'category' && <CategoryCard category={item} />}
    {item.type === 'brand' && <BrandCard brand={item} />}
  </div>
))}
```

---

## Smart Collections + paginación client-side

La composición entrega los primeros N items (configurable en la colección, default 8–24).
Si el comercio quiere mostrar más items sin recargar la página, el storefront hace
paginación client-side con las funciones del SDK:

```astro
---
// src/sections/CategoryProductsSection.astro
// Esta sección recibe los primeros productos via smart collection
// y los usuarios pueden paginar client-side sin perder el SSR inicial

const { products } = section.values;
---
<EditableSection {section}>
  <div
    class="category-products"
    data-category-slug={Astro.props.resolvedData?.category?.slug}
  >
    <!-- SSR: primeros productos de la smart collection -->
    <div id="products-grid">
      {(products?.items ?? []).map(p => <ProductCard product={p} />)}
    </div>

    <!-- Paginación client-side -->
    {products?.meta?.truncated && (
      <button id="load-more" data-page="2">
        Ver más ({products.meta.total - products.meta.returned} restantes)
      </button>
    )}
  </div>
</EditableSection>

<script>
  import { fetchCategoryProducts } from '@proxima-io/storefront-core';

  const btn = document.getElementById('load-more');
  if (btn) {
    btn.addEventListener('click', async () => {
      const slug = btn.closest('[data-category-slug]')?.dataset.categorySlug;
      const page = parseInt(btn.dataset.page ?? '2');

      const listing = await fetchCategoryProducts(
        { baseUrl: import.meta.env.PUBLIC_PROXIMA_API_URL },
        { business_id: window.__PROXIMA_BUSINESS_ID__, locale: document.documentElement.lang, currency: 'PEN' },
        { slug, page }
      );

      // Añadir nuevos productos al grid
      const grid = document.getElementById('products-grid');
      listing.items.forEach(product => {
        // Crear y append cards
      });

      if (listing.pagination.page < listing.pagination.total_pages) {
        btn.dataset.page = String(page + 1);
      } else {
        btn.remove();
      }
    });
  }
</script>
```

---

## Fallbacks cuando no hay datos

El comercio puede no haber configurado una smart collection todavía.
Siempre manejar el caso de `null`/`undefined`:

```astro
---
const { products } = section.values;
const hasProducts = products?.items?.length > 0;
---

{hasProducts
  ? <ProductGrid items={products.items} />
  : <EmptyState message="Productos próximamente" />
}
```

---

## Smart Collections con campaña (schedule + countdown)

Una SC puede tener un scheduling de datos (`active_from` / `active_until`) y un target de countdown configurable. Cuando la API resuelve la composición, embebe un bloque `schedule` en `attributes_meta` junto a los datos de la colección.

### Shape del bloque `schedule`

```ts
interface ResolvedSmartCollectionInfo {
  collection: {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
    active_from: string | null;   // ISO UTC — cuándo empieza a servir datos
    active_until: string | null;  // ISO UTC — cuándo deja de servir datos
    config: {
      display?: {
        countdown_target_at?: string;  // ISO UTC — override explícito del target
      };
    };
  };
  schedule: {
    countdown_target_at: string | null;  // target resuelto (config.display > active_until)
    countdown_target_source:
      | "config.display.countdown_target_at"
      | "active_until"
      | null;
  };
  meta: {
    inactive: boolean;
    inactive_reason: "disabled" | "before_start" | "after_end" | null;
  };
}
```

### Leer el countdown desde una SC en el componente

```astro
---
import {
  resolveSmartCollectionTarget,
  getCampaignCountdown,
} from "@proxima-io/storefront-core";

// props.products viene de section.values (ya resuelto por la API)
// El attributesMeta contiene el bloque schedule de la SC
const sc = props.attributesMeta?.["products"];   // nombre del atributo SC
const targetAt = resolveSmartCollectionTarget(sc);
const snap = targetAt ? getCampaignCountdown(targetAt) : null;
---

{snap && !snap.expired && (
  <div id="sc-countdown" data-target={targetAt}>
    {/* El storefront implementa su UI */}
  </div>
)}
```

### Sección inactiva (`meta.inactive`)

Si la SC llega con `meta.inactive = true`, no hay productos — la colección está fuera de su ventana o desactivada:

```astro
---
const sc = props.attributesMeta?.["products"];
const isInactive = sc?.meta?.inactive === true;
const inactiveReason = sc?.meta?.inactive_reason; // "before_start" | "after_end" | "disabled"

if (!props.cmsPreview && isInactive) return null;
---

{props.cmsPreview && isInactive && (
  <div class="empty-state">
    Campaña {inactiveReason === "after_end" ? "finalizada" : "no activa"}
  </div>
)}
```

### Ticker client-side para SC

Igual que para atributos `datetime` — usar `createCampaignTicker`:

```astro
<script>
  import { createCampaignTicker } from "@proxima-io/storefront-core";

  const el = document.getElementById("sc-countdown");
  const targetAt = el?.dataset.target;
  if (!el || !targetAt) return;

  const stop = createCampaignTicker(targetAt, (state) => {
    if (state.expired) { stop(); el.remove(); return; }
    // actualizar UI
  });
</script>
```

### Resumen de helpers

| Función | Para qué |
|---------|----------|
| `resolveSmartCollectionTarget(sc)` | Extrae `countdown_target_at` del `schedule` de una SC resuelta |
| `getCampaignCountdown(targetAt)` | Snapshot `{ days, hours, minutes, seconds, expired }` (SSR-safe) |
| `createCampaignTicker(targetAt, onTick)` | Ticker client-side, devuelve `stop()` |

---

## Checklist para una sección con Smart Collection

- [ ] El atributo usa `type: "smart_collection_id"` en el schema
- [ ] El `config` restringe el tipo permitido: `{ "allowed_smart_collection_types": ["product_list"] }`
- [ ] El componente accede a `attributes.mi_atributo.items` (no al ID)
- [ ] Hay un fallback para cuando `items` está vacío o el atributo es `null`
- [ ] Si hay paginación, usa `fetchCategoryProducts` / `fetchBrandProducts` / `fetchStorefrontProducts`
- [ ] Si la SC puede tener campaña: leer `resolveSmartCollectionTarget(sc)` y manejar `meta.inactive`
