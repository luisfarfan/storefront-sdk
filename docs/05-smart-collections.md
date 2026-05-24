# 05 — Smart Collections

Datos dinámicos auto-resueltos en la composición. El comercio los configura; tú los renderizas.

---

## ¿Qué es una Smart Collection?

Una Smart Collection es una **query guardada** que el comercio configura en el builder.
Cuando el storefront pide la composición, la API resuelve cada smart collection y
embebe el resultado directamente en el `attributes` de la sección correspondiente.

**El developer no hace nada especial** — el atributo `smart_collection_id` llega como
un objeto con `type`, `items` y `meta`.

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
const { products } = section.attributes;
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
const { categories } = section.attributes;
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
const { brands } = section.attributes;
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
const { featured } = section.attributes;
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
const { picks } = section.attributes;
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

const { products } = section.attributes;
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
const { products } = section.attributes;
const hasProducts = products?.items?.length > 0;
---

{hasProducts
  ? <ProductGrid items={products.items} />
  : <EmptyState message="Productos próximamente" />
}
```

---

## Checklist para una sección con Smart Collection

- [ ] El atributo usa `type: "smart_collection_id"` en el schema
- [ ] El `config` restringe el tipo permitido: `{ "allowed_smart_collection_types": ["product_list"] }`
- [ ] El componente accede a `attributes.mi_atributo.items` (no al ID)
- [ ] Hay un fallback para cuando `items` está vacío o el atributo es `null`
- [ ] Si hay paginación, usa `fetchCategoryProducts` / `fetchBrandProducts` / `fetchStorefrontProducts`
