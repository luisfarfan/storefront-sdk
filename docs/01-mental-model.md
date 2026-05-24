# 01 — Modelo mental de Proxima

Antes de escribir una sola línea de código, entender este modelo te ahorrará horas de confusión.

---

## La jerarquía de datos

```
Website
  └── Pages  (rutas URL)
        └── Sections  (bloques visuales)
              └── Attributes  (datos editables)
                    └── SmartCollections  (datos dinámicos auto-resueltos)
```

Cada nivel tiene un rol específico:

| Nivel | Qué es | Quién lo controla |
|-------|--------|-------------------|
| **Website** | Dominio, tema, capacidades, idioma, moneda | Admin del comercio |
| **Page** | Una ruta URL con un `resolver_kind` | Admin del comercio (o template) |
| **Section** | Bloque visual con un `type` | Admin del comercio (o template) |
| **Attribute** | Campo editable de una sección | Admin del comercio (via builder) |
| **SmartCollection** | Query dinámica (productos, categorías, etc.) | Admin del comercio |

---

## La frase clave

> **Proxima no es un headless CMS donde tú pides los datos. Es un sistema donde la API ya resolvió todo — tú solo renderizas lo que recibes.**

Esta diferencia es fundamental. En un headless CMS tradicional:
```
Storefront → pide página → pide productos → pide categorías → ensambla → renderiza
```

En Proxima:
```
Storefront → pide composición → renderiza  (fin)
```

La API resuelve internamente las smart collections, los datos de la entidad principal,
el SEO, el locale, la moneda — todo. El storefront recibe un JSON completo y lo renderiza.

---

## Pages — Rutas y resolver_kinds

Cada página tiene un `resolver_kind` que le dice al storefront qué tipo de página es:

| `resolver_kind` | Ruta típica | `resolved_data` contiene |
|-----------------|-------------|--------------------------|
| `content_page` | `/`, `/nosotros`, `/contacto` | `null` |
| `product_detail` | `/producto/{slug}` | El producto completo |
| `category_detail` | `/categoria/{slug}` | La categoría + primeros productos |
| `brand_detail` | `/marca/{slug}` | La marca + primeros productos |
| `search` | `/buscar` | `null` (resultados son client-side) |
| `product_list` | `/productos` | `null` |

El storefront usa `resolver_kind` para saber cómo renderizar la página. El ejemplo más
común es el **catch-all** (`[...path].astro`) que maneja todos los `resolver_kind`:

```astro
---
// src/pages/[...path].astro
const { composition } = Astro.props; // ya resuelto en el layout

switch (composition.resolver_kind) {
  case 'product_detail':
    // composition.resolved_data tiene el producto
    break;
  case 'search':
    // No hay datos iniciales — la búsqueda es client-side
    break;
  default:
    // content_page, category_detail, etc.
}
---
```

---

## Sections — Bloques visuales

Una sección tiene:
- `type` — el nombre del componente Astro que la renderiza (e.g. `"hero"`, `"product_grid"`)
- `attributes` — un diccionario con los datos editables
- `id` — para la integración con el builder

```json
{
  "id": 42,
  "name": "Hero principal",
  "type": "hero",
  "order": 1,
  "attributes": {
    "headline": "Bienvenido a nuestra tienda",
    "subheadline": "Los mejores productos",
    "cta_text": "Ver catálogo",
    "cta_href": { "url": "/productos", "label": "Ver catálogo" }
  }
}
```

El storefront mapea `section.type` → componente Astro y le pasa los `attributes`.

---

## Attributes — Los 9 tipos

| Tipo | Qué almacena | Ejemplo de valor |
|------|-------------|-----------------|
| `text` | String simple | `"Bienvenido"` |
| `rich_text` | HTML/markdown | `"<h2>Bienvenido</h2>"` |
| `image` | URL de imagen | `"https://cdn.../banner.jpg"` |
| `boolean` | `true` / `false` | `true` |
| `number` | Número | `12` |
| `link` | `{ url, label, target? }` | `{ url: "/productos", label: "Ver más" }` |
| `object` | Objeto con campos anidados | `{ name: "Juan", role: "CEO" }` |
| `array` | Lista de objetos | `[{ title: "FAQ 1", body: "..." }]` |
| `smart_collection_id` | **Referencia resuelta** | Ver abajo ↓ |

### El tipo especial: `smart_collection_id`

Este tipo almacena un ID de SmartCollection, pero cuando llega al storefront ya
**está resuelto como datos** — no como un ID. La API lo resuelve internamente al
generar la composición:

```json
{
  "attributes": {
    "featured_products": {
      "type": "product_list",
      "items": [
        {
          "id": 1, "slug": "titan-mx-pro", "name": "Titan MX Pro",
          "price": 299.90, "price_formatted": "S/ 299.90",
          "image": "https://cdn.../titan.jpg",
          "default_variant_id": 7
        }
      ],
      "meta": { "limit": 8, "returned": 6, "total": 42 }
    }
  }
}
```

El componente Astro solo hace `attributes.featured_products.items.map(...)` y renderiza.
No hay ninguna llamada adicional a la API.

---

## SmartCollections — Los 6 tipos

| Tipo | Qué resuelve |
|------|-------------|
| `product_list` | Productos filtrados por categoría, marca, precio, stock, etc. |
| `category_list` | Árbol de categorías con jerarquía |
| `brand_list` | Marcas ordenadas por conteo de productos |
| `banner` | Una entidad promocionada (producto, categoría o marca) |
| `manual` | Lista curada a mano por el comercio |
| `search_preview` | Productos que coinciden con un query fijo (editorial) |

El comercio configura estas colecciones en el builder (qué filtros aplicar, cuántos items mostrar).
El developer solo recibe el resultado y lo renderiza.

---

## El flujo completo de un request

```
Browser → GET /categoria/zapatillas

Storefront (Astro SSR):
  1. fetchProximaWebsite(domain)
     → { id, business_id, locale: "es", currency: "PEN", capabilities, theme_tokens }

  2. fetchProximaComposition({ path: "/categoria/zapatillas" }, website)
     → {
          resolver_kind: "category_detail",
          resolved_data: {
            category: { id: 5, name: "Zapatillas", slug: "zapatillas" },
            products: [...]   ← primeros 24 productos de la categoría
          },
          sections: [
            { type: "header", attributes: { logo: "...", nav_links: [...] } },
            { type: "category_hero", attributes: { title: "Zapatillas", image: "..." } },
            { type: "product_grid", attributes: {
                products: {                    ← smart_collection ya resuelta
                  type: "product_list",
                  items: [...],
                  meta: { limit: 24, total: 156 }
                }
              }
            },
            { type: "footer", attributes: { ... } }
          ],
          seo: { meta_title: "Zapatillas | Mi Tienda", meta_description: "..." }
        }

  3. Renderiza secciones en orden
  4. Devuelve HTML al browser
```

Nada más. Sin queries adicionales, sin REST calls extras desde el storefront.

---

## Diagrama de paquetes

```
                    ┌─────────────────────────────┐
                    │    proxima-api               │
                    │  /storefront/cms/websites/   │
                    │  {id}/pages/composition      │
                    └──────────────┬──────────────┘
                                   │ JSON (todo resuelto)
                    ┌──────────────▼──────────────┐
                    │   storefront-core            │
                    │   fetchProximaComposition()  │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼──────┐      ┌──────────▼──────┐     ┌──────────▼──────┐
│ storefront-cms │      │  Tu código Astro │     │  builder-sdk    │
│ normalizeSec.. │      │  Section router  │     │  EditableSection│
│ editable props │      │  Components      │     │  PostMessage    │
└────────────────┘      └─────────────────┘     └─────────────────┘
```
